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

  def version(conn, _params) do
    conn
    |> put_status(:ok)
    |> json(%{
      status: "ok",
      build: %{
        castmill_git_sha: System.get_env("CASTMILL_GIT_SHA") || "unknown",
        built_at: System.get_env("CASTMILL_BUILD_TIME") || "unknown"
      },
      versions: %{
        castmill: app_version(:castmill)
      }
    })
  end

  defp app_version(app) do
    case Application.spec(app, :vsn) do
      nil -> nil
      vsn when is_list(vsn) -> List.to_string(vsn)
      vsn -> to_string(vsn)
    end
  end
end
