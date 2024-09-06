defmodule CastmillWeb.Envs do
  # Configure some environment specific settings
  def get_dashboard_uri do
    if(System.get_env("CASTMILL_DASHBOARD_URI") in [nil, "", false],
      do: "http://localhost:3000",
      else: System.get_env("CASTMILL_DASHBOARD_URI")
    )
  end

  def get_dashboard_user_token_salt do
    if(System.get_env("CASTMILL_DASHBOARD_USER_SALT") in [nil, "", false],
      do: "user session",
      else: System.get_env("CASTMILL_DASHBOARD_USER_SALT")
    )
  end
end
