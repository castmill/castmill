defmodule Castmill.Widgets.Integrations.Fetchers.RssTest do
  # Not async: the fake HTTP client is configured through the application env.
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog

  alias Castmill.Widgets.Integrations.Fetchers.Rss
  alias Castmill.Widgets.Integrations.Rss.FakeHttpClient

  @feed_url "https://news.example.com/feed.xml"

  @rss """
  <?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"
       xmlns:media="http://search.yahoo.com/mrss/"
       xmlns:content="http://purl.org/rss/1.0/modules/content/"
       xmlns:dc="http://purl.org/dc/elements/1.1/"
       xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
      <title>Example &amp; News</title>
      <link>https://news.example.com/</link>
      <atom:link href="https://news.example.com/feed.xml" rel="self" type="application/rss+xml"/>
      <description><![CDATA[<p>Latest <b>headlines</b></p>]]></description>
      <language>en-us</language>
      <image><url>https://news.example.com/logo.png</url><title>Example</title></image>
      <item>
        <title>Older story</title>
        <link>https://news.example.com/older</link>
        <description>Older &lt;b&gt;bold&lt;/b&gt; summary</description>
        <pubDate>Tue, 31 Dec 2024 10:00:00 GMT</pubDate>
        <guid isPermaLink="false">older-1</guid>
        <enclosure url="https://news.example.com/podcast.mp3" type="audio/mpeg" length="1"/>
        <enclosure url="https://news.example.com/older.jpg" type="image/jpeg" length="1"/>
        <author>editor@example.com (Ed Itor)</author>
      </item>
      <item>
        <title><![CDATA[Newest story: “Quotes” &amp; more]]></title>
        <link>https://news.example.com/newest</link>
        <description><![CDATA[<p>The newest <a href="#">story</a> with&nbsp;details.</p>]]></description>
        <content:encoded><![CDATA[<p><img src="/inline.jpg"/>Full text</p>]]></content:encoded>
        <pubDate>Wed, 01 Jan 2025 14:00:00 +0200</pubDate>
        <guid>https://news.example.com/newest</guid>
        <dc:creator>Jane Doe</dc:creator>
        <category>World</category>
        <category>Politics</category>
        <category>World</category>
        <media:content url="https://news.example.com/small.jpg" medium="image" width="320"/>
        <media:content url="https://news.example.com/large.jpg" medium="image" width="1280"/>
        <media:content url="https://news.example.com/clip.mp4" medium="video" width="1920"/>
        <media:thumbnail url="https://news.example.com/thumb.jpg" width="100"/>
      </item>
      <item>
        <title>Content image only</title>
        <link>https://news.example.com/articles/content</link>
        <content:encoded><![CDATA[<img src="https://t.example.com/pixel.gif" width="1" height="1"><p><img src="images/photo.jpg">Body text only in content</p>]]></content:encoded>
        <pubDate>Wed, 01 Jan 2025 11:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Thumbnail story</title>
        <link>https://news.example.com/thumb</link>
        <media:group>
          <media:content url="https://news.example.com/video.mp4" type="video/mp4"/>
          <media:thumbnail url="https://news.example.com/group-thumb.jpg"/>
        </media:group>
        <pubDate>Wed, 01 Jan 2025 10:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Duplicate of newest</title>
        <link>https://news.example.com/newest</link>
        <guid>https://news.example.com/newest</guid>
        <pubDate>Wed, 01 Jan 2025 09:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Undated story</title>
        <link>https://news.example.com/undated</link>
      </item>
    </channel>
  </rss>
  """

  setup do
    FakeHttpClient.install()
  end

  describe "fetch/2" do
    test "returns error when feed_url is missing" do
      credentials = %{}
      options = %{}

      assert {:error, :missing_feed_url, ^credentials} = Rss.fetch(credentials, options)
    end

    test "returns error when feed_url is empty" do
      credentials = %{}
      options = %{"feed_url" => ""}

      assert {:error, :missing_feed_url, ^credentials} = Rss.fetch(credentials, options)

      assert {:error, :missing_feed_url, ^credentials} =
               Rss.fetch(credentials, %{"feed_url" => "  "})
    end

    test "fetches and normalises an RSS 2.0 feed" do
      FakeHttpClient.stub(@feed_url, FakeHttpClient.ok(@rss))
      credentials = %{"unused" => true}

      assert {:ok, data, ^credentials} = Rss.fetch(credentials, %{"feed_url" => @feed_url})

      assert data["feedTitle"] == "Example & News"
      assert data["feedDescription"] == "Latest headlines"
      assert data["feedLink"] == "https://news.example.com/"
      assert data["feedImage"] == "https://news.example.com/logo.png"
      assert data["feedLanguage"] == "en-us"
      assert data["feedFormat"] == "rss"
      assert is_integer(data["lastUpdated"])

      titles = Enum.map(data["items"], & &1["title"])

      # Sorted newest first, duplicates removed, undated items last
      assert titles == [
               "Newest story: “Quotes” & more",
               "Content image only",
               "Thumbnail story",
               "Older story",
               "Undated story"
             ]

      [newest, content_only, thumbnail, older, undated] = data["items"]

      assert newest == %{
               "id" => "https://news.example.com/newest",
               "title" => "Newest story: “Quotes” & more",
               "description" => "The newest story with details.",
               "link" => "https://news.example.com/newest",
               "image" => "https://news.example.com/large.jpg",
               "imageUrl" => "https://news.example.com/large.jpg",
               "author" => "Jane Doe",
               "categories" => ["World", "Politics"],
               "source" => "Example & News",
               "pubDate" => "2025-01-01T12:00:00Z",
               "pubDateFormatted" => "Jan 1, 2025"
             }

      assert content_only["description"] == "Body text only in content"
      assert content_only["image"] == "https://news.example.com/articles/images/photo.jpg"

      assert thumbnail["image"] == "https://news.example.com/group-thumb.jpg"

      assert older["id"] == "older-1"
      assert older["description"] == "Older bold summary"
      assert older["image"] == "https://news.example.com/older.jpg"
      assert older["author"] == "Ed Itor"

      assert undated["pubDate"] == ""
      assert undated["image"] == ""
      assert undated["description"] == ""
    end

    test "normalises feed URLs without a scheme and feed:// URLs" do
      FakeHttpClient.stub(@feed_url, FakeHttpClient.ok(@rss))

      assert {:ok, _data, _} = Rss.fetch(%{}, %{"feed_url" => " news.example.com/feed.xml "})
      assert {:ok, _data, _} = Rss.fetch(%{}, %{"feed_url" => "feed://news.example.com/feed.xml"})
    end

    test "discovers the feed advertised by an HTML page" do
      page = "https://news.example.com/"

      html = """
      <!DOCTYPE html>
      <html><head>
        <link rel="stylesheet" href="/style.css">
        <link rel="alternate" type="application/rss+xml" title="Feed" href="/feed.xml">
      </head><body>Hello</body></html>
      """

      FakeHttpClient.stub(page, FakeHttpClient.ok(html, [{"Content-Type", "text/html"}]))
      FakeHttpClient.stub(@feed_url, FakeHttpClient.ok(@rss))

      assert {:ok, data, _} = Rss.fetch(%{}, %{"feed_url" => page})
      assert data["feedTitle"] == "Example & News"
    end

    test "returns unknown_feed_format for pages without feeds" do
      FakeHttpClient.stub(@feed_url, FakeHttpClient.ok("<html><body>No feed</body></html>"))

      capture_log(fn ->
        assert {:error, :unknown_feed_format, %{}} = Rss.fetch(%{}, %{"feed_url" => @feed_url})
      end)
    end

    test "propagates HTTP errors with credentials" do
      FakeHttpClient.stub(
        @feed_url <> "?token=secret",
        {:ok, %{status_code: 404, headers: [], body: ""}}
      )

      credentials = %{"token" => "secret"}

      log =
        capture_log(fn ->
          assert {:error, :not_found, ^credentials} =
                   Rss.fetch(credentials, %{"feed_url" => @feed_url <> "?token=secret"})
        end)

      assert log =~ "news.example.com"
      refute log =~ "secret"
    end

    test "rejects feeds hosted on private networks" do
      FakeHttpClient.install(allow_private_hosts: false)

      capture_log(fn ->
        assert {:error, :blocked_host, %{}} =
                 Rss.fetch(%{}, %{"feed_url" => "http://169.254.169.254/latest/meta-data"})
      end)
    end
  end

  describe "parse/2" do
    test "parses Atom feeds" do
      atom = """
      <?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="sv">
        <title type="html">Atom &lt;em&gt;News&lt;/em&gt;</title>
        <subtitle>All the news</subtitle>
        <link rel="self" href="https://atom.example.com/feed"/>
        <link rel="alternate" type="text/html" href="https://atom.example.com/"/>
        <logo>/logo.svg</logo>
        <author><name>Feed Author</name></author>
        <entry>
          <title>First entry</title>
          <id>urn:uuid:1</id>
          <link rel="alternate" href="/entries/1"/>
          <link rel="enclosure" type="image/png" href="/entries/1.png"/>
          <published>2025-02-01T10:00:00+01:00</published>
          <updated>2025-02-02T10:00:00Z</updated>
          <summary type="html">&lt;p&gt;Summary &amp;amp; more&lt;/p&gt;</summary>
          <category term="tech" label="Technology"/>
          <category term="science"/>
        </entry>
        <entry>
          <title>Second entry</title>
          <id>urn:uuid:2</id>
          <link href="https://atom.example.com/entries/2"/>
          <updated>2025-03-01T10:00:00Z</updated>
          <content type="xhtml">
            <div xmlns="http://www.w3.org/1999/xhtml"><p>XHTML <img src="https://atom.example.com/x.jpg"/>content</p></div>
          </content>
          <author><name>Entry Author</name></author>
        </entry>
      </feed>
      """

      assert {:ok, data} = Rss.parse(atom, base_url: "https://atom.example.com/feed")

      assert data["feedTitle"] == "Atom News"
      assert data["feedDescription"] == "All the news"
      assert data["feedLink"] == "https://atom.example.com/"
      assert data["feedImage"] == "https://atom.example.com/logo.svg"
      assert data["feedLanguage"] == "sv"
      assert data["feedFormat"] == "atom"

      assert [second, first] = data["items"]

      assert second["title"] == "Second entry"
      assert second["description"] == "XHTML content"
      assert second["image"] == "https://atom.example.com/x.jpg"
      assert second["author"] == "Entry Author"
      assert second["pubDate"] == "2025-03-01T10:00:00Z"

      assert first["id"] == "urn:uuid:1"
      assert first["link"] == "https://atom.example.com/entries/1"
      assert first["image"] == "https://atom.example.com/entries/1.png"
      assert first["description"] == "Summary & more"
      assert first["author"] == "Feed Author"
      assert first["categories"] == ["Technology", "science"]
      assert first["pubDate"] == "2025-02-01T09:00:00Z"
      assert first["source"] == "Atom News"
    end

    test "parses RSS 1.0 (RDF) feeds" do
      rdf = """
      <?xml version="1.0"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:dc="http://purl.org/dc/elements/1.1/"
               xmlns="http://purl.org/rss/1.0/">
        <channel rdf:about="https://rdf.example.com/">
          <title>RDF News</title>
          <link>https://rdf.example.com/</link>
          <description>RDF description</description>
          <image rdf:resource="https://rdf.example.com/#logo"/>
          <dc:language>de</dc:language>
        </channel>
        <image rdf:about="https://rdf.example.com/#logo">
           <title>Logo</title><url>https://rdf.example.com/logo.png</url>
        </image>
        <item rdf:about="https://rdf.example.com/1">
          <title>RDF item</title>
          <link>https://rdf.example.com/1</link>
          <description>RDF item description</description>
          <dc:date>2025-01-01T12:00:00Z</dc:date>
          <dc:creator>Max Mustermann</dc:creator>
          <dc:subject>Local</dc:subject>
        </item>
      </rdf:RDF>
      """

      assert {:ok, data} = Rss.parse(rdf)
      assert data["feedTitle"] == "RDF News"
      assert data["feedImage"] == "https://rdf.example.com/logo.png"
      assert data["feedLanguage"] == "de"
      assert data["feedFormat"] == "rdf"

      assert [item] = data["items"]
      assert item["title"] == "RDF item"
      assert item["description"] == "RDF item description"
      assert item["author"] == "Max Mustermann"
      assert item["categories"] == ["Local"]
      assert item["pubDate"] == "2025-01-01T12:00:00Z"
    end

    test "parses JSON Feed documents" do
      json =
        Jason.encode!(%{
          "version" => "https://jsonfeed.org/version/1.1",
          "title" => "JSON News",
          "home_page_url" => "https://json.example.com/",
          "description" => "JSON description",
          "icon" => "https://json.example.com/icon.png",
          "language" => "fr",
          "authors" => [%{"name" => "Feed Author"}],
          "items" => [
            %{
              "id" => 1,
              "url" => "https://json.example.com/1",
              "title" => "JSON item",
              "content_html" => "<p>JSON <em>content</em></p>",
              "date_published" => "2025-01-01T12:00:00Z",
              "tags" => ["a", "b"],
              "attachments" => [
                %{"url" => "https://json.example.com/a.mp3", "mime_type" => "audio/mpeg"},
                %{"url" => "https://json.example.com/a.jpg", "mime_type" => "image/jpeg"}
              ]
            },
            %{
              "id" => "2",
              "url" => "/2",
              "title" => "Second JSON item",
              "summary" => "Short summary",
              "image" => "/2.jpg",
              "date_published" => "2025-01-02T12:00:00Z",
              "authors" => [%{"name" => "Item Author"}]
            },
            "not an item"
          ]
        })

      assert {:ok, data} = Rss.parse(json)
      assert data["feedTitle"] == "JSON News"
      assert data["feedImage"] == "https://json.example.com/icon.png"
      assert data["feedFormat"] == "json"

      assert [second, first] = data["items"]
      assert second["id"] == "2"
      assert second["link"] == "https://json.example.com/2"
      assert second["image"] == "https://json.example.com/2.jpg"
      assert second["description"] == "Short summary"
      assert second["author"] == "Item Author"

      assert first["id"] == "1"
      assert first["description"] == "JSON content"
      assert first["image"] == "https://json.example.com/a.jpg"
      assert first["author"] == "Feed Author"
      assert first["categories"] == ["a", "b"]
    end

    test "parses JSON Feed documents with a UTF-8 BOM" do
      json =
        Jason.encode!(%{
          "version" => "https://jsonfeed.org/version/1.1",
          "title" => "BOM News",
          "items" => [%{"id" => "1", "title" => "BOM item"}]
        })

      assert {:ok, %{"feedTitle" => "BOM News", "items" => [%{"title" => "BOM item"}]}} =
               Rss.parse("\uFEFF" <> json)
    end

    test "keeps the fetched document URL as the relative link base" do
      rss = """
      <rss><channel><title>News</title><link>https://example.com/</link>
        <item><title>RSS story</title><link>story.html</link></item>
      </channel></rss>
      """

      atom = """
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>News</title><link rel="alternate" href="https://example.com/"/>
        <entry><title>Atom story</title><link href="story.html"/></entry>
      </feed>
      """

      base_url = "https://example.com/news/feed.xml"

      assert {:ok, %{"items" => [%{"link" => "https://example.com/news/story.html"}]}} =
               Rss.parse(rss, base_url: base_url)

      assert {:ok, %{"items" => [%{"link" => "https://example.com/news/story.html"}]}} =
               Rss.parse(atom, base_url: base_url)

      assert {:ok, %{"items" => [%{"link" => "https://example.com/story.html"}]}} = Rss.parse(rss)

      assert {:ok, %{"items" => [%{"link" => "https://example.com/story.html"}]}} =
               Rss.parse(atom)
    end

    test "preserves XHTML block boundaries and skips tracking images" do
      atom = """
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>News</title>
        <entry><title>Story</title>
          <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">
            <p>First paragraph</p><p>Second <em>paragraph</em></p>
            <script>script text</script><style>style text</style>
            <noscript>fallback text</noscript><iframe>frame text</iframe>
            <template>template text</template>
            <img src="https://example.com/pixel.gif" width="1" height="1"/>
            <img src="https://example.com/photo.jpg" width="640" height="480"/>
          </div></content>
        </entry>
      </feed>
      """

      assert {:ok, %{"items" => [item]}} = Rss.parse(atom)
      assert item["description"] == "First paragraph Second paragraph"
      assert item["image"] == "https://example.com/photo.jpg"
    end

    test "honors inherited xml:base when resolving Atom links and images" do
      atom = """
      <feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.com/feeds/">
        <title>News</title>
        <logo xml:base="assets/">logo.png</logo>
        <entry xml:base="../articles/">
          <title>Story</title>
          <link xml:base="pages/" href="story.html"/>
          <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">
            <p>Article body</p><img src="photo.jpg"/>
          </div></content>
        </entry>
      </feed>
      """

      assert {:ok, %{"feedImage" => feed_image, "items" => [item]}} =
               Rss.parse(atom, base_url: "https://example.com/feed.xml")

      assert feed_image == "https://example.com/feeds/assets/logo.png"
      assert item["image"] == "https://example.com/articles/photo.jpg"
      assert item["link"] == "https://example.com/articles/pages/story.html"
    end

    test "skips tracking pixels in both Media RSS image lists" do
      rss = """
      <rss xmlns:media="http://search.yahoo.com/mrss/"><channel><title>News</title>
        <item><title>Story</title>
          <media:content url="https://example.com/content-pixel.jpg" medium="image" width="1" height="1"/>
          <media:thumbnail url="https://example.com/thumbnail-pixel.jpg" width="1" height="1"/>
          <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/">
            <![CDATA[<img src="https://example.com/article.jpg">]]>
          </content:encoded>
        </item>
      </channel></rss>
      """

      assert {:ok, %{"items" => [%{"image" => "https://example.com/article.jpg"}]}} =
               Rss.parse(rss)
    end

    test "rejects JSON documents that are not JSON Feeds" do
      assert {:error, :unknown_feed_format} = Rss.parse(~s({"hello": "world"}))
      assert {:error, :unknown_feed_format} = Rss.parse("{not json")
    end

    test "rejects unknown and empty documents" do
      assert {:error, :unknown_feed_format} = Rss.parse("<html><body/></html>")
      assert {:error, :unknown_feed_format} = Rss.parse("  ")
      assert {:error, :xml_parse_error} = Rss.parse("<rss><channel>")
    end

    test "limits the number of items and truncates long text" do
      long = String.duplicate("word ", 300)

      items =
        Enum.map_join(1..150, "\n", fn i ->
          "<item><title>Item #{i}</title><guid>#{i}</guid><description>#{long}</description></item>"
        end)

      assert {:ok, data} = Rss.parse("<rss><channel><title>Many</title>#{items}</channel></rss>")
      assert length(data["items"]) == 100

      [first | _] = data["items"]
      assert first["title"] == "Item 1"
      assert String.length(first["description"]) <= 500
      assert String.ends_with?(first["description"], "…")

      assert {:ok, %{"items" => limited}} =
               Rss.parse("<rss><channel>#{items}</channel></rss>", max_items: 3)

      assert length(limited) == 3
    end

    test "drops empty items, descriptions identical to titles and unsafe image URLs" do
      rss = """
      <rss><channel><title>Feed</title>
        <item><title></title><description></description></item>
        <item>
          <title>Same</title><description>Same</description>
          <media:content xmlns:media="http://search.yahoo.com/mrss/" url="javascript:alert(1)"/>
          <enclosure url="https://ok.example.com/fallback.jpg" type="image/jpeg"/>
        </item>
      </channel></rss>
      """

      assert {:ok, %{"items" => [item]}} = Rss.parse(rss)
      assert item["description"] == ""
      assert item["image"] == "https://ok.example.com/fallback.jpg"
    end

    test "tolerates common feed errors" do
      rss = """

      <?xml version="1.0" encoding="ISO-8859-1"?>
      <!DOCTYPE rss PUBLIC "-//Netscape Communications//DTD RSS 0.91//EN"
        "http://my.netscape.com/publish/formats/rss-0.91.dtd">
      <rss version="0.91"><channel><title>Caf\xE9 &amp; Bar</title>
        <item><title>Tom & Jerry&nbsp;&mdash; caf\xE9</title><link>https://a.example.com/1</link></item>
      </channel></rss>
      """

      assert {:ok, data} = Rss.parse(rss)
      assert data["feedTitle"] == "Café & Bar"
      assert [%{"title" => "Tom & Jerry — café"}] = data["items"]
    end

    test "keeps the item source when provided" do
      rss = """
      <rss><channel><title>Aggregator</title>
        <item><title>Story</title><source url="https://origin.example.com/rss">Origin News</source></item>
      </channel></rss>
      """

      assert {:ok, %{"items" => [item]}} = Rss.parse(rss)
      assert item["source"] == "Origin News"
    end

    test "caps feed and source titles before storing them" do
      title = String.duplicate("News ", 1_000)

      rss =
        "<rss><channel><title>#{title}</title><item><title>Story</title>" <>
          "<source>#{title}</source></item></channel></rss>"

      assert {:ok, %{"feedTitle" => feed_title, "items" => [item]}} = Rss.parse(rss)

      assert String.length(feed_title) <= 300
      assert String.length(item["source"]) <= 300
    end

    test "deduplicates items by either ID or article link" do
      rss = """
      <rss><channel><title>News</title>
        <item><title>Old ID match</title><guid>shared-id</guid><link>https://example.com/old</link><pubDate>Tue, 31 Dec 2024 10:00:00 GMT</pubDate></item>
        <item><title>New ID match</title><guid>shared-id</guid><link>https://example.com/new</link><pubDate>Wed, 01 Jan 2025 10:00:00 GMT</pubDate></item>
        <item><title>Old link match</title><guid>old-id</guid><link>https://example.com/shared</link><pubDate>Tue, 31 Dec 2024 10:00:00 GMT</pubDate></item>
        <item><title>New link match</title><guid>new-id</guid><link>https://example.com/shared</link><pubDate>Wed, 01 Jan 2025 09:00:00 GMT</pubDate></item>
      </channel></rss>
      """

      assert {:ok, %{"items" => items}} = Rss.parse(rss)
      assert Enum.map(items, & &1["title"]) == ["New ID match", "New link match"]
    end
  end
end
