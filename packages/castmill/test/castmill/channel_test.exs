defmodule Castmill.Resources.ChannelTest do
  use ExUnit.Case, async: true

  alias Castmill.Resources.Channel

  describe "JSON encoding" do
    test "includes default and current playlist names" do
      channel = %Channel{
        id: 1,
        name: "Lobby",
        timezone: "UTC",
        default_playlist_id: 10,
        default_playlist_name: "Default playlist",
        current_playlist_name: "Scheduled playlist"
      }

      assert %{
               "default_playlist_name" => "Default playlist",
               "current_playlist_name" => "Scheduled playlist"
             } = channel |> Jason.encode!() |> Jason.decode!()
    end

    test "includes null playlist names when none are available" do
      channel = %Channel{id: 1, name: "Lobby", timezone: "UTC"}

      assert %{
               "default_playlist_name" => nil,
               "current_playlist_name" => nil
             } = channel |> Jason.encode!() |> Jason.decode!()
    end
  end
end
