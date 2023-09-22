defmodule CastmillWeb.NetworkJSON do
  alias Castmill.Networks.Network

  @doc """
  Renders a list of networks.
  """
  def index(%{networks: networks}) do
    %{data: for(network <- networks, do: data(network))}
  end

  @doc """
  Renders a single network.
  """
  def show(%{network: network}) do
    %{data: data(network)}
  end

  defp data(%Network{} = network) do
    %{
      id: network.id,
      name: network.name,
      copyright: network.copyright,
      email: network.email,
      logo: network.logo,
      domain: network.domain
    }
  end
end
