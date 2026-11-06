defmodule Castmill.Widgets.Integrations.Rss.Html do
  @moduledoc """
  Text helpers for syndication feeds.

  Feed fields frequently contain HTML (escaped or in CDATA sections), HTML named
  entities and inline images. Digital signage widgets need clean, plain text, so
  these helpers convert HTML fragments to text, decode entities and extract
  image URLs without depending on an HTML parser.
  """

  # Latin-1 (ISO-8859-1) named entities for code points 160..255, in order.
  @latin1_entities ~w(
    nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr
    deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest
    Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml
    ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig
    agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml
    eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml
  )

  if length(@latin1_entities) != 96 do
    raise "Latin-1 entity table must contain 96 entries"
  end

  @other_entities %{
    "amp" => 38,
    "lt" => 60,
    "gt" => 62,
    "quot" => 34,
    "apos" => 39,
    "OElig" => 338,
    "oelig" => 339,
    "Scaron" => 352,
    "scaron" => 353,
    "Yuml" => 376,
    "fnof" => 402,
    "circ" => 710,
    "tilde" => 732,
    "ensp" => 8194,
    "emsp" => 8195,
    "thinsp" => 8201,
    "zwnj" => 8204,
    "zwj" => 8205,
    "lrm" => 8206,
    "rlm" => 8207,
    "ndash" => 8211,
    "mdash" => 8212,
    "lsquo" => 8216,
    "rsquo" => 8217,
    "sbquo" => 8218,
    "ldquo" => 8220,
    "rdquo" => 8221,
    "bdquo" => 8222,
    "dagger" => 8224,
    "Dagger" => 8225,
    "bull" => 8226,
    "hellip" => 8230,
    "permil" => 8240,
    "prime" => 8242,
    "Prime" => 8243,
    "lsaquo" => 8249,
    "rsaquo" => 8250,
    "oline" => 8254,
    "frasl" => 8260,
    "euro" => 8364,
    "trade" => 8482,
    "larr" => 8592,
    "uarr" => 8593,
    "rarr" => 8594,
    "darr" => 8595,
    "harr" => 8596,
    "minus" => 8722,
    "infin" => 8734,
    "ne" => 8800,
    "le" => 8804,
    "ge" => 8805,
    "spades" => 9824,
    "clubs" => 9827,
    "hearts" => 9829,
    "diams" => 9830
  }

  @entities @latin1_entities
            |> Enum.with_index(160)
            |> Map.new()
            |> Map.merge(@other_entities)

  @entity_regex ~r/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{0,31});/

  # Tags whose boundaries separate words (block-level elements and breaks).
  @block_tags ~w(address article aside blockquote br dd div dl dt figcaption figure footer
                 h1 h2 h3 h4 h5 h6 header hr img li main nav ol p pre section table tbody td
                 tfoot th thead tr ul)

  @doc """
  Returns the code point for a named HTML entity, or `nil` when unknown.
  """
  @spec entity_codepoint(String.t()) :: non_neg_integer() | nil
  def entity_codepoint(name), do: Map.get(@entities, name)

  @doc """
  Decodes named (common HTML set) and numeric character references.

  Unknown entities and references to invalid code points are left untouched.
  """
  @spec decode_entities(String.t() | nil) :: String.t()
  def decode_entities(nil), do: ""

  def decode_entities(text) when is_binary(text) do
    if String.contains?(text, "&") do
      Regex.replace(@entity_regex, text, fn whole, ref -> decode_reference(ref) || whole end)
    else
      text
    end
  end

  defp decode_reference("#" <> <<x, hex::binary>>) when x in [?x, ?X],
    do: codepoint_to_string(String.to_integer(hex, 16))

  defp decode_reference("#" <> dec), do: codepoint_to_string(String.to_integer(dec))

  defp decode_reference(name) do
    case Map.get(@entities, name) do
      nil -> nil
      codepoint -> <<codepoint::utf8>>
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

  Scripts, styles and comments are removed, tags are stripped, entities are
  decoded and whitespace is collapsed. Double-escaped HTML (e.g. `&lt;p&gt;`)
  is handled as well.
  """
  @spec to_text(String.t() | nil) :: String.t()
  def to_text(nil), do: ""

  def to_text(html) when is_binary(html) do
    text = html |> strip_tags() |> decode_entities()
    text = if contains_tags?(text), do: text |> strip_tags() |> decode_entities(), else: text

    text
    |> String.replace(~r/[\x{00A0}\x{2000}-\x{200B}\x{202F}\x{205F}\x{3000}]/u, " ")
    |> String.replace(~r/[\x{200C}-\x{200F}\x{FEFF}]/u, "")
    |> String.replace(~r/\s+/u, " ")
    |> String.trim()
  end

  defp contains_tags?(text), do: Regex.match?(~r/<\/?[a-zA-Z][^<>]*>/, text)

  defp strip_tags(html) do
    html = String.replace(html, ~r/<!--.*?-->/s, " ")

    html =
      String.replace(
        html,
        ~r/<(script|style|noscript|iframe|template)\b[^>]*>.*?<\/\1\s*>/is,
        " "
      )

    Regex.replace(~r/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/, html, fn _whole, tag ->
      if String.downcase(tag) in @block_tags, do: " ", else: ""
    end)
  end

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
  document order. Data URIs and tracking pixels (1x1 images) are skipped.
  """
  @spec image_urls(String.t() | nil) :: [String.t()]
  def image_urls(nil), do: []

  def image_urls(html) when is_binary(html) do
    # Escaped HTML (e.g. RSS descriptions without CDATA) is decoded first.
    html = if String.contains?(html, "&lt;img"), do: decode_entities(html), else: html

    ~r/<img\b[^>]*>/i
    |> Regex.scan(html)
    |> Enum.map(fn [tag] -> attributes(tag) end)
    |> Enum.reject(&tracking_pixel?/1)
    |> Enum.map(fn attrs ->
      [attrs["src"], attrs["data-src"], attrs["data-lazy-src"], first_srcset_url(attrs["srcset"])]
      |> Enum.map(fn source ->
        if is_binary(source), do: source |> decode_entities() |> String.trim()
      end)
      |> Enum.find(&valid_image_source?/1)
    end)
    |> Enum.reject(&is_nil/1)
  end

  @doc """
  Parses the attributes of a single HTML start tag into a map with lowercase
  attribute names. The first occurrence of an attribute wins.
  """
  @spec attributes(String.t()) :: %{String.t() => String.t()}
  def attributes(tag) when is_binary(tag) do
    ~r/\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/
    |> Regex.scan(tag)
    |> Enum.reduce(%{}, fn [_, name | values], acc ->
      value = Enum.find(values, "", &(&1 != ""))
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
end
