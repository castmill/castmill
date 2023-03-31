defmodule CastmillWeb.AccessTokenController do
  use CastmillWeb, :controller

  alias Castmill.Accounts
  alias Castmill.Accounts.AccessToken

  action_fallback CastmillWeb.FallbackController

  def index(conn, _params) do
    access_tokens = Accounts.list_access_tokens()
    render(conn, :index, access_tokens: access_tokens)
  end

  def create(conn, %{"access_token" => access_token_params}) do
    with {:ok, %AccessToken{} = access_token} <- Accounts.create_access_token(access_token_params) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/access_tokens/#{access_token}")
      |> render(:show, access_token: access_token)
    end
  end

  def show(conn, %{"id" => id}) do
    access_token = Accounts.get_access_token!(id)
    render(conn, :show, access_token: access_token)
  end

  def update(conn, %{"id" => id, "access_token" => access_token_params}) do
    access_token = Accounts.get_access_token!(id)

    with {:ok, %AccessToken{} = access_token} <- Accounts.update_access_token(access_token, access_token_params) do
      render(conn, :show, access_token: access_token)
    end
  end

  def delete(conn, %{"id" => id}) do
    access_token = Accounts.get_access_token!(id)

    with {:ok, %AccessToken{}} <- Accounts.delete_access_token(access_token) do
      send_resp(conn, :no_content, "")
    end
  end
end
