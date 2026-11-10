defmodule Castmill.Feeds.MediaTypeTest do
  use ExUnit.Case, async: true

  alias Castmill.Feeds.MediaType

  test "detects images and videos from their bytes" do
    for {bytes, type, ext} <- [
          {<<0xFF, 0xD8, 0xFF, 0xE0, 0, 0>>, "image/jpeg", "jpg"},
          {<<0x89, "PNG", 0x0D, 0x0A, 0x1A, 0x0A, 0>>, "image/png", "png"},
          {"GIF89a....", "image/gif", "gif"},
          {"GIF87a....", "image/gif", "gif"},
          {"RIFF\0\0\0\0WEBPVP8 ", "image/webp", "webp"},
          {<<0x1A, 0x45, 0xDF, 0xA3, 0>>, "video/webm", "webm"},
          {<<0, 0, 0, 0x18, "ftypqt  ", 0>>, "video/quicktime", "mov"},
          {<<0, 0, 0, 0x18, "ftypisom", 0>>, "video/mp4", "mp4"}
        ] do
      assert {:ok, %{content_type: ^type, extension: ^ext}} = MediaType.detect(bytes)
    end

    assert {:ok, %{kind: :image}} = MediaType.detect(<<0xFF, 0xD8, 0xFF, 0>>, "image/jpeg")
    assert {:ok, %{kind: :video}} = MediaType.detect(<<0, 0, 0, 0, "ftypmp42">>, "video/mp4")
  end

  test "rejects other content" do
    assert MediaType.detect("<html>Not found</html>") == {:error, :unsupported_type}
    assert MediaType.detect(<<0, 0, 0, 0x18, "ftypheic", 0>>) == {:error, :unsupported_type}

    assert MediaType.detect("<svg xmlns=\"http://www.w3.org/2000/svg\"/>") ==
             {:error, :unsupported_type}
  end

  test "rejects bytes whose Content-Type contradicts them" do
    jpeg = <<0xFF, 0xD8, 0xFF, 0>>
    assert MediaType.detect(jpeg, "text/html; charset=utf-8") == {:error, :unsupported_type}
    assert {:ok, _} = MediaType.detect(jpeg, "application/octet-stream")
    assert {:ok, _} = MediaType.detect(jpeg, "")
    assert {:ok, _} = MediaType.detect(jpeg, "IMAGE/PNG")
  end
end
