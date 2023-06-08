defmodule CastmillWeb.NetworkController do
  use CastmillWeb, :controller

  alias Castmill.Networks
  alias Castmill.Networks.Network

  action_fallback(CastmillWeb.FallbackController)

  alias Castmill.Plug.Authorize

  plug(Authorize, %{})

  @index_params_schema %{
    name: :string,
    limit: :string,
    offset: :string,
    pattern: :string
  }

  def index(conn, params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      networks = Networks.list_networks(params)
      render(conn, :index, networks: networks)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def create(conn, network_params) do
    with {:ok, %Network{} = network} <- Networks.create_network(network_params) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/networks/#{network}")
      |> render(:show, network: network)
    end
  end

  def show(conn, %{"id" => id}) do
    network = Networks.get_network(id)
    render(conn, :show, network: network)
  end

  def update(conn, %{"id" => id, "network" => network_params}) do
    network = Networks.get_network(id)

    with {:ok, %Network{} = network} <- Networks.update_network(network, network_params) do
      render(conn, :show, network: network)
    end
  end

  def delete(conn, %{"id" => id}) do
    network = Networks.get_network(id)

    with {:ok, %Network{}} <- Networks.delete_network(network) do
      send_resp(conn, :no_content, "")
    end
  end
end
