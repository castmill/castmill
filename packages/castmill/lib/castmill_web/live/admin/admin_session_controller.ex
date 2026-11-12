defmodule CastmillWeb.AdminSessionController do
  use CastmillWeb, :controller

  alias Castmill.Accounts
  alias Castmill.Accounts.AdminPasskeys
  alias CastmillWeb.Admin.UserAuth

  plug :rate_limit when action in [:create]

  def create(conn, %{"user" => %{"email" => email, "password" => password}})
      when is_binary(email) and is_binary(password) do
    token = email <> ":" <> password
    ip = conn |> Utils.RemoteIp.client_ip() |> :inet.ntoa() |> to_string()

    case Accounts.get_user_by_access_token(token, ip) do
      {:ok, %{is_root: true} = user} ->
        if AdminPasskeys.root_user?(user) && !AdminPasskeys.enrolled?(user.id) do
          conn
          |> put_flash(:info, "Register your first admin passkey to continue.")
          |> UserAuth.start_enrollment(user)
        else
          invalid_login(conn, email)
        end

      _ ->
        invalid_login(conn, email)
    end
  end

  def create(conn, _params), do: invalid_login(conn, "")

  defp invalid_login(conn, email) do
    conn
    |> put_flash(:error, "Unable to sign in. Use your admin passkey if already enrolled.")
    |> put_flash(:email, String.slice(email, 0, 160))
    |> redirect(to: ~p"/admin/login")
  end

  def delete(conn, _params) do
    conn
    |> put_flash(:info, "Logged out successfully.")
    |> UserAuth.log_out_user()
  end

  defp rate_limit(conn, _opts) do
    case Castmill.RateLimiter.allow({:admin_password, Utils.RemoteIp.client_ip(conn)}, 10) do
      :ok ->
        conn

      {:error, :rate_limited} ->
        conn
        |> put_flash(:error, "Too many attempts. Try again in a minute.")
        |> redirect(to: ~p"/admin/login")
        |> halt()
    end
  end
end
