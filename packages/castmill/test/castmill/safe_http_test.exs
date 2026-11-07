defmodule Castmill.SafeHttpTest do
  use ExUnit.Case, async: false

  alias Castmill.SafeHttp
  alias Castmill.SafeHttp.FakeClient

  @url "https://news.example.com/feed.xml"

  setup do
    FakeClient.install()
  end

  describe "get/1" do
    test "returns the body, final URL and content type" do
      FakeClient.stub(@url, FakeClient.ok("<rss/>"))

      assert {:ok, %{body: "<rss/>", url: @url, content_type: "application/rss+xml"}} =
               SafeHttp.get(@url)

      assert_received {:safe_http_get, @url, headers, options}
      assert {"Accept-Encoding", "gzip, deflate"} in headers
      assert options[:follow_redirect] == false
    end

    test "returns an empty streamed body" do
      FakeClient.stub(@url, FakeClient.ok(""))
      assert {:ok, %{body: ""}} = SafeHttp.get(@url)
    end

    test "collects multiple streamed chunks in order" do
      body = String.duplicate("a", 1_024) <> String.duplicate("b", 1_024) <> "tail"
      FakeClient.stub(@url, FakeClient.ok(body))

      assert {:ok, %{body: ^body}} = SafeHttp.get(@url)
    end

    test "follows relative and absolute redirects" do
      FakeClient.stub(
        @url,
        {:ok, %{status_code: 301, headers: [{"Location", "/moved.xml"}], body: ""}}
      )

      FakeClient.stub(
        "https://news.example.com/moved.xml",
        {:ok,
         %{status_code: 302, headers: [{"location", "https://cdn.example.com/f.xml"}], body: ""}}
      )

      FakeClient.stub("https://cdn.example.com/f.xml", FakeClient.ok("<rss/>"))

      assert {:ok, %{url: "https://cdn.example.com/f.xml"}} = SafeHttp.get(@url)
    end

    test "stops redirect loops" do
      FakeClient.stub(
        @url,
        {:ok, %{status_code: 302, headers: [{"Location", @url}], body: ""}}
      )

      assert {:error, :too_many_redirects} = SafeHttp.get(@url)
    end

    test "fails on redirects without location" do
      FakeClient.stub(@url, {:ok, %{status_code: 302, headers: [], body: ""}})
      assert {:error, :redirect_without_location} = SafeHttp.get(@url)
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
        FakeClient.stub(@url, {:ok, %{status_code: status, headers: [], body: ""}})
        assert {:error, ^reason} = SafeHttp.get(@url)
      end
    end

    test "maps network errors" do
      FakeClient.stub(@url, {:error, %{reason: :timeout}})
      assert {:error, :timeout} = SafeHttp.get(@url)

      FakeClient.stub(@url, {:error, %{reason: :econnrefused}})
      assert {:error, :connection_refused} = SafeHttp.get(@url)

      FakeClient.stub(@url, {:error, %{reason: :closed}})
      assert {:error, :network_error} = SafeHttp.get(@url)
    end

    test "decompresses gzip and deflate bodies" do
      FakeClient.stub(
        @url,
        FakeClient.ok(:zlib.gzip("<rss>gzip</rss>"), [{"Content-Encoding", "gzip"}])
      )

      assert {:ok, %{body: "<rss>gzip</rss>"}} = SafeHttp.get(@url)

      FakeClient.stub(
        @url,
        FakeClient.ok(:zlib.compress("<rss>deflate</rss>"), [{"Content-Encoding", "deflate"}])
      )

      assert {:ok, %{body: "<rss>deflate</rss>"}} = SafeHttp.get(@url)

      FakeClient.stub(
        @url,
        FakeClient.ok(:zlib.zip("<rss>raw</rss>"), [{"Content-Encoding", "deflate"}])
      )

      assert {:ok, %{body: "<rss>raw</rss>"}} = SafeHttp.get(@url)
    end

    test "detects gzip bodies without a Content-Encoding header" do
      FakeClient.stub(@url, FakeClient.ok(:zlib.gzip("<rss/>"), []))
      assert {:ok, %{body: "<rss/>"}} = SafeHttp.get(@url)
    end

    test "rejects oversized bodies and decompression bombs" do
      FakeClient.install(max_body_bytes: 1_000)

      FakeClient.stub(@url, FakeClient.ok(String.duplicate("a", 1_001)))
      assert {:error, :feed_too_large} = SafeHttp.get(@url)
      assert_received {:safe_http_cancel, _ref}

      bomb = :zlib.gzip(String.duplicate("a", 500_000))
      assert byte_size(bomb) < 1_000

      FakeClient.stub(@url, FakeClient.ok(bomb, [{"Content-Encoding", "gzip"}]))
      assert {:error, :feed_too_large} = SafeHttp.get(@url)

      assert_received {:safe_http_get, @url, _headers, options}
      assert options[:stream_to] == self()
      refute Keyword.has_key?(options, :max_body_length)
    end

    test "rejects non http(s) URLs" do
      for url <- ["ftp://example.com/feed", "file:///etc/passwd", "javascript:alert(1)", "/feed"] do
        assert {:error, :invalid_url} = SafeHttp.get(url)
      end

      refute_received {:safe_http_get, _, _, _}
    end
  end

  describe "SSRF protection" do
    setup do
      FakeClient.install(allow_private_hosts: false)
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
        assert {:error, :blocked_host} = SafeHttp.get(url), "expected #{url} to be blocked"
      end

      refute_received {:safe_http_get, _, _, _}
    end

    test "validates every redirect hop" do
      public = "http://93.184.216.34/feed"

      FakeClient.stub(
        public,
        {:ok,
         %{status_code: 302, headers: [{"Location", "http://169.254.169.254/latest"}], body: ""}}
      )

      assert {:error, :blocked_host} = SafeHttp.get(public)
      assert_received {:safe_http_get, ^public, _, _}
      refute_received {:safe_http_get, "http://169.254.169.254/latest", _, _}
    end

    test "allows public addresses" do
      public = "http://93.184.216.34/feed"
      FakeClient.stub(public, FakeClient.ok("<rss/>"))
      assert {:ok, %{body: "<rss/>"}} = SafeHttp.get(public)
    end
  end

  describe "public_address?/1" do
    test "classifies IPv4 and IPv6 addresses" do
      assert SafeHttp.public_address?({8, 8, 8, 8})
      assert SafeHttp.public_address?({0x2606, 0x4700, 0, 0, 0, 0, 0, 0x1111})
      refute SafeHttp.public_address?({224, 0, 0, 1})
      refute SafeHttp.public_address?({255, 255, 255, 255})
      refute SafeHttp.public_address?({0, 0, 0, 0, 0, 0, 0, 0})
      refute SafeHttp.public_address?({0xFF02, 0, 0, 0, 0, 0, 0, 1})
      refute SafeHttp.public_address?({0xFEC0, 0, 0, 0, 0, 0, 0, 1})
      refute SafeHttp.public_address?({0x64, 0xFF9B, 0, 0, 0, 0, 0x0A00, 0x0001})
    end
  end
end
