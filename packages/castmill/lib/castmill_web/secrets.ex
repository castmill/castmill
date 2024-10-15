defmodule CastmillWeb.Secrets do
  @moduledoc """
  A module providing secrets for the Castmill application. Secrets can be fetched via environment variables, but if possible
  they should be stored in files. This is to prevent secrets from being leaked in the environment. In that case the filenames
  are stored in the environment variables.
  """

  def get_dashboard_user_token_salt do
    get_env_or_file_value("CASTMILL_DASHBOARD_USER_SALT", "user session")
  end

  def get_root_user_email do
    get_env_or_file_value("CASTMILL_ROOT_USER_EMAIL", "root@example.com")
  end

  def get_root_user_password do
    get_env_or_file_value("CASTMILL_ROOT_USER_PASSWORD", "root")
  end

  def get_database_url do
    get_env_or_file_value("DATABASE_URL")
  end

  def get_secret_key_base do
    get_env_or_file_value(
      "SECRET_KEY_BASE",
      "IQmKkVEDXFqnIx+tOIZRyd+qDvEYrUOcTGN0iQ/QgYcGsTLkA6A4UTgBYXti5lic"
    )
  end

  def get_aws_access_key_id do
    get_env_or_file_value("AWS_ACCESS_KEY_ID")
  end

  def get_aws_secret_access_key do
    get_env_or_file_value("AWS_SECRET_ACCESS_KEY")
  end

  def get_mailgun_api_key do
    get_env_or_file_value("MAILGUN_API_KEY")
  end

  defp get_env_or_file_value(env_var_name, default \\ nil) do
    case System.get_env(env_var_name) do
      value when value in [nil, "", false] ->
        filename_env_var = env_var_name <> "_FILENAME"
        filename = System.get_env(filename_env_var)

        if filename in [nil, "", false] do
          if default != nil do
            default
          else
            raise "Environment variable #{env_var_name} and #{filename_env_var} are both unset or empty."
          end
        else
          File.read!(filename) |> String.trim()
        end

      value ->
        value
    end
  end
end
