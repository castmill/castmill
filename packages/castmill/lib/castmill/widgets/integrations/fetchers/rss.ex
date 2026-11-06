defmodule Castmill.Widgets.Integrations.Fetchers.Rss do
  @moduledoc """
  Feed fetcher for news widget integrations.

  Downloads a syndication feed and normalises it into a widget friendly
  structure with plain-text titles and descriptions, images, links, authors,
  categories and dates, sorted newest first.

  ## Supported formats

  - RSS 2.0, 0.91 and 0.92
  - RSS 1.0 (RDF)
  - Atom 1.0 and 0.3
  - JSON Feed 1.0 and 1.1
  - HTML pages that advertise a feed with `<link rel="alternate">`
    (feed autodiscovery), so users can paste a website address

  ## Features

  - Images from Media RSS (`media:content`, `media:group`, `media:thumbnail`,
    choosing the largest), image enclosures, `itunes:image`, Atom enclosure
    links, JSON Feed images/attachments and, as a fallback, the first `<img>`
    in the item content. Relative URLs are resolved and tracking pixels are
    ignored.
  - HTML is converted to clean, single-line text with entities decoded;
    descriptions fall back to the full content (`content:encoded`, Atom
    content) and are truncated at a word boundary.
  - RFC 822 dates with numeric offsets or named time zones and ISO 8601 dates
    are normalised to UTC.
  - Duplicate items (same id/link) are removed.
  - Safe by design: SSRF protection, redirect validation, size limits,
    decompression bomb protection and an XML parser that never loads DTDs,
    expands entities or creates atoms. See `Castmill.Widgets.Integrations.Rss.Http`
    and `Castmill.Widgets.Integrations.Rss.Xml`.

  ## Options

  - `feed_url` (required): URL of the feed or of a web page advertising one.
    URLs without a scheme default to `https://`, `feed://` URLs are accepted.

  The fetched data is shared by every widget using the same feed, so it always
  contains up to 100 items; each widget instance limits the list with its
  own `max_items` option when the data is served.

  ## Data

      %{
        "feedTitle" => "Example News",
        "feedDescription" => "Latest headlines",
        "feedLink" => "https://example.com/",
        "feedImage" => "https://example.com/logo.png" | nil,
        "feedLanguage" => "en",
        "feedFormat" => "rss" | "rdf" | "atom" | "json",
        "lastUpdated" => 1735732800,
        "items" => [
          %{
            "id" => "https://example.com/story",
            "title" => "Headline",
            "description" => "Plain text summary…",
            "link" => "https://example.com/story",
            "image" => "https://example.com/story.jpg",
            "imageUrl" => "https://example.com/story.jpg",
            "author" => "Jane Doe",
            "categories" => ["World"],
            "source" => "Example News",
            "pubDate" => "2025-01-01T12:00:00Z",
            "pubDateFormatted" => "Jan 1, 2025"
          }
        ]
      }

  String fields are always present (empty when unknown).
  """
  @behaviour Castmill.Widgets.Integrations.Fetcher

  alias Castmill.Widgets.Integrations.Rss.{DateParser, Html, Http, Xml}

  require Logger

  # Cache a reasonable number of items - individual widget instances
  # filter to their own max_items setting when the data is served.
  @cache_max_items 100
  @title_max_length 300
  @description_max_length 500
  @max_categories 10

  @feed_link_types ~w(application/rss+xml application/atom+xml application/rdf+xml
                      application/feed+json application/json text/xml application/xml)

  @image_extensions ~w(.jpg .jpeg .png .gif .webp .avif .bmp .svg)
  @non_image_extensions ~w(.mp4 .m4v .mov .webm .mkv .avi .m3u8 .mpd .mp3 .m4a .aac .ogg .oga
                           .wav .flac .pdf)

  @impl true
  def fetch(credentials, options) do
    case normalize_feed_url(Map.get(options, "feed_url")) do
      nil ->
        {:error, :missing_feed_url, credentials}

      feed_url ->
        case fetch_feed(feed_url, true) do
          {:ok, feed} ->
            {:ok, Map.put(feed, "lastUpdated", System.system_time(:second)), credentials}

          {:error, reason} ->
            # Only the host is logged; feed URLs may contain private tokens.
            Logger.warning("RSS fetch failed for host #{host(feed_url)}: #{inspect(reason)}")
            {:error, reason, credentials}
        end
    end
  end

  @doc """
  Parses a feed document (RSS, RDF, Atom or JSON Feed).

  ## Options

  - `:base_url` - URL the document was fetched from, used to resolve relative
    links and images.
  - `:max_items` - maximum number of items to return (default: #{@cache_max_items}).
  """
  @spec parse(binary(), keyword()) :: {:ok, map()} | {:error, atom()}
  def parse(document, opts \\ []) when is_binary(document) do
    ctx = %{
      base_url: Keyword.get(opts, :base_url),
      max_items: Keyword.get(opts, :max_items, @cache_max_items)
    }

    document = skip_whitespace(document)

    case document do
      "{" <> _ ->
        parse_json_feed(document, ctx)

      "" ->
        {:error, :unknown_feed_format}

      _ ->
        with {:ok, root} <- Xml.parse(document) do
          parse_xml_feed(root, ctx)
        end
    end
  end

  # ==========================================================================
  # Fetching
  # ==========================================================================

  defp fetch_feed(url, discover?) do
    with {:ok, %{body: body, url: final_url}} <- Http.get(url) do
      case parse(body, base_url: final_url) do
        {:ok, feed} ->
          {:ok, feed}

        {:error, reason} ->
          discovered = if discover? and html?(body), do: discover_feed_url(body, final_url)

          if discovered && discovered != final_url do
            fetch_feed(discovered, false)
          else
            {:error, reason}
          end
      end
    end
  end

  defp normalize_feed_url(url) when is_binary(url) do
    url = url |> String.trim() |> String.replace(~r/^feed:(\/\/)?/i, "")

    cond do
      url == "" -> nil
      Regex.match?(~r/^[a-z][a-z0-9+.\-]*:\/\//i, url) -> url
      true -> "https://" <> url
    end
  end

  defp normalize_feed_url(_), do: nil

  defp host(url) do
    case URI.parse(url) do
      %URI{host: host} when is_binary(host) -> host
      _ -> "unknown"
    end
  end

  defp html?(body) do
    head = binary_part(body, 0, min(byte_size(body), 4096))
    Regex.match?(~r/<!doctype\s+html|<html[\s>]|<head[\s>]/i, head)
  end

  defp discover_feed_url(html, base_url) do
    ~r/<link\b[^>]*>/i
    |> Regex.scan(html)
    |> Enum.map(fn [tag] -> Html.attributes(tag) end)
    |> Enum.find(fn attrs ->
      rels = attrs |> Map.get("rel", "") |> String.downcase() |> String.split()

      "alternate" in rels and
        String.downcase(Map.get(attrs, "type", "")) in @feed_link_types and
        Map.get(attrs, "href", "") != ""
    end)
    |> case do
      nil -> nil
      attrs -> absolute_url(Html.decode_entities(attrs["href"]), base_url)
    end
  end

  defp skip_whitespace(<<0xEF, 0xBB, 0xBF, rest::binary>>), do: skip_whitespace(rest)

  defp skip_whitespace(<<c, rest::binary>>) when c in [?\s, ?\t, ?\r, ?\n],
    do: skip_whitespace(rest)

  defp skip_whitespace(rest), do: rest

  # ==========================================================================
  # XML feeds
  # ==========================================================================

  defp parse_xml_feed(root, ctx) do
    case Xml.name(root) do
      "rss" ->
        channel = Xml.child(root, "channel")
        parse_rss(channel, root, Xml.children(channel, "item"), "rss", ctx)

      "rdf:RDF" ->
        channel = Xml.child(root, "channel")
        parse_rss(channel, root, Xml.children(root, "item"), "rdf", ctx)

      name when name in ["atom:feed", "feed"] ->
        parse_atom(root, ctx)

      _ ->
        {:error, :unknown_feed_format}
    end
  end

  # --------------------------------------------------------------------------
  # RSS 0.9x / 2.0 / 1.0
  # --------------------------------------------------------------------------

  defp parse_rss(nil, _root, _items, _format, _ctx), do: {:error, :unknown_feed_format}

  defp parse_rss(channel, root, items, format, ctx) do
    feed_link =
      first_present([
        Xml.child_text(channel, "link"),
        atom_link(channel, "alternate")
      ])
      |> absolute_url(ctx.base_url)

    ctx = %{ctx | base_url: ctx.base_url || feed_link}
    title = Html.to_text(Xml.child_text(channel, ["title", "dc:title"]))

    feed = %{
      "feedTitle" => title,
      "feedDescription" =>
        Html.to_text(Xml.child_text(channel, ["description", "dc:description", "itunes:summary"])),
      "feedLink" => feed_link || "",
      "feedImage" => rss_feed_image(channel, root, ctx),
      "feedLanguage" => Xml.child_text(channel, ["language", "dc:language"]),
      "feedFormat" => format
    }

    items
    |> Enum.map(&rss_item(&1, Map.put(ctx, :feed_title, title)))
    |> finalize(feed, ctx)
  end

  defp rss_feed_image(channel, root, ctx) do
    image = Xml.child(channel, "image") || Xml.child(root, "image")

    [
      Xml.child_text(image, "url"),
      Xml.attr(image, "rdf:resource"),
      Xml.attr(Xml.child(channel, "itunes:image"), "href"),
      Xml.child_text(channel, ["atom:logo", "atom:icon"])
    ]
    |> Enum.find_value(&absolute_url(&1, ctx.base_url))
  end

  defp rss_item(item, ctx) do
    link =
      first_present([
        Xml.child_text(item, "link"),
        atom_link(item, "alternate"),
        permalink_guid(item),
        Xml.attr(item, "rdf:about")
      ])
      |> absolute_url(ctx.base_url)

    raw_description =
      Xml.child_text(item, ["description", "dc:description", "itunes:summary", "atom:summary"])

    raw_content = Xml.child_text(item, ["content:encoded", "atom:content"])

    %{
      id: first_present([Xml.child_text(item, ["guid", "atom:id"]), link]),
      title: Xml.child_text(item, ["title", "dc:title"]),
      raw_description: raw_description,
      raw_content: raw_content,
      link: link,
      image_candidates:
        media_images(item) ++
          enclosure_images(item) ++
          atom_enclosure_images(item) ++
          [Xml.attr(Xml.child(item, "itunes:image"), "href"), item_image_element(item)],
      html_sources: [raw_content, raw_description],
      date:
        Xml.child_text(item, [
          "pubDate",
          "dc:date",
          "atom:published",
          "atom:updated",
          "dcterms:created",
          "dcterms:modified"
        ]),
      author:
        Xml.child_text(item, ["dc:creator", "author", "itunes:author"])
        |> then(&first_present([&1, atom_author(item)])),
      categories:
        Enum.map(Xml.children(item, ["category", "dc:subject"]), &Xml.text/1) ++
          Enum.map(Xml.children(item, "atom:category"), &atom_category/1),
      source: Xml.child_text(item, "source")
    }
    |> build_item(ctx)
  end

  defp permalink_guid(item) do
    case Xml.child(item, "guid") do
      nil ->
        nil

      guid ->
        text = Xml.text(guid)

        if Xml.attr(guid, "isPermaLink") != "false" and String.match?(text, ~r/^https?:\/\//i),
          do: text
    end
  end

  defp item_image_element(item) do
    case Xml.child(item, "image") do
      nil -> nil
      image -> first_present([Xml.child_text(image, "url"), Xml.text(image)])
    end
  end

  defp enclosure_images(item) do
    item
    |> Xml.children("enclosure")
    |> Enum.filter(&image_reference?(Xml.attr(&1, "type"), nil, Xml.attr(&1, "url"), false))
    |> Enum.map(&Xml.attr(&1, "url"))
  end

  # --------------------------------------------------------------------------
  # Atom
  # --------------------------------------------------------------------------

  defp parse_atom(feed, ctx) do
    feed_link = atom_link(feed, "alternate") |> absolute_url(ctx.base_url)
    ctx = %{ctx | base_url: ctx.base_url || feed_link}
    title = Html.to_text(Xml.child_text(feed, ["atom:title", "title"]))

    feed_data = %{
      "feedTitle" => title,
      "feedDescription" =>
        Html.to_text(
          Xml.child_text(feed, ["atom:subtitle", "subtitle", "atom:tagline", "tagline"])
        ),
      "feedLink" => feed_link || "",
      "feedImage" =>
        [
          Xml.child_text(feed, ["atom:logo", "logo"]),
          Xml.child_text(feed, ["atom:icon", "icon"]),
          Xml.attr(Xml.child(feed, "itunes:image"), "href")
        ]
        |> Enum.find_value(&absolute_url(&1, ctx.base_url)),
      "feedLanguage" => Xml.attr(feed, "xml:lang") || "",
      "feedFormat" => "atom"
    }

    ctx = Map.merge(ctx, %{feed_title: title, feed_author: atom_author(feed)})

    feed
    |> Xml.children(["atom:entry", "entry"])
    |> Enum.map(&atom_entry(&1, ctx))
    |> finalize(feed_data, ctx)
  end

  defp atom_entry(entry, ctx) do
    link = atom_link(entry, "alternate") |> absolute_url(ctx.base_url)
    summary = Xml.child(entry, ["atom:summary", "summary"])
    content = Xml.child(entry, ["atom:content", "content"])
    source = Xml.child(entry, ["atom:source", "source"])

    %{
      id: first_present([Xml.child_text(entry, ["atom:id", "id"]), link]),
      title: Xml.child_text(entry, ["atom:title", "title"]),
      raw_description: xhtml_text(summary),
      raw_content: xhtml_text(content),
      link: link,
      image_candidates:
        media_images(entry) ++
          atom_enclosure_images(entry) ++
          embedded_images(content) ++ embedded_images(summary),
      html_sources: [xhtml_text(content), xhtml_text(summary)],
      date:
        Xml.child_text(entry, [
          "atom:published",
          "published",
          "atom:issued",
          "issued",
          "atom:updated",
          "updated",
          "atom:modified",
          "modified",
          "dc:date"
        ]),
      author:
        first_present([atom_author(entry), Xml.child_text(entry, "dc:creator"), ctx[:feed_author]]),
      categories:
        Enum.map(Xml.children(entry, ["atom:category", "category"]), &atom_category/1) ++
          Enum.map(Xml.children(entry, "dc:subject"), &Xml.text/1),
      source: Xml.child_text(source, ["atom:title", "title"])
    }
    |> build_item(ctx)
  end

  defp atom_link(element, rel) do
    links = Xml.children(element, ["atom:link", "link"])

    matching =
      Enum.filter(links, fn link ->
        (Xml.attr(link, "rel") || "alternate") == rel and present?(Xml.attr(link, "href"))
      end)

    preferred =
      Enum.find(matching, &String.contains?(Xml.attr(&1, "type") || "text/html", "html")) ||
        List.first(matching)

    Xml.attr(preferred, "href")
  end

  defp atom_author(element) do
    element
    |> Xml.children(["atom:author", "author"])
    |> Enum.map(&Xml.child_text(&1, ["atom:name", "name"]))
    |> Enum.find(&present?/1)
  end

  defp atom_category(category) do
    first_present([Xml.attr(category, "label"), Xml.attr(category, "term"), Xml.text(category)])
  end

  defp atom_enclosure_images(element) do
    element
    |> Xml.children(["atom:link", "link"])
    |> Enum.filter(fn link ->
      Xml.attr(link, "rel") == "enclosure" and
        image_reference?(Xml.attr(link, "type"), nil, Xml.attr(link, "href"), false)
    end)
    |> Enum.map(&Xml.attr(&1, "href"))
  end

  # Images embedded in XHTML content (type="xhtml") are parsed as elements.
  defp embedded_images(nil), do: []

  defp embedded_images({name, attrs, children}) do
    own =
      if (name == "img" or String.ends_with?(name, ":img")) and
           not tracking_pixel?(attrs["width"], attrs["height"]) do
        [Map.get(attrs, "src")]
      else
        []
      end

    own ++ Enum.flat_map(Enum.filter(children, &is_tuple/1), &embedded_images/1)
  end

  defp xhtml_text(nil), do: ""

  defp xhtml_text({_name, _attrs, children}) do
    Enum.map_join(children, "", fn
      {name, _attrs, _children} = element ->
        text = xhtml_text(element)
        if block_element?(name), do: " " <> text <> " ", else: text

      text when is_binary(text) ->
        text
    end)
  end

  defp block_element?(name) do
    name
    |> String.split(":")
    |> List.last()
    |> then(&(&1 in ~w(address article aside blockquote br dd div dl dt figcaption figure footer
                        h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table tbody td
                        tfoot th thead tr ul)))
  end

  defp tracking_pixel?(width, height), do: width in ["0", "1"] or height in ["0", "1"]

  # --------------------------------------------------------------------------
  # Media RSS (shared by RSS and Atom)
  # --------------------------------------------------------------------------

  defp media_images(element) do
    groups = Xml.children(element, "media:group")

    contents =
      Xml.children(element, "media:content") ++
        Enum.flat_map(groups, &Xml.children(&1, "media:content"))

    images =
      contents
      |> Enum.filter(fn content ->
        image_reference?(
          Xml.attr(content, "type"),
          Xml.attr(content, "medium"),
          Xml.attr(content, "url"),
          true
        )
      end)
      |> Enum.reject(&tracking_pixel?(Xml.attr(&1, "width"), Xml.attr(&1, "height")))
      |> largest_first()

    thumbnails =
      ([element | groups] ++ contents)
      |> Enum.flat_map(&Xml.children(&1, "media:thumbnail"))
      |> Enum.reject(&tracking_pixel?(Xml.attr(&1, "width"), Xml.attr(&1, "height")))
      |> largest_first()

    Enum.map(images ++ thumbnails, &Xml.attr(&1, "url"))
  end

  defp largest_first(elements) do
    Enum.sort_by(elements, &(-dimension(Xml.attr(&1, "width"))))
  end

  defp dimension(nil), do: 0

  defp dimension(value) do
    case Integer.parse(value) do
      {number, _} -> number
      :error -> 0
    end
  end

  # Decides whether a media reference points to an image. `lenient` treats
  # references without type information as images unless the URL has a
  # known non-image extension (Media RSS content often omits the type).
  defp image_reference?(type, medium, url, lenient) do
    type = String.downcase(type || "")
    medium = String.downcase(medium || "")
    extension = url_extension(url)

    cond do
      not present?(url) -> false
      medium == "image" -> true
      medium != "" -> false
      String.starts_with?(type, "image/") -> true
      type != "" -> false
      extension in @image_extensions -> true
      extension in @non_image_extensions -> false
      true -> lenient
    end
  end

  defp url_extension(nil), do: ""

  defp url_extension(url) do
    case URI.parse(url) do
      %URI{path: path} when is_binary(path) -> path |> Path.extname() |> String.downcase()
      _ -> ""
    end
  rescue
    _ -> ""
  end

  # ==========================================================================
  # JSON Feed
  # ==========================================================================

  defp parse_json_feed(document, ctx) do
    with {:ok, %{"version" => version} = json} when is_binary(version) <- Jason.decode(document),
         true <- String.contains?(version, "jsonfeed.org") do
      feed_link = string(json["home_page_url"]) |> absolute_url(ctx.base_url)
      title = Html.to_text(string(json["title"]))
      ctx = %{ctx | base_url: ctx.base_url || feed_link}

      feed = %{
        "feedTitle" => title,
        "feedDescription" => Html.to_text(string(json["description"])),
        "feedLink" => feed_link || "",
        "feedImage" =>
          Enum.find_value(
            [string(json["icon"]), string(json["favicon"])],
            &absolute_url(&1, ctx.base_url)
          ),
        "feedLanguage" => string(json["language"]),
        "feedFormat" => "json"
      }

      ctx = Map.merge(ctx, %{feed_title: title, feed_author: json_author(json)})

      json["items"]
      |> List.wrap()
      |> Enum.filter(&is_map/1)
      |> Enum.map(&json_item(&1, ctx))
      |> finalize(feed, ctx)
    else
      _ -> {:error, :unknown_feed_format}
    end
  end

  defp json_item(item, ctx) do
    link =
      first_present([string(item["url"]), string(item["external_url"])])
      |> absolute_url(ctx.base_url)

    content = first_present([string(item["content_html"]), string(item["content_text"])]) || ""

    attachments =
      item["attachments"]
      |> List.wrap()
      |> Enum.filter(
        &(is_map(&1) and image_reference?(string(&1["mime_type"]), nil, string(&1["url"]), false))
      )
      |> Enum.map(&string(&1["url"]))

    %{
      id: first_present([string(item["id"]), link]),
      title: string(item["title"]),
      raw_description: string(item["summary"]),
      raw_content: content,
      link: link,
      image_candidates: [string(item["image"]), string(item["banner_image"])] ++ attachments,
      html_sources: [string(item["content_html"])],
      date: first_present([string(item["date_published"]), string(item["date_modified"])]),
      author: first_present([json_author(item), ctx[:feed_author]]),
      categories: item["tags"] |> List.wrap() |> Enum.map(&string/1),
      source: ""
    }
    |> build_item(ctx)
  end

  defp json_author(map) do
    authors = List.wrap(map["authors"]) ++ List.wrap(map["author"])

    authors
    |> Enum.filter(&is_map/1)
    |> Enum.map(&string(&1["name"]))
    |> Enum.find(&present?/1)
  end

  defp string(value) when is_binary(value), do: value
  defp string(value) when is_integer(value) or is_float(value), do: to_string(value)
  defp string(_), do: ""

  # ==========================================================================
  # Normalisation
  # ==========================================================================

  defp build_item(fields, ctx) do
    title = fields.title |> Html.to_text() |> Html.truncate(@title_max_length)

    description =
      [fields.raw_description, fields.raw_content]
      |> Enum.map(&Html.to_text/1)
      |> Enum.find("", &present?/1)
      |> then(fn text -> if text == title, do: "", else: text end)
      |> Html.truncate(@description_max_length)

    image =
      (fields.image_candidates ++ Enum.flat_map(fields.html_sources, &Html.image_urls/1))
      |> Enum.find_value("", &absolute_url(&1, fields.link || ctx.base_url))

    {datetime, pub_date, pub_date_formatted} =
      case DateParser.parse(fields.date) do
        {:ok, datetime} ->
          {datetime, DateTime.to_iso8601(datetime), DateParser.format(datetime)}

        :error ->
          raw = String.trim(fields.date || "")
          {nil, raw, raw}
      end

    item = %{
      "id" => fields.id || "",
      "title" => title,
      "description" => description,
      "link" => fields.link || "",
      "image" => image,
      "imageUrl" => image,
      "author" => clean_author(fields.author),
      "categories" => clean_categories(fields.categories),
      "source" => first_present([Html.to_text(fields.source), ctx[:feed_title]]) || "",
      "pubDate" => pub_date,
      "pubDateFormatted" => pub_date_formatted
    }

    {item, datetime}
  end

  defp finalize(items, feed, ctx) do
    items =
      items
      |> Enum.reject(fn {item, _} -> item["title"] == "" and item["description"] == "" end)
      |> Enum.uniq_by(fn {item, _} -> dedupe_key(item) end)
      |> Enum.sort_by(fn
        {_item, nil} -> {1, 0}
        {_item, datetime} -> {0, -DateTime.to_unix(datetime)}
      end)
      |> Enum.take(ctx.max_items)
      |> Enum.map(fn {item, _datetime} -> item end)

    {:ok, Map.put(feed, "items", items)}
  end

  defp dedupe_key(item) do
    cond do
      present?(item["id"]) -> {:id, item["id"]}
      present?(item["link"]) -> {:link, item["link"]}
      true -> {:content, item["title"], item["description"], item["pubDate"]}
    end
  end

  defp clean_author(nil), do: ""

  defp clean_author(author) do
    text = Html.to_text(author)

    cond do
      match = Regex.run(~r/^\S+@\S+\s*\((.+)\)$/, text) -> match |> List.last() |> String.trim()
      Regex.match?(~r/^\S+@\S+\.\S+$/, text) -> ""
      true -> text
    end
  end

  defp clean_categories(categories) do
    categories
    |> Enum.map(&Html.to_text/1)
    |> Enum.filter(&present?/1)
    |> Enum.uniq()
    |> Enum.take(@max_categories)
  end

  # Resolves `url` against `base` and only accepts http(s) results.
  defp absolute_url(url, base) when is_binary(url) do
    url = url |> Html.decode_entities() |> String.trim()

    resolved =
      cond do
        url == "" -> nil
        Regex.match?(~r/^https?:\/\//i, url) -> url
        is_binary(base) and base != "" -> Http.resolve(base, url)
        true -> nil
      end

    with resolved when is_binary(resolved) <- resolved,
         {:ok, _uri} <- Http.validate_url(resolved) do
      resolved
    else
      _ -> nil
    end
  end

  defp absolute_url(_url, _base), do: nil

  defp first_present(values), do: Enum.find(values, &present?/1)

  defp present?(value), do: is_binary(value) and String.trim(value) != ""
end
