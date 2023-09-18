defmodule CastmillWeb.FallbackController do
  @moduledoc """
  Translates controller action results into valid `Plug.Conn` responses.

  See `Phoenix.Controller.action_fallback/1` for more details.
  """
  use CastmillWeb, :controller

  # This clause handles errors returned by Ecto's insert/update/delete.
  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    conn
    |> put_status(:unprocessable_entity)
    |> put_view(CastmillWeb.ChangesetJSON)
    |> put_resp_content_type("application/json")
    |> render("error.json", changeset: changeset)
  end

  def call(conn, {:error, %Ecto.ChangeError{} = changeset}) do
    conn
    |> put_status(:bad_request)
    |> json(%{"error" => changeset.message})
  end

  def call(conn, %Ecto.NoResultsError{}) do
    conn
    |> put_status(:not_found)
    |> put_view(json: CastmillWeb.ErrorJSON)
    |> render(:error, %{msg: "Resource not found"})
  end

  # This clause is an example of how to handle resources that cannot be found.
  def call(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> put_view(html: CastmillWeb.ErrorHTML, json: CastmillWeb.ErrorJSON)
    |> render(:"404")
  end

  def call(conn, {:error, %{msg: msg}}) do
    conn
    |> put_status(:unprocessable_entity)
    |> put_view(json: CastmillWeb.ErrorJSON)
    |> render(:error, %{msg: msg})
  end

  def call(conn, {:error, type}) do
    conn
    |> put_status(:unprocessable_entity)
    |> put_view(json: CastmillWeb.ErrorJSON)
    |> render(:error, %{msg: type})
  end

  # Catch all fallback
  def call(conn, _unhandled_error) do
    conn
    |> put_status(:internal_server_error)
    |> render(:error, %{msg: "Unexpected error"})
  end
end
