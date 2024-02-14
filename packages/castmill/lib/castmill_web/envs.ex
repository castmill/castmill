defmodule CastmillWeb.Envs do
  # Configure some environment specific settings
  def get_dashboard_uri do
    System.get_env("DASHBOARD_URI") || "http://localhost:3000"
  end
end
