defmodule Castmill.Widgets.Integrations.Rss.XmlTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.Integrations.Rss.Xml

  describe "parse/1" do
    test "builds a tree with canonical namespace prefixes" do
      xml = """
      <?xml version="1.0" encoding="UTF-8"?>
      <rss xmlns:m="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel>
          <title>News</title>
          <item><m:content url="https://a.test/i.jpg"/><dc:creator>Jane</dc:creator></item>
        </channel>
      </rss>
      """

      assert {:ok, root} = Xml.parse(xml)
      assert Xml.name(root) == "rss"

      channel = Xml.child(root, "channel")
      assert Xml.child_text(channel, "title") == "News"

      item = Xml.child(channel, "item")
      assert Xml.attr(Xml.child(item, "media:content"), "url") == "https://a.test/i.jpg"
      assert Xml.child_text(item, "dc:creator") == "Jane"
    end

    test "maps RSS 1.0 default namespace to unprefixed names" do
      xml = """
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
        <channel rdf:about="https://a.test/"><title>RDF</title></channel>
      </rdf:RDF>
      """

      assert {:ok, root} = Xml.parse(xml)
      assert Xml.name(root) == "rdf:RDF"
      assert Xml.child_text(Xml.child(root, "channel"), "title") == "RDF"
      assert Xml.attr(Xml.child(root, "channel"), "rdf:about") == "https://a.test/"
    end

    test "keeps CDATA content verbatim" do
      assert {:ok, root} = Xml.parse("<a><![CDATA[<p>AT&T &nbsp;</p>]]></a>")
      assert Xml.text(root) == "<p>AT&T &nbsp;</p>"
    end

    test "accepts HTML entities, bare ampersands and invalid control characters" do
      assert {:ok, root} = Xml.parse("<a>Caf&eacute; &mdash; AT&T &copy;\u0001 &bogus; &#0;</a>")
      assert Xml.text(root) == "Café — AT&T © &bogus;"
    end

    test "tolerates leading whitespace before the XML declaration" do
      assert {:ok, root} = Xml.parse("\n\n  <?xml version=\"1.0\"?><a>ok</a>")
      assert Xml.text(root) == "ok"
    end

    test "rejects malformed documents" do
      assert {:error, :xml_parse_error} = Xml.parse("<a><b></a>")
      assert {:error, :xml_parse_error} = Xml.parse("not xml at all")
    end
  end

  describe "encodings" do
    test "converts ISO-8859-1 documents" do
      xml = <<"<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><a>caf", 0xE9, "</a>">>
      assert {:ok, root} = Xml.parse(xml)
      assert Xml.text(root) == "café"
    end

    test "converts Windows-1252 documents including smart quotes" do
      xml =
        <<"<?xml version=\"1.0\" encoding=\"windows-1252\"?><a>", 0x93, "Hi", 0x94, 0x80, "</a>">>

      assert {:ok, root} = Xml.parse(xml)
      assert Xml.text(root) == "“Hi”€"
    end

    test "falls back to Windows-1252 when a UTF-8 document has invalid bytes" do
      assert {:ok, root} = Xml.parse(<<"<a>na", 0xEF, "ve ", 0x92, "s</a>">>)
      assert Xml.text(root) == "naïve ’s"
    end

    test "converts UTF-16 documents" do
      xml = :unicode.characters_to_binary("<a>héllo</a>", :utf8, {:utf16, :little})
      assert {:ok, root} = Xml.parse(<<0xFF, 0xFE>> <> xml)
      assert Xml.text(root) == "héllo"
    end

    test "strips a UTF-8 byte order mark" do
      assert {:ok, root} = Xml.parse(<<0xEF, 0xBB, 0xBF>> <> "<a>bom</a>")
      assert Xml.text(root) == "bom"
    end
  end

  describe "security" do
    test "never expands external entities (XXE)" do
      xml = """
      <?xml version="1.0"?>
      <!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
      <rss><channel><title>&xxe;</title></channel></rss>
      """

      case Xml.parse(xml) do
        {:ok, root} ->
          title = root |> Xml.child("channel") |> Xml.child_text("title")
          refute title =~ "root:"

        {:error, :xml_parse_error} ->
          :ok
      end
    end

    test "rejects entity expansion attacks" do
      xml = """
      <?xml version="1.0"?>
      <!DOCTYPE lolz [
        <!ENTITY lol "lol">
        <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
        <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
      ]>
      <lolz>&lol3;</lolz>
      """

      case Xml.parse(xml) do
        {:ok, root} -> refute Xml.text(root) =~ "lollol"
        {:error, :xml_parse_error} -> :ok
      end
    end

    test "rejects documents that still declare entities after removing the DOCTYPE" do
      xml = ~s(<!DOCTYPE x [<!ENTITY a "]>"><!ENTITY b "boom">]><x>&b;</x>)
      assert {:error, :xml_parse_error} = Xml.parse(xml)
    end

    test "ignores external DTDs instead of fetching them" do
      xml = """
      <?xml version="1.0"?>
      <!DOCTYPE rss PUBLIC "-//Netscape Communications//DTD RSS 0.91//EN"
        "http://my.netscape.com/publish/formats/rss-0.91.dtd">
      <rss version="0.91"><channel><title>Old &amp; gold</title></channel></rss>
      """

      assert {:ok, root} = Xml.parse(xml)
      assert root |> Xml.child("channel") |> Xml.child_text("title") == "Old & gold"
    end

    test "does not create atoms from element or attribute names" do
      suffix = System.unique_integer([:positive])
      element = "element_never_seen_before_#{suffix}"
      attribute = "attribute_never_seen_before_#{suffix}"

      assert {:ok, _root} = Xml.parse(~s(<#{element} #{attribute}="1"/>))

      assert_raise ArgumentError, fn -> String.to_existing_atom(element) end
      assert_raise ArgumentError, fn -> String.to_existing_atom(attribute) end
    end
  end
end
