defmodule Castmill.Widgets.Integrations.Rss.HtmlTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.Integrations.Rss.Html

  describe "decode_entities/1" do
    test "decodes named, decimal and hexadecimal references" do
      assert Html.decode_entities("Fish &amp; Chips &mdash; &eacute;t&eacute; &#8217; &#x2019;") ==
               "Fish & Chips — été ’ ’"
    end

    test "leaves unknown entities and invalid code points untouched" do
      assert Html.decode_entities("&bogus; &#0; &#xD800;") == "&bogus; &#0; &#xD800;"
    end

    test "handles nil" do
      assert Html.decode_entities(nil) == ""
    end
  end

  describe "to_text/1" do
    test "strips tags, scripts, styles and comments and collapses whitespace" do
      html = """
      <p>Hello <b>wor</b>ld</p><script>alert('x')</script>
      <style>p { color: red }</style><!-- hidden --><div>Second&nbsp;line</div>
      """

      assert Html.to_text(html) == "Hello world Second line"
    end

    test "handles double escaped HTML" do
      assert Html.to_text("&lt;p&gt;Escaped &amp;amp; text&lt;/p&gt;") == "Escaped & text"
    end

    test "separates block elements and line breaks" do
      assert Html.to_text("One<br/>Two<li>Three</li>") == "One Two Three"
    end

    test "removes zero-width characters" do
      assert Html.to_text("A\u200Bb\uFEFFc") == "A bc"
    end
  end

  describe "truncate/2" do
    test "returns short text unchanged" do
      assert Html.truncate("Short text", 20) == "Short text"
    end

    test "truncates at a word boundary with an ellipsis" do
      assert Html.truncate("The quick brown fox jumps over the lazy dog", 20) ==
               "The quick brown fox…"
    end

    test "never exceeds the maximum length" do
      text = String.duplicate("a", 50)
      truncated = Html.truncate(text, 10)

      assert String.length(truncated) == 10
      assert String.ends_with?(truncated, "…")
    end
  end

  describe "image_urls/1" do
    test "extracts image sources in document order" do
      html =
        ~s(<p><img src="https://a.test/1.jpg?a=1&amp;b=2" alt="x"><img data-src='/2.png'></p>)

      assert Html.image_urls(html) == ["https://a.test/1.jpg?a=1&b=2", "/2.png"]
    end

    test "skips tracking pixels and data URIs" do
      html =
        ~s(<img src="https://t.test/p.gif" width="1" height="1"><img src="data:image/png;base64,AAA">)

      assert Html.image_urls(html) == []
    end

    test "supports srcset and escaped HTML" do
      assert Html.image_urls(~s(<img srcset="https://a.test/s.jpg 1x, https://a.test/l.jpg 2x">)) ==
               ["https://a.test/s.jpg"]

      assert Html.image_urls("&lt;img src=&quot;https://a.test/e.jpg&quot;&gt;") ==
               ["https://a.test/e.jpg"]
    end
  end
end
