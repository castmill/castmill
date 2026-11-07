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

    test "decodes the full HTML5 entity set, including multi-code-point entities" do
      assert Html.decode_entities("&bopf; &Afr; &rarrw; &NotEqualTilde; &fjlig; &ThickSpace;") ==
               "𝕓 𝔄 ↝ ≂̸ fj \u205F\u200A"
    end

    test "does not decode references twice" do
      assert Html.decode_entities("&amp;lt;b&amp;gt;") == "&lt;b&gt;"
    end
  end

  describe "entity_codepoints/1" do
    test "returns the code points of named references" do
      assert Html.entity_codepoints("eacute") == [233]
      assert Html.entity_codepoints("NotEqualTilde") == [8770, 824]
    end

    test "returns nil for unknown or numeric names" do
      assert Html.entity_codepoints("bogus") == nil
      assert Html.entity_codepoints("#38") == nil
      assert Html.entity_codepoints("") == nil
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

    test "removes non-rendered elements" do
      html =
        "<noscript>No JS</noscript><template><p>T</p></template>" <>
          "<iframe>Frame</iframe><SCRIPT type='x'>var a = '<p>x</p>';</SCRIPT>Visible"

      assert Html.to_text(html) == "Visible"
    end

    test "keeps quoted > characters inside attribute values" do
      assert Html.to_text(~s(<a title="a > b" href='/x?y>z'>Link</a> text)) == "Link text"
    end

    test "tolerates malformed markup" do
      assert Html.to_text("<div><p>Unclosed <b>bold</div>tail") == "Unclosed bold tail"
      assert Html.to_text("Before<!-- unterminated comment") == "Before"
      assert Html.to_text("5 < 6 and 7 > 3") == "5 < 6 and 7 > 3"
    end

    test "decodes HTML5 entities beyond the common set" do
      assert Html.to_text("<p>&bopf; &NotEqualTilde; &fjlig;&period;</p>") == "𝕓 ≂̸ fj."
    end

    test "keeps unknown entities and does not over-decode plain text" do
      assert Html.to_text("&bogus; &amp;amp;") == "&bogus; &amp;"
    end

    test "handles empty input and nil" do
      assert Html.to_text("") == ""
      assert Html.to_text(nil) == ""
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

    test "falls back to a real lazy-loaded source when src is a data URI" do
      html = ~s(<img src="data:image/gif;base64,AAA" data-src="https://example.com/photo.jpg">)

      assert Html.image_urls(html) == ["https://example.com/photo.jpg"]
    end

    test "supports srcset and escaped HTML" do
      assert Html.image_urls(~s(<img srcset="https://a.test/s.jpg 1x, https://a.test/l.jpg 2x">)) ==
               ["https://a.test/s.jpg"]

      assert Html.image_urls("&lt;img src=&quot;https://a.test/e.jpg&quot;&gt;") ==
               ["https://a.test/e.jpg"]
    end

    test "decodes escaped attribute values exactly once" do
      html = "&lt;img src=&quot;https://a.test/e.jpg?a=1&amp;amp;b=2&quot;&gt;"

      assert Html.image_urls(html) == ["https://a.test/e.jpg?a=1&b=2"]
    end

    test "skips images that are not rendered" do
      html = """
      <!-- <img src="https://a.test/comment.jpg"> -->
      <script>document.write('<img src="https://a.test/script.jpg">')</script>
      <noscript><img src="https://a.test/noscript.jpg"></noscript>
      <template><img src="https://a.test/template.jpg"></template>
      <img alt="a > b" src="https://a.test/visible.jpg">
      """

      assert Html.image_urls(html) == ["https://a.test/visible.jpg"]
    end

    test "uses the first occurrence of repeated attributes" do
      assert Html.image_urls(~s(<IMG SRC="https://a.test/1.jpg" src="https://a.test/2.jpg">)) ==
               ["https://a.test/1.jpg"]
    end

    test "skips zero-sized tracking images" do
      assert Html.image_urls(~s(<img src="https://t.test/p.gif" width="0">)) == []
    end

    test "handles malformed markup and nil" do
      assert Html.image_urls(~s(<p><img src="https://a.test/u.jpg")) == ["https://a.test/u.jpg"]
      assert Html.image_urls(nil) == []
    end
  end

  describe "tag_attributes/2" do
    test "returns decoded attributes of matching elements in document order" do
      html = """
      <head>
        <link rel="stylesheet" href="/style.css">
        <LINK Title="News > Latest" rel="alternate" href="/feed?a=1&amp;b=2" href="/ignored">
      </head>
      """

      assert Html.tag_attributes(html, "link") == [
               %{"rel" => "stylesheet", "href" => "/style.css"},
               %{"title" => "News > Latest", "rel" => "alternate", "href" => "/feed?a=1&b=2"}
             ]
    end
  end
end
