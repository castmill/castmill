defmodule Castmill.Widgets.Integrations.Fetchers.Rss do
  @moduledoc """
  RSS/Atom feed fetcher for News widget integrations.

  Fetches and parses RSS 2.0 and Atom feeds, extracting news items with their
  titles, descriptions, images, publication dates, and links.

  Uses the SweetXml library for clean, maintainable XML parsing.

  ## Features

  - Supports RSS 2.0 and Atom feed formats
  - Extracts media:content images (RSS) and enclosures
  - Parses multiple date formats (RFC822, ISO8601)
  - Configurable item limit
  - HTML stripping from descriptions

  ## Options

  - `feed_url`: URL of the RSS/Atom feed (required)
  - `max_items`: Maximum number of items to fetch (default: 10)
  """
  @behaviour Castmill.Widgets.Integrations.Fetcher

  import SweetXml

  require Logger

  # Cache a reasonable number of items - individual widget instances
  # can filter to their own max_items setting when serving data
  @cache_max_items 100
  @default_timeout 15_000

  @impl true
  def fetch(credentials, options) do
    feed_url = Map.get(options, "feed_url", "")
    # Always fetch up to @cache_max_items for caching
    # The backend will filter to each widget's max_items when serving
    max_items = @cache_max_items

    if feed_url == "" do
      {:error, :missing_feed_url, credentials}
    else
      case fetch_feed(feed_url) do
        {:ok, xml_content} ->
          case parse_feed(xml_content, max_items) do
            {:ok, feed_data} ->
              data = Map.put(feed_data, "lastUpdated", System.system_time(:second))
              {:ok, data, credentials}

            {:error, reason} ->
              Logger.error("RSS parse error for #{feed_url}: #{inspect(reason)}")
              {:error, reason, credentials}
          end

        {:error, reason} ->
          Logger.error("RSS fetch error for #{feed_url}: #{inspect(reason)}")
          {:error, reason, credentials}
      end
    end
  end

  # ============================================================================
  # HTTP FETCHING
  # ============================================================================

  defp fetch_feed(url) do
    headers = [
      {"Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml"},
      {"User-Agent", "Castmill/1.0 RSS Reader"}
    ]

    case HTTPoison.get(url, headers, recv_timeout: @default_timeout, follow_redirect: true) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        {:ok, body}

      {:ok, %HTTPoison.Response{status_code: 301, headers: resp_headers}} ->
        handle_redirect(resp_headers)

      {:ok, %HTTPoison.Response{status_code: 302, headers: resp_headers}} ->
        handle_redirect(resp_headers)

      {:ok, %HTTPoison.Response{status_code: status}} ->
        {:error, {:http_error, status}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, {:network_error, reason}}
    end
  end

  defp handle_redirect(headers) do
    case List.keyfind(headers, "Location", 0) || List.keyfind(headers, "location", 0) do
      {_, location} -> fetch_feed(location)
      nil -> {:error, :redirect_without_location}
    end
  end

  # ============================================================================
  # XML PARSING WITH SWEETXML
  # ============================================================================

  defp parse_feed(xml_content, max_items) do
    try do
      cond do
        is_rss_feed?(xml_content) -> parse_rss(xml_content, max_items)
        is_atom_feed?(xml_content) -> parse_atom(xml_content, max_items)
        true -> {:error, :unknown_feed_format}
      end
    rescue
      e ->
        Logger.error("XML parsing error: #{inspect(e)}")
        {:error, :xml_parse_error}
    catch
      :exit, reason ->
        Logger.error("XML parsing exit: #{inspect(reason)}")
        {:error, :xml_parse_error}
    end
  end

  defp is_rss_feed?(xml), do: String.contains?(xml, "<rss")
  defp is_atom_feed?(xml), do: String.contains?(xml, "<feed")

  # ============================================================================
  # RSS 2.0 PARSING
  # ============================================================================

  defp parse_rss(xml_content, max_items) do
    feed_info =
      xml_content
      |> xpath(
        ~x"//channel"e,
        title: ~x"./title/text()"s,
        description: ~x"./description/text()"s,
        image: ~x"./image/url/text()"s
      )

    items =
      xml_content
      |> xpath(
        ~x"//channel/item"el,
        title: ~x"./title/text()"s,
        description: ~x"./description/text()"s,
        link: ~x"./link/text()"s,
        pub_date: ~x"./pubDate/text()"s,
        author: ~x"./author/text()"s,
        dc_creator: ~x"./*[local-name()='creator']/text()"s,
        # media:content is used by some feeds (e.g., NPR)
        media_content_url: ~x"./*[local-name()='content']/@url"s,
        # media:thumbnail is used by BBC and many other feeds
        media_thumbnail_url: ~x"./*[local-name()='thumbnail']/@url"s,
        enclosure_url: ~x"./enclosure/@url"s
      )
      |> Enum.take(max_items)
      |> Enum.map(&format_rss_item/1)

    {:ok,
     %{
       "items" => items,
       "feedTitle" => feed_info[:title] || "",
       "feedDescription" => strip_html(feed_info[:description] || ""),
       "feedImage" => feed_info[:image]
     }}
  end

  defp format_rss_item(item) do
    {pub_date, pub_date_formatted} = parse_pub_date(item[:pub_date])
    author = if item[:author] != "", do: item[:author], else: item[:dc_creator]
    # Try media:content first, then media:thumbnail (BBC), then enclosure
    image_url =
      cond do
        item[:media_content_url] != "" -> item[:media_content_url]
        item[:media_thumbnail_url] != "" -> item[:media_thumbnail_url]
        item[:enclosure_url] != "" -> item[:enclosure_url]
        true -> ""
      end

    %{
      "title" => item[:title] || "",
      "description" => strip_html(item[:description] || ""),
      "link" => item[:link] || "",
      "imageUrl" => image_url || "",
      "pubDate" => pub_date,
      "pubDateFormatted" => pub_date_formatted,
      "author" => author || ""
    }
  end

  # ============================================================================
  # ATOM PARSING
  # ============================================================================

  defp parse_atom(xml_content, max_items) do
    feed_info =
      xml_content
      |> xpath(
        ~x"//*[local-name()='feed']"e,
        title: ~x"./*[local-name()='title']/text()"s,
        subtitle: ~x"./*[local-name()='subtitle']/text()"s
      )

    items =
      xml_content
      |> xpath(
        ~x"//*[local-name()='feed']/*[local-name()='entry']"el,
        title: ~x"./*[local-name()='title']/text()"s,
        summary: ~x"./*[local-name()='summary']/text()"s,
        content: ~x"./*[local-name()='content']/text()"s,
        link_alternate: ~x"./*[local-name()='link'][@rel='alternate']/@href"s,
        link_default: ~x"./*[local-name()='link']/@href"s,
        published: ~x"./*[local-name()='published']/text()"s,
        updated: ~x"./*[local-name()='updated']/text()"s,
        author_name: ~x"./*[local-name()='author']/*[local-name()='name']/text()"s
      )
      |> Enum.take(max_items)
      |> Enum.map(&format_atom_entry/1)

    {:ok,
     %{
       "items" => items,
       "feedTitle" => feed_info[:title] || "",
       "feedDescription" => strip_html(feed_info[:subtitle] || ""),
       "feedImage" => nil
     }}
  end

  defp format_atom_entry(entry) do
    date_str = if entry[:published] != "", do: entry[:published], else: entry[:updated]
    {pub_date, pub_date_formatted} = parse_pub_date(date_str)
    link = if entry[:link_alternate] != "", do: entry[:link_alternate], else: entry[:link_default]
    description = if entry[:summary] != "", do: entry[:summary], else: entry[:content]

    %{
      "title" => entry[:title] || "",
      "description" => strip_html(description || ""),
      "link" => link || "",
      "imageUrl" => "",
      "pubDate" => pub_date,
      "pubDateFormatted" => pub_date_formatted,
      "author" => entry[:author_name] || ""
    }
  end

  # ============================================================================
  # DATE PARSING
  # ============================================================================

  defp parse_pub_date(nil), do: {"", ""}
  defp parse_pub_date(""), do: {"", ""}

  defp parse_pub_date(date_string) do
    cond do
      # ISO 8601 format (Atom feeds)
      String.match?(date_string, ~r/^\d{4}-\d{2}-\d{2}/) ->
        parse_iso8601(date_string)

      # RFC 822 format (RSS feeds)
      String.match?(date_string, ~r/^\w{3},?\s+\d{1,2}\s+\w{3}\s+\d{4}/) ->
        parse_rfc822(date_string)

      true ->
        {date_string, date_string}
    end
  end

  defp parse_iso8601(date_string) do
    case DateTime.from_iso8601(date_string) do
      {:ok, datetime, _} ->
        iso = DateTime.to_iso8601(datetime)
        formatted = Calendar.strftime(datetime, "%b %-d, %Y")
        {iso, formatted}

      _ ->
        # Try parsing just the date part
        case Date.from_iso8601(String.slice(date_string, 0, 10)) do
          {:ok, date} ->
            formatted = Calendar.strftime(date, "%b %-d, %Y")
            {date_string, formatted}

          _ ->
            {date_string, date_string}
        end
    end
  end

  defp parse_rfc822(date_string) do
    # Parse RFC 822 date format: "Wed, 01 Jan 2025 12:00:00 +0000"
    months = %{
      "Jan" => 1,
      "Feb" => 2,
      "Mar" => 3,
      "Apr" => 4,
      "May" => 5,
      "Jun" => 6,
      "Jul" => 7,
      "Aug" => 8,
      "Sep" => 9,
      "Oct" => 10,
      "Nov" => 11,
      "Dec" => 12
    }

    regex = ~r/(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/

    case Regex.run(regex, date_string) do
      [_, day, month_str, year, hour, minute, second] ->
        month = months[month_str] || 1

        case NaiveDateTime.new(
               String.to_integer(year),
               month,
               String.to_integer(day),
               String.to_integer(hour),
               String.to_integer(minute),
               String.to_integer(second)
             ) do
          {:ok, naive_dt} ->
            datetime = DateTime.from_naive!(naive_dt, "Etc/UTC")
            iso = DateTime.to_iso8601(datetime)
            formatted = Calendar.strftime(datetime, "%b %-d, %Y")
            {iso, formatted}

          _ ->
            {date_string, date_string}
        end

      _ ->
        {date_string, date_string}
    end
  end

  # ============================================================================
  # HTML STRIPPING
  # ============================================================================

  defp strip_html(nil), do: ""

  defp strip_html(text) when is_binary(text) do
    text
    |> String.replace(~r/<[^>]+>/, " ")
    |> String.replace(~r/&amp;/, "&")
    |> String.replace(~r/&lt;/, "<")
    |> String.replace(~r/&gt;/, ">")
    |> String.replace(~r/&quot;/, "\"")
    |> String.replace(~r/&#39;/, "'")
    |> String.replace(~r/&nbsp;/, " ")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end
end
