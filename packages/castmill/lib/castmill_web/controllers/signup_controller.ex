defmodule CastmillWeb.SignUpController do
  use CastmillWeb, :controller
  require Logger

  alias Castmill.Accounts
  alias Castmill.Accounts.UserNotifier
  alias CastmillWeb.SessionUtils

  action_fallback(CastmillWeb.FallbackController)

  @doc """
    Create a new signup. The Signup starts the signup process for a new user.
  """
  def create(conn, %{"email" => nil}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{status: :error, msg: "Missing email"})
  end

  def create(conn, %{"email" => email}) do
    origin = List.first(Plug.Conn.get_req_header(conn, "origin"))

    if is_nil(origin) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{status: :error, msg: "Missing origin"})
    else
      case Accounts.get_network_id_by_domain(origin) do
        network_id ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{status: :error, msg: "Network not found"})

          challenge = SessionUtils.new_challenge()
          params = %{"email" => email, "challenge" => challenge, "network_id" => network_id}

          case Accounts.create_signup(params) do
            {:ok, signup} ->
              UserNotifier.deliver_signup_instructions(signup, origin)

              conn
              |> put_status(:created)
              |> json(%{status: :ok, signup: signup})

            {:error, _changeset} ->
              conn
              |> put_status(:unprocessable_entity)
              |> json(%{status: :error})
          end
      end
    end
  rescue
    error ->
      conn
      |> put_status(:internal_server_error)
      |> json(%{status: :error, msg: "Unexpected error: #{inspect(error)}"})
  end

  @doc """
    Create a new user from a signup and passkey authentication.
  """
  def create_user(conn, %{
        "id" => signup_id,
        "email" => email,
        "credential_id" => credential_id,
        "public_key_spki" => public_key_spki
      }) do
    public_key_spki = Base.decode64!(public_key_spki)

    case Accounts.create_user_from_signup(signup_id, email, credential_id, public_key_spki) do
      {:ok, %{id: user_id} = user} ->
        conn
        |> put_session(:user, user)
        |> SessionUtils.log_in_user(user_id)
        |> put_status(:created)
        |> json(%{status: :ok, user: user})

      {:error, message} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          status: :error,
          message: message
        })
    end
  end
end
