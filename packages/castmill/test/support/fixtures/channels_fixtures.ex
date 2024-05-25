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
    {:ok, channel_entry} =
      attrs
      |> Enum.into(%{
        start: "2020-01-01 00:00:00",
        end: "2020-01-01 05:00:00"
      })
      |> Castmill.Resources.add_channel_entry(channel_id)

    channel_entry
  end
end
