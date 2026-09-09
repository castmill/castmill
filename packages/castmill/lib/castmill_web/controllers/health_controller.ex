defmodule CastmillWeb.HealthController do
  @moduledoc """
  Health-related endpoints for load balancer and container probes.

  * `check/2` – minimal health check returning 200 OK with `{"status": "ok"}`.
  * `version/2` – extended health payload including build and application
    version metadata, also returning 200 OK when the service is healthy.
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
