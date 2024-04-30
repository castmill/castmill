defmodule Castmill.Plug.AuthorizeDash do
  @moduledoc """

  """
  import Plug.Conn

  def init(default), do: default

  def call(conn, _) do
    # Check if user is root, and in that case, skip the authorization process
    if conn.assigns[:current_user] == nil do
      deny_access(conn)
    else
      is_root = Map.get(conn.assigns[:current_user], :is_root, false)

      if is_root do
        conn
      else
        # Not sure how standard this is, but it works for now
        # action = Map.get(conn.private, :phoenix_action)
        # controller = Map.get(conn.private, :phoenix_controller)
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
