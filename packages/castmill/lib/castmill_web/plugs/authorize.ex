defmodule Castmill.Plug.Authorize do
  @moduledoc """
  Authorizes an user to access a given child resource with the given access level and an optional id.

  The authorization process is designed around parent/child resources. The parent resource is used to
  determine if the given user has access to the child resource.

  The system parent is a special parent that only the root user has access to.

  The hierarchy of resources looks like this:
    system
      user
      network
        organization
          media
          playlist
          widgets
          calendars
          devices
          etc.
          team
            media
            playlist
            widgets
            calendars
            devices
            etc.
  """
  import Plug.Conn
  alias Castmill.Protocol.Access

  def init(default), do: default

  def call(conn, %{:parent => parent, :resource => _, :action => action}) do

    IO.inspect(conn.assigns[:current_user])
    IO.inspect(conn.assigns[parent])

    # Check if user is root, and in that case, skip the authorization process
    if conn.assigns[:current_user].is_root do
      conn
    else
      with {:ok, true} <- Access.canAccess(conn.assigns[parent], conn.assigns[:current_user], action) do
        conn
      else
        _ -> deny_access(conn)
      end
    end
  end

  def call(conn, _) do
    if conn.assigns[:current_user].is_root do
      conn
    else
      deny_access(conn)
    end
  end

  defp deny_access(conn) do
    conn
    |> put_status(:forbidden)
    |> Phoenix.Controller.json(%{message: "You do not have access to this resource."})
    |> halt
  end
end
