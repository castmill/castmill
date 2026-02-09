defmodule CastmillWeb.SessionUtils do
  use CastmillWeb, :controller

  alias Castmill.Accounts
  alias Castmill.Accounts.User
  alias Castmill.Organizations.Organization

  @doc """
    Log-in a user and apply a redirect
  """
  def log_in_user_with_redirect(_conn, _user_id, _params \\ %{}) do
    #   user_return_to = get_session(conn, :user_return_to)

    #   conn
    #   |> log_in_user(user_id, params)
    #   |> redirect(to: user_return_to || signed_in_path(conn))
  end

  @doc """
    Log-in a user in the session.
    Returns {:error, reason} if the user or any of their organizations are blocked.
  """
  def log_in_user(conn, user_id, params \\ %{}) do
    user = Accounts.get_user(user_id)

    case check_user_blocked_status(user) do
      {:ok, _user} ->
        token = accounts_module().generate_user_session_token(user_id)

        conn
        |> renew_session()
        |> put_session(:user, user)
        |> put_token_in_session(token)
        |> maybe_write_remember_me_cookie(token, params)

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Checks if a user or any of their organizations are blocked.
  Returns {:ok, user} if not blocked, {:error, reason} if blocked.

  Note: Network admins are exempt from organization blocking - they can always
  login regardless of their organization's blocked status. This ensures admins
  can never be accidentally locked out of the system.
  """
  def check_user_blocked_status(nil), do: {:error, :user_not_found}

  def check_user_blocked_status(user) do
    cond do
      # Users can always be blocked directly
      User.blocked?(user) ->
        reason = user.blocked_reason || "Your account has been blocked"
        {:error, {:user_blocked, reason}}

      # Network admins are exempt from organization blocking
      is_network_admin?(user) ->
        {:ok, user}

      # Regular users can be blocked via their organization
      blocked_org = find_blocked_organization(user) ->
        reason = blocked_org.blocked_reason || "Your organization has been blocked"
        {:error, {:organization_blocked, reason}}

      true ->
        {:ok, user}
    end
  end

  @doc """
  Checks if a user is a network admin.
  Network admins have special privileges and cannot be locked out via organization blocking.
  """
  def is_network_admin?(%User{network_role: :admin}), do: true
  def is_network_admin?(_user), do: false

  defp find_blocked_organization(user) do
    # Preload organizations if not already loaded
    user = Castmill.Repo.preload(user, :organizations)

    Enum.find(user.organizations, fn org ->
      Organization.blocked?(org)
    end)
  end

  @doc """
    Creates a new cryptografically secure challenge.
  """
  def new_challenge() do
    :crypto.strong_rand_bytes(64)
    |> Base.url_encode64(padding: false)
  end

  defp renew_session(conn) do
    conn
    |> configure_session(drop: true)
    |> configure_session(renew: true)
  end

  defp put_token_in_session(conn, token) do
    put_session(conn, :user_session_token, token)
  end

  defp maybe_write_remember_me_cookie(conn, token, params) do
    if Map.get(params, "remember_me", false) do
      conn
      # 30 days
      |> put_resp_cookie("remember_me_token", token, max_age: 60 * 60 * 24 * 30)
    else
      conn
    end
  end

  @doc """
    Verifies that client data has the expected values and returns the challenge.
    Accepts either a map or a JSON string/charlist.
  """
  def check_client_data_json(client_data) when is_list(client_data) or is_binary(client_data) do
    # Parse JSON string/charlist to map
    case Jason.decode(to_string(client_data)) do
      {:ok, parsed} -> check_client_data_json(parsed)
      {:error, _} -> false
    end
  end

  def check_client_data_json(%{
        "type" => type,
        "challenge" => challenge,
        "origin" => origin
      })
      when type in ["webauthn.get", "webauthn.create"] do
    # Check if there is a network matching the origin
    network_id = Accounts.get_network_id_by_domain(origin)

    if network_id do
      {:ok, challenge}
    else
      false
    end
  end

  def check_client_data_json(_), do: false

  # This will allow us to swap the Accounts module for a mock in the tests
  defp accounts_module do
    Application.get_env(:castmill, :accounts)
  end
end
