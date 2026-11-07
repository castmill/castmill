defmodule Castmill.Widgets.Integrations.Rss.Xml do
  @moduledoc """
  Safe and lenient XML parsing for syndication feeds.

  Feeds are fetched from arbitrary, user-supplied URLs, so they are treated as
  untrusted input:

  - Document type declarations are removed before parsing and documents that
    still declare entities are rejected. No DTD is ever loaded and no entity is
    ever expanded, which prevents XXE, SSRF through external DTDs and
    "billion laughs" style attacks.
  - The document is parsed with OTP's SAX parser (`:xmerl_sax_parser`), which
    keeps element and attribute names as strings. Unlike `:xmerl_scan` it never
    creates atoms from document content, so hostile feeds cannot exhaust the
    atom table.

  Real-world feeds are often not well-formed, so the document is normalised
  first: the byte stream is converted to UTF-8 (UTF-8, UTF-16, ISO-8859-1 and
  Windows-1252 are supported), HTML named entities are converted to numeric
  references, bare ampersands are escaped and characters that are not allowed
  in XML are removed.

  The result is a simple tree of `{name, attributes, children}` tuples where
  `name` is a string such as `"title"` or `"media:content"`. Well-known
  namespace URIs are mapped to their conventional prefix regardless of the
  prefix used in the document, and the default namespaces of RSS 1.0 and RSS
  0.90 are mapped to no prefix, so that their elements look like RSS 2.0 ones.
  """

  alias Castmill.Widgets.Integrations.Rss.Html

  @type element :: {String.t(), %{String.t() => String.t()}, [element() | String.t()]}

  @namespaces %{
    "http://search.yahoo.com/mrss/" => "media",
    "http://search.yahoo.com/mrss" => "media",
    "http://purl.org/rss/1.0/modules/content/" => "content",
    "http://purl.org/dc/elements/1.1/" => "dc",
    "http://purl.org/dc/terms/" => "dcterms",
    "http://www.w3.org/2005/Atom" => "atom",
    "http://purl.org/atom/ns#" => "atom",
    "http://www.itunes.com/dtds/podcast-1.0.dtd" => "itunes",
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#" => "rdf",
    "http://www.w3.org/XML/1998/namespace" => "xml",
    "http://purl.org/rss/1.0/" => "",
    "http://my.netscape.com/rdf/simple/0.9/" => "",
    "http://backend.userland.com/rss2" => ""
  }

  @xml_entities ~w(amp lt gt quot apos)

  # Windows-1252 code points for bytes 0x80..0x9F (undefined bytes map to
  # their Latin-1 control character equivalents, which are removed later).
  @cp1252 %{
    0x80 => 0x20AC,
    0x82 => 0x201A,
    0x83 => 0x0192,
    0x84 => 0x201E,
    0x85 => 0x2026,
    0x86 => 0x2020,
    0x87 => 0x2021,
    0x88 => 0x02C6,
    0x89 => 0x2030,
    0x8A => 0x0160,
    0x8B => 0x2039,
    0x8C => 0x0152,
    0x8E => 0x017D,
    0x91 => 0x2018,
    0x92 => 0x2019,
    0x93 => 0x201C,
    0x94 => 0x201D,
    0x95 => 0x2022,
    0x96 => 0x2013,
    0x97 => 0x2014,
    0x98 => 0x02DC,
    0x99 => 0x2122,
    0x9A => 0x0161,
    0x9B => 0x203A,
    0x9C => 0x0153,
    0x9E => 0x017E,
    0x9F => 0x0178
  }

  @doc """
  Parses an XML document into an element tree.

  Returns `{:ok, root}` or `{:error, reason}` where reason is one of
  `:xml_parse_error` or `:unsupported_encoding`.
  """
  @spec parse(binary()) :: {:ok, element()} | {:error, :xml_parse_error | :unsupported_encoding}
  def parse(document) when is_binary(document) do
    with {:ok, utf8} <- to_utf8(document),
         {:ok, sanitized} <- sanitize(utf8) do
      run_sax(sanitized)
    end
  end

  # ==========================================================================
  # Element helpers
  # ==========================================================================

  @doc "Returns the qualified name of an element."
  @spec name(element()) :: String.t()
  def name({name, _attrs, _children}), do: name

  @doc "Returns an attribute value, or nil."
  @spec attr(element() | nil, String.t()) :: String.t() | nil
  def attr(nil, _name), do: nil
  def attr({_name, attrs, _children}, attr_name), do: Map.get(attrs, attr_name)

  @doc "Returns the child elements with any of the given names, in document order."
  @spec children(element() | nil, String.t() | [String.t()]) :: [element()]
  def children(nil, _names), do: []
  def children(element, name) when is_binary(name), do: children(element, [name])

  def children({_name, _attrs, children}, names) do
    Enum.filter(children, fn
      {name, _, _} -> name in names
      _text -> false
    end)
  end

  @doc "Returns all child elements."
  @spec elements(element() | nil) :: [element()]
  def elements(nil), do: []
  def elements({_name, _attrs, children}), do: Enum.filter(children, &is_tuple/1)

  @doc """
  Returns the first child element matching the given names. When a list is
  given, names are tried in order of preference.
  """
  @spec child(element() | nil, String.t() | [String.t()]) :: element() | nil
  def child(element, name) when is_binary(name), do: child(element, [name])

  def child(element, names) do
    Enum.find_value(names, fn name -> element |> children(name) |> List.first() end)
  end

  @doc """
  Returns the trimmed text of the first matching child element that has
  non-empty text, or `""`.
  """
  @spec child_text(element() | nil, String.t() | [String.t()]) :: String.t()
  def child_text(element, name) when is_binary(name), do: child_text(element, [name])

  def child_text(element, names) do
    Enum.find_value(names, "", fn name ->
      element
      |> children(name)
      |> Enum.map(&text/1)
      |> Enum.find(&(&1 != ""))
    end)
  end

  @doc """
  Returns the trimmed text content of an element (including descendants).
  """
  @spec text(element() | nil) :: String.t()
  def text(nil), do: ""

  def text(element),
    do: element |> collect_text([]) |> Enum.reverse() |> IO.iodata_to_binary() |> String.trim()

  defp collect_text({_name, _attrs, children}, acc),
    do: Enum.reduce(children, acc, &collect_text/2)

  defp collect_text(text, acc) when is_binary(text), do: [text | acc]

  # ==========================================================================
  # Encoding
  # ==========================================================================

  @doc false
  @spec to_utf8(binary()) :: {:ok, String.t()} | {:error, :unsupported_encoding}
  def to_utf8(<<0xEF, 0xBB, 0xBF, rest::binary>>), do: to_utf8_from(rest, "utf-8")
  def to_utf8(<<0xFE, 0xFF, rest::binary>>), do: convert_utf16(rest, :big)
  def to_utf8(<<0xFF, 0xFE, rest::binary>>), do: convert_utf16(rest, :little)
  def to_utf8(<<0, ?<, _::binary>> = doc), do: convert_utf16(doc, :big)
  def to_utf8(<<?<, 0, _::binary>> = doc), do: convert_utf16(doc, :little)
  def to_utf8(document), do: to_utf8_from(document, declared_encoding(document))

  defp to_utf8_from(document, encoding) do
    cond do
      encoding in ["utf-8", "utf8", "us-ascii", "ascii", nil] ->
        # Feeds regularly lie about being UTF-8 - fall back to Windows-1252.
        if String.valid?(document), do: {:ok, document}, else: {:ok, from_cp1252(document)}

      encoding in ["iso-8859-1", "latin1", "latin-1", "iso8859-1", "iso-8859-15"] ->
        {:ok, latin1_to_utf8(document)}

      encoding in ["windows-1252", "cp1252"] ->
        {:ok, from_cp1252(document)}

      encoding in ["utf-16", "utf16"] ->
        {:ok, document}

      String.valid?(document) ->
        # Unknown declared encoding but the bytes are valid UTF-8; many
        # servers re-encode feeds without updating the declaration.
        {:ok, document}

      true ->
        {:error, :unsupported_encoding}
    end
  end

  defp declared_encoding(document) do
    case Regex.run(~r/\A\s*<\?xml[^>]*?encoding\s*=\s*["']([A-Za-z0-9._\-]+)["']/, document) do
      [_, encoding] -> String.downcase(encoding)
      _ -> nil
    end
  end

  defp convert_utf16(document, endianness) do
    case :unicode.characters_to_binary(document, {:utf16, endianness}, :utf8) do
      binary when is_binary(binary) -> {:ok, binary}
      _ -> {:error, :unsupported_encoding}
    end
  end

  defp latin1_to_utf8(document), do: :unicode.characters_to_binary(document, :latin1, :utf8)

  defp from_cp1252(document) do
    for <<byte <- document>>, into: "" do
      <<Map.get(@cp1252, byte, byte)::utf8>>
    end
  end

  # ==========================================================================
  # Sanitisation
  # ==========================================================================

  @doc false
  @spec sanitize(String.t()) :: {:ok, String.t()} | {:error, :xml_parse_error}
  def sanitize(document) do
    segments = Regex.split(~r/<!\[CDATA\[.*?\]\]>/s, document, include_captures: true)

    {segments, rejected?} =
      Enum.map_reduce(segments, false, fn segment, rejected? ->
        if String.starts_with?(segment, "<![CDATA[") do
          {remove_invalid_chars(segment), rejected?}
        else
          cleaned =
            segment
            |> remove_doctype()
            |> remove_invalid_chars()
            |> fix_entities()

          {cleaned, rejected? or Regex.match?(~r/<!(DOCTYPE|ENTITY)/i, cleaned)}
        end
      end)

    if rejected? do
      {:error, :xml_parse_error}
    else
      sanitized =
        segments
        |> IO.iodata_to_binary()
        # The document is UTF-8 now, so the original declaration (which may
        # name another encoding) is dropped. It must also be the very first
        # thing in a document, which feeds with leading whitespace violate.
        |> String.replace(~r/\A\s*<\?xml[^>]*\?>/, "")
        |> String.trim_leading()

      {:ok, sanitized}
    end
  end

  defp remove_doctype(segment) do
    segment
    |> String.replace(~r/<!DOCTYPE[^\[>]*\[.*?\]\s*>/is, "")
    |> String.replace(~r/<!DOCTYPE[^>]*>/i, "")
  end

  defp remove_invalid_chars(segment) do
    String.replace(segment, ~r/[\x{0}-\x{8}\x{B}\x{C}\x{E}-\x{1F}\x{FFFE}\x{FFFF}]/u, "")
  end

  defp fix_entities(segment) do
    if String.contains?(segment, "&") do
      Regex.replace(
        ~r/&(?:(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{0,31});)?/,
        segment,
        fn
          _whole, "" -> "&amp;"
          whole, ref -> fix_reference(whole, ref)
        end
      )
    else
      segment
    end
  end

  defp fix_reference(_whole, "#" <> <<x, hex::binary>>) when x in [?x, ?X] do
    codepoint = String.to_integer(hex, 16)
    if Html.valid_codepoint?(codepoint), do: "&#x#{hex};", else: ""
  end

  defp fix_reference(whole, "#" <> dec) do
    if Html.valid_codepoint?(String.to_integer(dec)), do: whole, else: ""
  end

  defp fix_reference(whole, name) when name in @xml_entities, do: whole

  defp fix_reference(_whole, name) do
    case Html.entity_codepoints(name) do
      nil -> "&amp;#{name};"
      codepoints -> Enum.map_join(codepoints, &"&##{&1};")
    end
  end

  # ==========================================================================
  # SAX parsing
  # ==========================================================================

  defp run_sax(document) do
    result =
      :xmerl_sax_parser.stream(document,
        event_fun: &handle_event/3,
        event_state: %{stack: [], root: nil}
      )

    case result do
      {:ok, %{root: root}, _rest} when is_tuple(root) -> {:ok, root}
      _ -> {:error, :xml_parse_error}
    end
  rescue
    _ -> {:error, :xml_parse_error}
  catch
    _kind, _reason -> {:error, :xml_parse_error}
  end

  defp handle_event({:startElement, uri, local_name, {prefix, _}, attributes}, _loc, state) do
    name = qualified_name(uri, prefix, local_name)

    attrs =
      Enum.reduce(attributes, %{}, fn {attr_uri, attr_prefix, attr_name, value}, acc ->
        key =
          if attr_uri == [] and attr_prefix == [] do
            List.to_string(attr_name)
          else
            qualified_name(attr_uri, attr_prefix, attr_name)
          end

        Map.put_new(acc, key, List.to_string(value))
      end)

    %{state | stack: [{name, attrs, []} | state.stack]}
  end

  defp handle_event({:endElement, _uri, _local_name, _qname}, _loc, state) do
    case state.stack do
      [{name, attrs, children} | rest] ->
        element = {name, attrs, Enum.reverse(children)}

        case rest do
          [] ->
            %{state | stack: [], root: element}

          [{parent, parent_attrs, parent_children} | ancestors] ->
            %{state | stack: [{parent, parent_attrs, [element | parent_children]} | ancestors]}
        end

      [] ->
        state
    end
  end

  defp handle_event({:characters, chars}, _loc, state), do: add_text(state, chars)
  defp handle_event({:ignorableWhitespace, chars}, _loc, state), do: add_text(state, chars)
  defp handle_event(_event, _loc, state), do: state

  defp add_text(%{stack: [{name, attrs, children} | rest]} = state, chars) do
    text = List.to_string(chars)

    children =
      case children do
        [previous | others] when is_binary(previous) -> [previous <> text | others]
        _ -> [text | children]
      end

    %{state | stack: [{name, attrs, children} | rest]}
  end

  defp add_text(state, _chars), do: state

  defp qualified_name(uri, prefix, local_name) do
    local = List.to_string(local_name)

    namespace =
      case Map.fetch(@namespaces, List.to_string(uri)) do
        {:ok, known} -> known
        :error -> List.to_string(prefix)
      end

    if namespace == "", do: local, else: namespace <> ":" <> local
  end
end
