defmodule Castmill.CalendarsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  calendars related entities.
  """

  @doc """
  Generate a calendar.
  """
  def calendar_fixture(attrs \\ %{}) do
    {:ok, calendar} =
      attrs
      |> Enum.into(%{
        name: "Hangar 42",
      })
      |> Castmill.Resources.create_calendar()
      calendar
  end

  def calendar_entry_fixture(calendar_id, attrs \\ %{}) do
    {:ok, calendar_entry} =
      attrs
      |> Enum.into(%{
        start: "2020-01-01 00:00:00",
        end: "2020-01-01 05:00:00",
      })
      |> Castmill.Resources.add_calendar_entry(calendar_id)
      calendar_entry
  end
end
