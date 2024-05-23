defmodule Castmill.Plug.AuthorizeDash do
  @moduledoc """

  """
  import Plug.Conn

  def init(default), do: default

  def call(conn, _params) do
    # Check if the user is logged in
    if conn.assigns[:current_user] == nil do
      deny_access(conn)
    else
      # Check if user is root, and in that case, skip the authorization process
      is_root = Map.get(conn.assigns[:current_user], :is_root, false)

      if is_root do
        conn
      else
        action = Phoenix.Controller.action_name(conn)
        controller = Phoenix.Controller.controller_module(conn)

        with {:ok, true} <-
               controller.check_access(
                 Map.get(conn.assigns[:current_user], :id),
                 action,
                 conn.params
               ) do
          conn
        else
          _ -> deny_access(conn)
        end
      end
    end
  end

  defp deny_access(conn) do
    conn
    |> put_status(:forbidden)
    |> Phoenix.Controller.json(%{message: "You do not have access to this resource."})
    |> halt
  end
end
