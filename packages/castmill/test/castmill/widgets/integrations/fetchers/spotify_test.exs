defmodule Castmill.Widgets.Integrations.Fetchers.SpotifyTest do
  use ExUnit.Case, async: false
  
  alias Castmill.Widgets.Integrations.Fetchers.Spotify
  
  @moduletag :integration
  
  describe "transform_to_widget_data/1" do
    test "transforms Spotify API response to widget data schema" do
      spotify_response = %{
        "item" => %{
          "name" => "Bohemian Rhapsody",
          "artists" => [%{"name" => "Queen"}],
          "album" => %{
            "name" => "A Night at the Opera",
            "images" => [
              %{"url" => "https://i.scdn.co/image/large.jpg", "height" => 640, "width" => 640},
              %{"url" => "https://i.scdn.co/image/medium.jpg", "height" => 300, "width" => 300},
              %{"url" => "https://i.scdn.co/image/small.jpg", "height" => 64, "width" => 64}
            ]
          },
          "duration_ms" => 354320
        },
        "progress_ms" => 120000,
        "is_playing" => true
      }
      
      # Access private function for testing via apply
      result = apply(Spotify, :transform_to_widget_data, [spotify_response])
      
      assert result["track_name"] == "Bohemian Rhapsody"
      assert result["artist_name"] == "Queen"
      assert result["album_name"] == "A Night at the Opera"
      assert result["album_art_url"] == "https://i.scdn.co/image/large.jpg"
      assert result["duration_ms"] == 354320
      assert result["duration_formatted"] == "5:54"
      assert result["progress_ms"] == 120000
      assert result["progress_formatted"] == "2:00"
      assert String.starts_with?(result["progress_percent"], "33.")
      assert result["is_playing"] == true
    end
    
    test "handles multiple artists" do
      spotify_response = %{
        "item" => %{
          "name" => "Thriller",
          "artists" => [
            %{"name" => "Michael Jackson"},
            %{"name" => "Vincent Price"}
          ],
          "album" => %{
            "name" => "Thriller",
            "images" => [
              %{"url" => "https://i.scdn.co/image/large.jpg", "height" => 640, "width" => 640}
            ]
          },
          "duration_ms" => 357000
        },
        "progress_ms" => 0,
        "is_playing" => false
      }
      
      result = apply(Spotify, :transform_to_widget_data, [spotify_response])
      
      assert result["artist_name"] == "Michael Jackson, Vincent Price"
    end
  end
  
  describe "get_no_track_data/0" do
    test "returns placeholder data when nothing is playing" do
      result = apply(Spotify, :get_no_track_data, [])
      
      assert result["track_name"] == "No track playing"
      assert result["artist_name"] == "Spotify"
      assert result["album_name"] == ""
      assert result["duration_ms"] == 0
      assert result["progress_ms"] == 0
      assert result["is_playing"] == false
    end
  end
  
  describe "format_time/1" do
    test "formats milliseconds to MM:SS" do
      assert apply(Spotify, :format_time, [0]) == "0:00"
      assert apply(Spotify, :format_time, [1000]) == "0:01"
      assert apply(Spotify, :format_time, [60000]) == "1:00"
      assert apply(Spotify, :format_time, [65000]) == "1:05"
      assert apply(Spotify, :format_time, [354320]) == "5:54"
      assert apply(Spotify, :format_time, [3600000]) == "60:00"
    end
    
    test "handles invalid input" do
      assert apply(Spotify, :format_time, [nil]) == "0:00"
      assert apply(Spotify, :format_time, ["invalid"]) == "0:00"
    end
  end
  
  # Note: Full integration tests with actual Spotify API would require:
  # 1. Test Spotify account with OAuth tokens
  # 2. Mocking HTTP requests with libraries like Mox or Tesla.Mock
  # 3. Testing token refresh flow
  # 4. Testing rate limiting handling
  #
  # For now, we test the data transformation logic which is the core functionality.
end
