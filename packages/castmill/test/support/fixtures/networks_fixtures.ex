defmodule Castmill.NetworksFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Castmill.Networks` context.
  """

  @doc """
  Generate a network.
  """
  def network_fixture(attrs \\ %{}) do
    unique_id = System.unique_integer([:positive])

    {:ok, network} =
      attrs
      |> Enum.into(%{
        copyright: "some copyright",
        domain: "http://localhost:#{3000 + unique_id}",
        email: "some@email.com",
        logo: "some logo",
        name: "some name #{unique_id}"
      })
      |> Castmill.Networks.create_network()

    network
  end
end
