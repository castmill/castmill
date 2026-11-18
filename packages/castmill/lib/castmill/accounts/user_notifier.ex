defmodule Castmill.Accounts.UserNotifier do
  import Swoosh.Email
  require EEx

  alias Castmill.EmailBrand
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

  EEx.function_from_file(
    :defp,
    :render_already_registered_html,
    Path.join(@templates_dir, "already_registered.html.eex"),
    [:assigns]
  )

  EEx.function_from_file(
    :defp,
    :render_already_registered_text,
    Path.join(@templates_dir, "already_registered.text.eex"),
    [:assigns]
  )

  # Delivers the email using the application mailer, branded as `opts[:brand]`
  # (Castmill by default).
  defp deliver(recipient, subject, body, opts \\ []) do
    context = Keyword.get(opts, :context, "user_notifier.text")
    metadata = Keyword.get(opts, :metadata, %{})
    brand = Keyword.get(opts, :brand, EmailBrand.castmill())

    email =
      new()
      |> to(recipient)
      |> EmailBrand.put_sender(brand)
      |> subject(subject)
      |> text_body(body)

    EmailDelivery.deliver(email, context: context, metadata: metadata)
  end

  # Delivers the email with both HTML and text body.
  defp deliver_with_html(recipient, subject, text_body, html_body, opts) do
    context = Keyword.get(opts, :context, "user_notifier.html")
    metadata = Keyword.get(opts, :metadata, %{})
    brand = Keyword.get(opts, :brand, EmailBrand.castmill())

    email =
      new()
      |> to(recipient)
      |> EmailBrand.put_sender(brand)
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
  Deliver instructions to recover credentials (passkeys), branded as the
  network whose dashboard the user recovers from.
  """
  def deliver_recover_credentials_instructions(user, url, brand \\ EmailBrand.castmill()) do
    deliver(
      user.email,
      "Recover your credentials",
      """

      ==============================

      Hi #{user.email},

      You requested to recover access to your #{brand.name} account.

      You can add a new passkey to your account by visiting the URL below:

      #{url}

      This link will expire in 5 minutes.

      If you didn't request this, please ignore this email.

      ==============================
      """,
      brand: brand
    )
  end

  @doc """
  Deliver the passkey setup link to a new network admin.
  """
  def deliver_network_admin_setup_instructions(user, network, url) do
    deliver(
      user.email,
      "You are an administrator of #{network.name}",
      """

      ==============================

      Hi #{user.email},

      You have been made an administrator of the network #{network.name}.

      To sign in, create a passkey for #{network.domain} by visiting the URL below:

      #{url}

      This link expires in 7 days and can be used once.

      If you were not expecting this, please ignore this email.

      ==============================
      """,
      brand: EmailBrand.for_network(network)
    )
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

    You requested to change the email address of your account.

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
    brand = EmailBrand.for_network(signup.network_id)
    assigns = %{email: signup.email, signup_url: url}

    html_body = render_signup_html(Map.put(assigns, :brand, EmailBrand.html_escape(brand)))
    text_body = render_signup_text(Map.put(assigns, :brand, brand))

    deliver_with_html(
      signup.email,
      "Complete Your #{brand.name} Signup",
      text_body,
      html_body,
      brand: brand
    )
  end

  @doc """
  Deliver a notice to an existing user who tried to sign up again.
  Informs them they already have an account and directs them to log in.
  """
  def deliver_already_registered_notice(email, dashboard_uri) do
    login_url = "#{dashboard_uri}/login?email=#{URI.encode_www_form(email)}"
    brand = EmailBrand.for_origin(dashboard_uri)
    assigns = %{email: email, login_url: login_url}

    html_body =
      render_already_registered_html(Map.put(assigns, :brand, EmailBrand.html_escape(brand)))

    text_body = render_already_registered_text(Map.put(assigns, :brand, brand))

    deliver_with_html(
      email,
      "#{brand.name} — You Already Have an Account",
      text_body,
      html_body,
      brand: brand
    )
  end

  @doc """
  Deliver network invitation instructions.
  """
  def deliver_network_invitation_instructions(invitation, dashboard_uri, opts \\ []) do
    invitation_url =
      "#{dashboard_uri}/?email=#{URI.encode_www_form(invitation.email)}"

    brand = EmailBrand.for_network(invitation.network_id)

    deliver(
      invitation.email,
      "You're invited to join #{invitation.organization_name} on #{brand.name}",
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
      Keyword.put(opts, :brand, brand)
    )
  end

  defp signup_url(
         %Castmill.Accounts.SignUp{id: id, email: email, challenge: challenge},
         dashboard_uri
       ) do
    "#{dashboard_uri}/signup/?signup_id=#{id}&email=#{email}&challenge=#{challenge}"
  end
end
