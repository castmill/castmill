defmodule CastmillWeb.AddonsController do
  use CastmillWeb, :controller
  require Logger

  alias Castmill.Accounts

  action_fallback(CastmillWeb.FallbackController)

  @doc """
    List all addons available for the current signed-in user.
  """
  def index(conn, _params) do
    # Get user from session
    user = get_session(conn, :user)

    if is_nil(user) do
      conn
      |> put_status(:unauthorized)
      |> json(%{message: "Not logged in"})
    else
      conn
      |> put_status(:ok)
      |> json(Accounts.list_addons(user.id))
    end
  end
end
