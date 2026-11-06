defmodule Castmill.Widgets.Integrations.Rss.HttpTest do
  use ExUnit.Case, async: false

  alias Castmill.Widgets.Integrations.Rss.FakeHttpClient
  alias Castmill.Widgets.Integrations.Rss.Http

  @url "https://news.example.com/feed.xml"

  setup do
    FakeHttpClient.install()
  end

  describe "get/1" do
    test "returns the body, final URL and content type" do
      FakeHttpClient.stub(@url, FakeHttpClient.ok("<rss/>"))

      assert {:ok, %{body: "<rss/>", url: @url, content_type: "application/rss+xml"}} =
               Http.get(@url)

      assert_received {:rss_http_get, @url, headers, options}
      assert {"Accept-Encoding", "gzip, deflate"} in headers
      assert options[:follow_redirect] == false
    end

    test "returns an empty streamed body" do
      FakeHttpClient.stub(@url, FakeHttpClient.ok(""))
      assert {:ok, %{body: ""}} = Http.get(@url)
    end

    test "collects multiple streamed chunks in order" do
      body = String.duplicate("a", 1_024) <> String.duplicate("b", 1_024) <> "tail"
      FakeHttpClient.stub(@url, FakeHttpClient.ok(body))

      assert {:ok, %{body: ^body}} = Http.get(@url)
    end

    test "follows relative and absolute redirects" do
      FakeHttpClient.stub(
        @url,
        {:ok, %{status_code: 301, headers: [{"Location", "/moved.xml"}], body: ""}}
      )

      FakeHttpClient.stub(
        "https://news.example.com/moved.xml",
        {:ok,
         %{status_code: 302, headers: [{"location", "https://cdn.example.com/f.xml"}], body: ""}}
      )

      FakeHttpClient.stub("https://cdn.example.com/f.xml", FakeHttpClient.ok("<rss/>"))

      assert {:ok, %{url: "https://cdn.example.com/f.xml"}} = Http.get(@url)
    end

    test "stops redirect loops" do
      FakeHttpClient.stub(
        @url,
        {:ok, %{status_code: 302, headers: [{"Location", @url}], body: ""}}
      )

      assert {:error, :too_many_redirects} = Http.get(@url)
    end

    test "fails on redirects without location" do
      FakeHttpClient.stub(@url, {:ok, %{status_code: 302, headers: [], body: ""}})
      assert {:error, :redirect_without_location} = Http.get(@url)
    end

    test "maps HTTP status codes to errors" do
      for {status, reason} <- [
            {401, :unauthorized},
            {403, :forbidden},
            {404, :not_found},
            {410, :not_found},
            {429, :rate_limited},
            {500, :server_error},
            {503, :server_error},
            {418, :http_error}
          ] do
        FakeHttpClient.stub(@url, {:ok, %{status_code: status, headers: [], body: ""}})
        assert {:error, ^reason} = Http.get(@url)
      end
    end

    test "maps network errors" do
      FakeHttpClient.stub(@url, {:error, %{reason: :timeout}})
      assert {:error, :timeout} = Http.get(@url)

      FakeHttpClient.stub(@url, {:error, %{reason: :econnrefused}})
      assert {:error, :connection_refused} = Http.get(@url)

      FakeHttpClient.stub(@url, {:error, %{reason: :closed}})
      assert {:error, :network_error} = Http.get(@url)
    end

    test "decompresses gzip and deflate bodies" do
      FakeHttpClient.stub(
        @url,
        FakeHttpClient.ok(:zlib.gzip("<rss>gzip</rss>"), [{"Content-Encoding", "gzip"}])
      )

      assert {:ok, %{body: "<rss>gzip</rss>"}} = Http.get(@url)

      FakeHttpClient.stub(
        @url,
        FakeHttpClient.ok(:zlib.compress("<rss>deflate</rss>"), [{"Content-Encoding", "deflate"}])
      )

      assert {:ok, %{body: "<rss>deflate</rss>"}} = Http.get(@url)

      FakeHttpClient.stub(
        @url,
        FakeHttpClient.ok(:zlib.zip("<rss>raw</rss>"), [{"Content-Encoding", "deflate"}])
      )

      assert {:ok, %{body: "<rss>raw</rss>"}} = Http.get(@url)
    end

    test "detects gzip bodies without a Content-Encoding header" do
      FakeHttpClient.stub(@url, FakeHttpClient.ok(:zlib.gzip("<rss/>"), []))
      assert {:ok, %{body: "<rss/>"}} = Http.get(@url)
    end

    test "rejects oversized bodies and decompression bombs" do
      FakeHttpClient.install(max_body_bytes: 1_000)

      FakeHttpClient.stub(@url, FakeHttpClient.ok(String.duplicate("a", 1_001)))
      assert {:error, :feed_too_large} = Http.get(@url)
      assert_received {:rss_http_cancel, _ref}

      bomb = :zlib.gzip(String.duplicate("a", 500_000))
      assert byte_size(bomb) < 1_000

      FakeHttpClient.stub(@url, FakeHttpClient.ok(bomb, [{"Content-Encoding", "gzip"}]))
      assert {:error, :feed_too_large} = Http.get(@url)

      assert_received {:rss_http_get, @url, _headers, options}
      assert options[:stream_to] == self()
      refute Keyword.has_key?(options, :max_body_length)
    end

    test "rejects non http(s) URLs" do
      for url <- ["ftp://example.com/feed", "file:///etc/passwd", "javascript:alert(1)", "/feed"] do
        assert {:error, :invalid_url} = Http.get(url)
      end

      refute_received {:rss_http_get, _, _, _}
    end
  end

  describe "SSRF protection" do
    setup do
      FakeHttpClient.install(allow_private_hosts: false)
    end

    test "blocks private, loopback, link-local and metadata addresses" do
      for url <- [
            "http://127.0.0.1/feed",
            "http://localhost/feed",
            "http://10.0.0.1/feed",
            "http://172.16.5.4/feed",
            "http://192.168.1.1/feed",
            "http://169.254.169.254/latest/meta-data",
            "http://100.64.0.1/feed",
            "http://0.0.0.0/feed",
            "http://[::1]/feed",
            "http://[fd00::1]/feed",
            "http://[fe80::1]/feed",
            "http://[fec0::1]/feed",
            "http://[::ffff:127.0.0.1]/feed"
          ] do
        assert {:error, :blocked_host} = Http.get(url), "expected #{url} to be blocked"
      end

      refute_received {:rss_http_get, _, _, _}
    end

    test "validates every redirect hop" do
      public = "http://93.184.216.34/feed"

      FakeHttpClient.stub(
        public,
        {:ok,
         %{status_code: 302, headers: [{"Location", "http://169.254.169.254/latest"}], body: ""}}
      )

      assert {:error, :blocked_host} = Http.get(public)
      assert_received {:rss_http_get, ^public, _, _}
      refute_received {:rss_http_get, "http://169.254.169.254/latest", _, _}
    end

    test "allows public addresses" do
      public = "http://93.184.216.34/feed"
      FakeHttpClient.stub(public, FakeHttpClient.ok("<rss/>"))
      assert {:ok, %{body: "<rss/>"}} = Http.get(public)
    end
  end

  describe "public_address?/1" do
    test "classifies IPv4 and IPv6 addresses" do
      assert Http.public_address?({8, 8, 8, 8})
      assert Http.public_address?({0x2606, 0x4700, 0, 0, 0, 0, 0, 0x1111})
      refute Http.public_address?({224, 0, 0, 1})
      refute Http.public_address?({255, 255, 255, 255})
      refute Http.public_address?({0, 0, 0, 0, 0, 0, 0, 0})
      refute Http.public_address?({0xFF02, 0, 0, 0, 0, 0, 0, 1})
      refute Http.public_address?({0xFEC0, 0, 0, 0, 0, 0, 0, 1})
      refute Http.public_address?({0x64, 0xFF9B, 0, 0, 0, 0, 0x0A00, 0x0001})
    end
  end
end
