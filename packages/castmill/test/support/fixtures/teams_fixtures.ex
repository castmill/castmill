defmodule Castmill.TeamsFixtures do
  @moduledoc """
  This module defines test helpers for creating teams related entities.
  """

  @doc """
  """
  def team_fixture(attrs \\ %{}) do
    {:ok, team} =
      attrs
      |> Enum.into(%{
        name: "Core Team"
      })
      |> Castmill.Teams.create_team()

    team
  end
end
