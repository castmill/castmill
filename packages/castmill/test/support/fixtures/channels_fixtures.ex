defmodule Castmill.ChannelsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  channels related entities.
  """

  @doc """
  Generate a channel.
  """
  def channel_fixture(attrs \\ %{}) do
    {:ok, channel} =
      attrs
      |> Enum.into(%{
        name: "Hangar 42"
      })
      |> Castmill.Resources.create_channel()

    channel
  end

  def channel_entry_fixture(channel_id, attrs \\ %{}) do
    # Convert atom keys to string keys and handle DateTime values
    attrs =
      attrs
      |> Enum.into(%{})
      |> Enum.map(fn
        {key, %DateTime{} = value} -> {to_string(key), DateTime.to_unix(value, :millisecond)}
        {key, value} -> {to_string(key), value}
      end)
      |> Enum.into(%{})
      |> Map.merge(%{
        "start" => "2020-01-01 00:00:00",
        "end" => "2020-01-01 05:00:00"
      }, fn _k, v1, _v2 -> v1 end)

    {:ok, channel_entry} = Castmill.Resources.add_channel_entry(channel_id, attrs)

    channel_entry
  end
end
