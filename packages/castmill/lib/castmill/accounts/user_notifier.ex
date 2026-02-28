defmodule Castmill.Accounts.UserNotifier do
  import Swoosh.Email
  require EEx

  alias Castmill.EmailDelivery

  # Compile email templates at compile time
  @templates_dir Path.join([__DIR__, "email_templates"])

  EEx.function_from_file(
    :defp,
    :render_signup_html,
    Path.join(@templates_dir, "signup.html.eex"),
    [:assigns]
  )

  EEx.function_from_file(
    :defp,
    :render_signup_text,
    Path.join(@templates_dir, "signup.text.eex"),
    [:assigns]
  )

  # Delivers the email using the application mailer.
  defp deliver(recipient, subject, body, opts \\ []) do
    context = Keyword.get(opts, :context, "user_notifier.text")
    metadata = Keyword.get(opts, :metadata, %{})

    email =
      new()
      |> to(recipient)
      |> from({"Castmill", System.get_env("MAILER_FROM") || "noreply@missing.email"})
      |> subject(subject)
      |> text_body(body)

    EmailDelivery.deliver(email, context: context, metadata: metadata)
  end

  # Delivers the email with both HTML and text body.
  defp deliver_with_html(recipient, subject, text_body, html_body, opts \\ []) do
    context = Keyword.get(opts, :context, "user_notifier.html")
    metadata = Keyword.get(opts, :metadata, %{})

    email =
      new()
      |> to(recipient)
      |> from({"Castmill", System.get_env("MAILER_FROM") || "noreply@missing.email"})
      |> subject(subject)
      |> text_body(text_body)
      |> html_body(html_body)

    EmailDelivery.deliver(email, context: context, metadata: metadata)
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
  Deliver instructions to recover credentials (passkeys).
  """
  def deliver_recover_credentials_instructions(user, url) do
    deliver(user.email, "Recover your credentials", """

    ==============================

    Hi #{user.email},

    You requested to recover access to your Castmill account.

    You can add a new passkey to your account by visiting the URL below:

    #{url}

    This link will expire in 5 minutes.

    If you didn't request this, please ignore this email.

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
  Deliver email verification instructions for new email address.
  """
  def deliver_email_verification_instructions(user, new_email, token) do
    # Send verification email to the NEW email address
    deliver(new_email, "Verify your new email address", """

    ==============================

    Hi #{user.name},

    You requested to change your email address for your Castmill account.

    To prevent account lockout, please verify your new email address by clicking the link below:

    #{verification_url(token)}

    Your email address will only be updated after verification is complete.

    If you didn't request this change, please ignore this email.

    ==============================
    """)
  end

  defp verification_url(token) do
    # This would be configured based on your frontend URL
    dashboard_url = System.get_env("DASHBOARD_URL") || "http://localhost:3000"
    "#{dashboard_url}/verify-email?token=#{token}"
  end

  @doc """
  Deliver Signup instructions.
  """
  def deliver_signup_instructions(signup, dashboard_uri) do
    url = signup_url(signup, dashboard_uri)

    assigns = %{
      email: signup.email,
      signup_url: url,
      year: DateTime.utc_now().year
    }

    html_body = render_signup_html(assigns)
    text_body = render_signup_text(assigns)

    deliver_with_html(
      signup.email,
      "Complete Your Castmill Signup",
      text_body,
      html_body
    )
  end

  @doc """
  Deliver network invitation instructions.
  """
  def deliver_network_invitation_instructions(invitation, dashboard_uri, opts \\ []) do
    invitation_url =
      "#{dashboard_uri}/?email=#{URI.encode_www_form(invitation.email)}"

    deliver(
      invitation.email,
      "You're invited to join #{invitation.organization_name} on Castmill",
      """

      ==============================

      Hi,

      You've been invited to create and manage the organization \"#{invitation.organization_name}\".

      To continue, open the dashboard:

      #{invitation_url}

      Then continue with this invitation token:

      #{invitation.token}

      This invitation expires at: #{invitation.expires_at}

      ==============================
      """,
      opts
    )
  end

  defp signup_url(
         %Castmill.Accounts.SignUp{id: id, email: email, challenge: challenge},
         dashboard_uri
       ) do
    "#{dashboard_uri}/signup/?signup_id=#{id}&email=#{email}&challenge=#{challenge}"
  end
end
