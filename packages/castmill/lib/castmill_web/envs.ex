defmodule CastmillWeb.Envs do
  # Configure some environment specific settings
  def get_dashboard_uri do
    System.get_env("CASTMILL_DASHBOARD_URI") || "http://localhost:3000"
  end

  def get_dashboard_user_token_salt do
    System.get_env("CASTMILL_DASHBOARD_USER_SALT") || "user session"
  end
end
