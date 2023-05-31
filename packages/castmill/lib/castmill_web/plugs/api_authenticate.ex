defmodule Castmill.Plug.ApiAuthenticate do
  import Plug.Conn

  def init(default), do: default

  def call(conn, _) do
    conn = fetch_query_params(conn)

    case Castmill.Accounts.get_user_by_access_token(
           conn.params["authenticationToken"],
           conn.remote_ip |> :inet_parse.ntoa() |> to_string()
         ) do
      {:error, message} ->
        conn
        |> put_status(:unauthorized)
        |> Phoenix.Controller.json(%{message: message})
        |> halt

      {:not_found, message} ->
        conn
        |> put_status(:unauthorized)
        |> Phoenix.Controller.json(%{message: message})
        |> halt

      user ->
        conn
        |> assign(:current_user, user)
    end
  end
end
