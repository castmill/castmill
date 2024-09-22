defmodule Castmill.NetworksFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Castmill.Networks` context.
  """

  @doc """
  Generate a network.
  """
  def network_fixture(attrs \\ %{}) do
    {:ok, network} =
      attrs
      |> Enum.into(%{
        copyright: "some copyright",
        domain: "http://localhost:3000",
        email: "some@email.com",
        logo: "some logo",
        name: "some name"
      })
      |> Castmill.Networks.create_network()

    network
  end
end
