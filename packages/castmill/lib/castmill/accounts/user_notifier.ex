defmodule Castmill.Accounts.UserNotifier do
  import Swoosh.Email

  alias Castmill.Mailer

  # Delivers the email using the application mailer.
  defp deliver(recipient, subject, body) do
    email =
      new()
      |> to(recipient)
      |> from({"Castmill", System.get_env("MAILER_FROM")})
      |> subject(subject)
      |> text_body(body)

    with {:ok, _metadata} <- Mailer.deliver(email) do
      {:ok, email}
    end
  end

  @doc """
  Deliver instructions to confirm account.
  """
  def deliver_confirmation_instructions(user, url) do
    deliver(user.email, "Confirmation instructions", """

    ==============================

    Hi #{user.email},

    You can confirm your account by visiting the URL below:

    #{url}

    If you didn't create an account with us, please ignore this.

    ==============================
    """)
  end

  @doc """
  Deliver instructions to reset a user password.
  """
  def deliver_reset_password_instructions(user, url) do
    deliver(user.email, "Reset password instructions", """

    ==============================

    Hi #{user.email},

    You can reset your password by visiting the URL below:

    #{url}

    If you didn't request this change, please ignore this.

    ==============================
    """)
  end

  @doc """
  Deliver instructions to update a user email.
  """
  def deliver_update_email_instructions(user, url) do
    deliver(user.email, "Update email instructions", """

    ==============================

    Hi #{user.email},

    You can change your email by visiting the URL below:

    #{url}

    If you didn't request this change, please ignore this.

    ==============================
    """)
  end

  @doc """
  Deliver Signup instructions.
  """
  def deliver_signup_instructions(signup) do
    deliver(signup.email, "Signup instructions", """

    ==============================

    Hi #{signup.email},

    You can signup by visiting the URL below:

    #{signup_url(signup)}

    If you didn't request this, please ignore this.

    ==============================
    """)
  end

  defp signup_url(%Castmill.Accounts.SignUp{id: id, email: email, challenge: challenge}) do
    dashboard_uri = CastmillWeb.Envs.get_dashboard_uri()
    "#{dashboard_uri}/signup/?signup_id=#{id}&email=#{email}&challenge=#{challenge}"
  end
end
