defmodule Castmill.Widgets.Integrations.Rss.Html do
  @moduledoc """
  Text helpers for syndication feeds.

  Feed fields frequently contain HTML (escaped or in CDATA sections), HTML named
  entities and inline images. Digital signage widgets need clean, plain text, so
  these helpers convert HTML fragments to text, decode entities and extract
  image URLs.

  Markup is parsed with Floki (mochiweb backend), so malformed markup, quoted
  `>` characters in attribute values, comments and raw-text elements are
  handled like an HTML parser would. Named character references use Floki's
  complete HTML5 entity table, including entities that expand to more than one
  code point.
  """

  # Elements whose content is never rendered as text (nor as images).
  @nonrendered_tags ~w(script style noscript iframe template)

  # Elements whose boundaries separate words (block-level elements and breaks).
  @block_tags ~w(address article aside blockquote br dd div dl dt figcaption figure footer
                 h1 h2 h3 h4 h5 h6 header hr img li main nav ol p pre section table tbody td
                 tfoot th thead tr ul)

  @reference_regex ~r/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{0,31});/
  @named_reference_regex ~r/&([A-Za-z][A-Za-z0-9]{0,31});/
  @tag_regex ~r/<\/?[a-zA-Z][^<>]*>/

  @doc """
  Returns the code points for a named HTML5 character reference (without the
  leading `&` and trailing `;`), or `nil` when the name is unknown.

  Some HTML5 entities (e.g. `NotEqualTilde`) expand to two code points.
  """
  @spec entity_codepoints(String.t()) :: [non_neg_integer()] | nil
  def entity_codepoints(name) when is_binary(name) do
    if Regex.match?(~r/\A[A-Za-z][A-Za-z0-9]{0,31}\z/, name) do
      # Floki's entity decoder covers the full WHATWG named reference table.
      case Floki.Entities.decode("&" <> name <> ";") do
        {:ok, decoded} -> String.to_charlist(decoded)
        _ -> nil
      end
    end
  end

  @doc """
  Decodes named (full HTML5 set) and numeric character references.

  Unknown entities and references to invalid code points are left untouched.
  """
  @spec decode_entities(String.t() | nil) :: String.t()
  def decode_entities(nil), do: ""

  def decode_entities(text) when is_binary(text) do
    if String.contains?(text, "&") do
      Regex.replace(@reference_regex, text, fn whole, ref -> decode_reference(ref) || whole end)
    else
      text
    end
  end

  defp decode_reference("#" <> <<x, hex::binary>>) when x in [?x, ?X],
    do: codepoint_to_string(String.to_integer(hex, 16))

  defp decode_reference("#" <> dec), do: codepoint_to_string(String.to_integer(dec))

  defp decode_reference(name) do
    case entity_codepoints(name) do
      nil -> nil
      codepoints -> List.to_string(codepoints)
    end
  end

  defp codepoint_to_string(codepoint) do
    if valid_codepoint?(codepoint), do: <<codepoint::utf8>>, else: nil
  end

  @doc """
  Returns true when `codepoint` is a character allowed in XML 1.0 documents.
  """
  @spec valid_codepoint?(integer()) :: boolean()
  def valid_codepoint?(cp) when cp in [0x9, 0xA, 0xD], do: true
  def valid_codepoint?(cp) when cp >= 0x20 and cp <= 0xD7FF, do: true
  def valid_codepoint?(cp) when cp >= 0xE000 and cp <= 0xFFFD, do: true
  def valid_codepoint?(cp) when cp >= 0x10000 and cp <= 0x10FFFF, do: true
  def valid_codepoint?(_), do: false

  @doc """
  Converts an HTML fragment (or plain text) to a single line of plain text.

  Scripts, styles, other non-rendered elements and comments are removed,
  markup is dropped (block elements and line breaks separate words, inline
  elements do not), entities are decoded and whitespace is collapsed.
  Double-escaped HTML (e.g. `&lt;p&gt;`) is handled as well.
  """
  @spec to_text(String.t() | nil) :: String.t()
  def to_text(nil), do: ""

  def to_text(html) when is_binary(html) do
    text = html_to_text(html)
    text = if Regex.match?(@tag_regex, text), do: html_to_text(text), else: text

    text
    |> String.replace(~r/[\x{00A0}\x{2000}-\x{200B}\x{202F}\x{205F}\x{3000}]/u, " ")
    |> String.replace(~r/[\x{200C}-\x{200F}\x{FEFF}]/u, "")
    |> String.replace(~r/\s+/u, " ")
    |> String.trim()
  end

  defp html_to_text(html), do: html |> parse() |> node_text() |> IO.iodata_to_binary()

  defp node_text(nodes) when is_list(nodes), do: Enum.map(nodes, &node_text/1)
  defp node_text(text) when is_binary(text), do: text
  defp node_text({:comment, _}), do: " "

  defp node_text({tag, _attrs, children}) when is_binary(tag) do
    cond do
      tag in @nonrendered_tags -> " "
      tag in @block_tags -> [" ", node_text(children), " "]
      true -> node_text(children)
    end
  end

  # Doctypes and processing instructions.
  defp node_text(_other), do: ""

  @doc """
  Truncates `text` to at most `max_length` characters, preferring a word
  boundary and appending an ellipsis when content was removed.
  """
  @spec truncate(String.t(), pos_integer()) :: String.t()
  def truncate(text, max_length) when is_binary(text) and max_length > 1 do
    if String.length(text) <= max_length do
      text
    else
      cut = String.slice(text, 0, max_length - 1)
      at_boundary? = String.match?(String.at(text, max_length - 1), ~r/^\s$/u)

      trimmed =
        case Regex.run(~r/^(.*\S)\s+\S*$/su, cut) do
          [_, before] when not at_boundary? and byte_size(before) > div(byte_size(cut), 2) ->
            before

          _ ->
            cut
        end

      Regex.replace(~r/[\s,.;:!?\-–—]+$/u, trimmed, "") <> "…"
    end
  end

  @doc """
  Returns the image URLs referenced by `<img>` tags in an HTML fragment, in
  document order. Images inside non-rendered elements (scripts, templates,
  `noscript`, comments, ...), data URIs and tracking pixels (0/1 pixel wide or
  high images) are skipped. Lazy-loading attributes (`data-src`,
  `data-lazy-src`, `srcset`) are used when `src` is missing or a data URI.
  """
  @spec image_urls(String.t() | nil) :: [String.t()]
  def image_urls(nil), do: []

  def image_urls(html) when is_binary(html) do
    html
    |> parse()
    |> collect_images(true)
    |> Enum.reject(&tracking_pixel?/1)
    |> Enum.map(fn attrs ->
      [attrs["src"], attrs["data-src"], attrs["data-lazy-src"], first_srcset_url(attrs["srcset"])]
      |> Enum.map(fn source -> if is_binary(source), do: String.trim(source) end)
      |> Enum.find(&valid_image_source?/1)
    end)
    |> Enum.reject(&is_nil/1)
  end

  defp collect_images(nodes, reparse?) when is_list(nodes),
    do: Enum.flat_map(nodes, &collect_images(&1, reparse?))

  defp collect_images({"img", attrs, _children}, _reparse?), do: [attributes_map(attrs)]

  defp collect_images({tag, _attrs, children}, reparse?) when is_binary(tag) do
    if tag in @nonrendered_tags, do: [], else: collect_images(children, reparse?)
  end

  # Escaped HTML (e.g. RSS descriptions without CDATA) is decoded by the first
  # parse into text containing markup, which is parsed once more.
  defp collect_images(text, true) when is_binary(text) do
    if text =~ ~r/<img\b/i, do: text |> parse() |> collect_images(false), else: []
  end

  defp collect_images(_node, _reparse?), do: []

  @doc """
  Returns the attributes of every `tag_name` element in an HTML document, in
  document order, as maps with lowercase attribute names and decoded values.
  The first occurrence of a repeated attribute wins.
  """
  @spec tag_attributes(String.t(), String.t()) :: [%{String.t() => String.t()}]
  def tag_attributes(html, tag_name) when is_binary(html) and is_binary(tag_name) do
    html |> parse() |> collect_tag_attributes(String.downcase(tag_name))
  end

  defp collect_tag_attributes(nodes, tag_name) when is_list(nodes),
    do: Enum.flat_map(nodes, &collect_tag_attributes(&1, tag_name))

  defp collect_tag_attributes({tag, attrs, children}, tag_name) when is_binary(tag) do
    own = if tag == tag_name, do: [attributes_map(attrs)], else: []
    own ++ collect_tag_attributes(children, tag_name)
  end

  defp collect_tag_attributes(_node, _tag_name), do: []

  defp attributes_map(attrs) do
    Enum.reduce(attrs, %{}, fn {name, value}, acc ->
      Map.put_new(acc, String.downcase(name), value)
    end)
  end

  defp tracking_pixel?(attrs), do: attrs["width"] in ["0", "1"] or attrs["height"] in ["0", "1"]

  defp valid_image_source?(source),
    do:
      is_binary(source) and source != "" and
        not String.starts_with?(String.downcase(source), "data:")

  defp first_srcset_url(nil), do: nil

  defp first_srcset_url(srcset) do
    srcset |> String.split(",") |> List.first("") |> String.split() |> List.first()
  end

  # ==========================================================================
  # Parsing
  # ==========================================================================

  defp parse(html) do
    case Floki.parse_fragment(expand_multi_codepoint_references(html),
           html_parser: Floki.HTMLParser.Mochiweb
         ) do
      {:ok, nodes} -> nodes
      _ -> []
    end
  rescue
    _ -> []
  catch
    _kind, _reason -> []
  end

  # The mochiweb tokenizer only decodes references that expand to a single
  # code point, so HTML5 entities such as `&NotEqualTilde;` are rewritten as
  # the equivalent numeric references before parsing.
  defp expand_multi_codepoint_references(html) do
    if String.contains?(html, "&") do
      Regex.replace(@named_reference_regex, html, fn whole, name ->
        case entity_codepoints(name) do
          [_, _ | _] = codepoints -> Enum.map_join(codepoints, &"&##{&1};")
          _ -> whole
        end
      end)
    else
      html
    end
  end
end
