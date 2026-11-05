defmodule CastmillWeb.UserPreferencesController do
  @moduledoc """
  Reads and updates the current user's dashboard UI preferences, such as the
  light/dark theme. Users can only access their own preferences.
  """
  use CastmillWeb, :controller

  alias Castmill.Accounts

  def show(conn, %{"user_id" => user_id}) do
    case fetch_own_user(conn, user_id) do
      {:ok, user} -> json(conn, %{data: Accounts.get_user_preferences(user)})
      error -> render_error(conn, error)
    end
  end

  def update(conn, %{"user_id" => user_id} = params) do
    preferences = Map.get(params, "preferences", %{})

    with {:ok, user} <- fetch_own_user(conn, user_id),
         {:ok, updated_user} <- Accounts.update_user_preferences(user, preferences) do
      json(conn, %{data: Accounts.get_user_preferences(updated_user)})
    else
      error -> render_error(conn, error)
    end
  end

  defp fetch_own_user(conn, user_id) do
    case conn.assigns[:current_user] do
      %{id: ^user_id} ->
        case Accounts.get_user(user_id) do
          nil -> {:error, :forbidden}
          user -> {:ok, user}
        end

      _ ->
        {:error, :forbidden}
    end
  end

  defp render_error(conn, {:error, :forbidden}) do
    conn
    |> put_status(:forbidden)
    |> json(%{error: "Not authorized to access this resource"})
  end

  defp render_error(conn, {:error, :invalid_preferences}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "Invalid preferences"})
  end

  defp render_error(conn, {:error, _reason}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "Failed to update preferences"})
  end
end
