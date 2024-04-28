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
  def create(conn, %{"email" => email}) do
    challenge = SessionUtils.new_challenge()

    params = %{"email" => email, "challenge" => challenge}

    # Based on the domain, we need to determine which network the user is signing up for
    # and set the network_id in the params.
    # This is a simplified version of the code, in a real-world scenario, we would need to
    # check the domain against a list of known domains and set the network_id accordingly.
    domain = conn.host
    network_id = Accounts.get_network_id_by_domain(domain)

    if network_id == nil do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{status: :error, msg: "Network not found"})
    else
      params = Map.put(params, "network_id", network_id)

      if email == nil do
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{status: :error, msg: "Email is required"})
      else
        # TODO: What if the email is already in use?
        # We should probably need to ignore this signup attempt, communicating
        # the user that the email exists will reveal confidential information
        # about our users.
        case Accounts.create_signup(params) do
          {:ok, signup} ->
            UserNotifier.deliver_signup_instructions(signup)

            # Return the signup
            conn
            # |> put_session(:challenge, challenge)
            |> put_status(:created)
            |> json(%{status: :ok, signup: signup})

          {:error, _changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{status: :error})

            conn
            |> put_status(:created)
            |> send_resp(:no_content, "")
        end
      end
    end
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
