defmodule Castmill.Feeds.MediaPathsTest do
  use ExUnit.Case, async: true

  alias Castmill.Feeds.MediaPaths

  @a "https://cdn.example.com/a.jpg"
  @b "https://cdn.example.com/b.jpg"

  test "parses paths" do
    assert MediaPaths.parse("image") == [{"image", false}]
    assert MediaPaths.parse("photos[].url") == [{"photos", true}, {"url", false}]
    assert MediaPaths.parse("post.images[]") == [{"post", false}, {"images", true}]
  end

  test "collects URLs at scalar, nested and array paths" do
    data = %{
      "image" => @a,
      "post" => %{"photo" => @b, "images" => [@a, "not a url", 3]},
      "photos" => [%{"url" => @b}, %{"url" => nil}, "x"],
      "other" => "https://cdn.example.com/c.jpg"
    }

    assert MediaPaths.collect(data, ["image", "post.photo", "post.images[]", "photos[].url"]) ==
             [@a, @b]

    assert MediaPaths.collect(data, ["missing", "image.deeper", "post.photo[]", "other[]"]) ==
             []

    assert MediaPaths.collect("not a map", ["image"]) == []
  end

  test "prefers originals when collecting" do
    data = %{
      "image" => "https://stored/1.jpg",
      "image_original" => @a,
      "images" => ["https://stored/2.jpg"],
      "images_original" => [@b]
    }

    assert MediaPaths.collect(data, ["image", "images[]"]) == [@a, @b]
  end

  test "swaps stored URLs in and restores originals" do
    ready = %{@a => "https://stored/a.jpg"}

    data = %{
      "image" => @a,
      "post" => %{"photo" => @b},
      "photos" => [%{"url" => @a}, %{"url" => @b}],
      "images" => [@a, @b]
    }

    paths = ["image", "post.photo", "photos[].url", "images[]", "missing", "post.none[].x"]
    swapped = MediaPaths.apply(data, paths, ready)

    assert swapped["image"] == "https://stored/a.jpg"
    assert swapped["image_original"] == @a
    assert swapped["post"] == %{"photo" => @b}

    assert swapped["photos"] == [
             %{"url" => "https://stored/a.jpg", "url_original" => @a},
             %{"url" => @b}
           ]

    assert swapped["images"] == ["https://stored/a.jpg", @b]
    assert swapped["images_original"] == [@a, @b]

    # Applying again is stable, and an empty map restores the originals.
    assert MediaPaths.apply(swapped, paths, ready) == swapped
    assert MediaPaths.apply(swapped, paths, %{}) == data
  end

  test "leaves non-string values alone" do
    data = %{"image" => 42, "images" => "x"}
    assert MediaPaths.apply(data, ["image", "images[]"], %{}) == data
  end

  test "accepts only http(s) URLs with a host and a sane length" do
    assert MediaPaths.media_url?(@a)
    assert MediaPaths.media_url?("http://x.test/a.png")
    refute MediaPaths.media_url?("ftp://x.test/a.png")
    refute MediaPaths.media_url?("data:image/png;base64,AAAA")
    refute MediaPaths.media_url?("https:///a.png")
    refute MediaPaths.media_url?("https://x.test/" <> String.duplicate("a", 2_100))
    refute MediaPaths.media_url?(nil)
  end
end
