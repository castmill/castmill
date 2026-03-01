defmodule CastmillWeb.HealthController do
  @moduledoc """
  Minimal health check endpoint for load balancer and container probes.
  Returns 200 OK with a JSON body when the application is running.
  """
  use CastmillWeb, :controller

  def check(conn, _params) do
    conn
    |> put_status(:ok)
    |> json(%{status: "ok"})
  end
end
