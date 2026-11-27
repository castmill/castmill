defmodule Castmill.Accounts.UserNotifier do
  @moduledoc """
  Account emails: sign-up, invitations, access recovery and email changes.
  They use `Castmill.EmailLayout` and are branded as the network they belong
  to (see `Castmill.EmailBrand`).
  """
  import Swoosh.Email

  alias Castmill.EmailBrand
  alias Castmill.EmailDelivery
  alias Castmill.EmailLayout

  # Renders `layout` (EmailLayout options) and delivers it, sent as `brand`.
  defp deliver(recipient, brand, layout, opts \\ []) do
    {html, text} = EmailLayout.render(brand, layout)

    email =
      new()
      |> to(recipient)
      |> EmailBrand.put_sender(brand)
      |> subject(Keyword.fetch!(layout, :subject))
      |> text_body(text)
      |> html_body(html)

    EmailDelivery.deliver(email,
      context: Keyword.get(opts, :context, "user_notifier"),
      metadata: Keyword.get(opts, :metadata, %{})
    )
  end

  @doc """
  Deliver instructions to confirm account.
  """
  def deliver_confirmation_instructions(user, url) do
    deliver(user.email, EmailBrand.castmill(),
      subject: "Confirm your account",
      preheader: "Confirm your email address to start using your account.",
      blocks: [
        {:heading, "Confirm your account"},
        {:text, "Confirm your email address to start using your account."},
        {:button, "Confirm account", url},
        {:link, url},
        {:note, "If you didn't create an account, you can ignore this email."}
      ]
    )
  end

  @doc """
  Deliver instructions to reset a user password.
  """
  def deliver_reset_password_instructions(user, url) do
    deliver(user.email, EmailBrand.castmill(),
      subject: "Reset your password",
      preheader: "Use this link to choose a new password.",
      blocks: [
        {:heading, "Reset your password"},
        {:text, "We received a request to reset the password of your account."},
        {:button, "Choose a new password", url},
        {:link, url},
        {:note,
         "If you didn't ask for this, you can ignore this email. Your password stays the same."}
      ]
    )
  end

  @doc """
  Deliver instructions to recover credentials (passkeys), branded as the
  network whose dashboard the user recovers from.
  """
  def deliver_recover_credentials_instructions(user, url, brand \\ EmailBrand.castmill()) do
    deliver(user.email, brand,
      subject: "Recover access to your #{brand.name} account",
      preheader: "Add a new passkey to sign in again.",
      blocks: [
        {:heading, "Recover your account"},
        {:text,
         [
           "We received a request to recover access to your ",
           {:strong, brand.name},
           " account. Add a new passkey to sign in again."
         ]},
        {:button, "Add a passkey", url},
        {:link, url},
        {:note,
         "This link expires in 5 minutes. If you didn't ask for this, you can ignore this email: your account hasn't changed."}
      ]
    )
  end

  @doc """
  Deliver the passkey setup link to a new network admin.
  """
  def deliver_network_admin_setup_instructions(user, network, url) do
    deliver(user.email, EmailBrand.for_network(network),
      subject: "You are an administrator of #{network.name}",
      preheader: "Create a passkey to sign in as an administrator.",
      blocks: [
        {:heading, "Set up your administrator access"},
        {:text, ["You've been made an administrator of ", {:strong, network.name}, "."]},
        {:text, ["Create a passkey for ", {:strong, network.domain || ""}, " to sign in."]},
        {:button, "Create a passkey", url},
        {:link, url},
        {:note,
         "This link works once and expires in 7 days. If you weren't expecting it, you can ignore this email."}
      ]
    )
  end

  @doc """
  Deliver instructions to update a user email.
  """
  def deliver_update_email_instructions(user, url) do
    deliver(user.email, EmailBrand.castmill(),
      subject: "Confirm your new email address",
      preheader: "Confirm the change of your account's email address.",
      blocks: [
        {:heading, "Confirm your new email address"},
        {:text, "Confirm this change to update the email address of your account."},
        {:button, "Confirm email address", url},
        {:link, url},
        {:note, "If you didn't ask for this change, you can ignore this email."}
      ]
    )
  end

  @doc """
  Deliver email verification instructions for new email address.
  """
  def deliver_email_verification_instructions(user, new_email, token) do
    url = verification_url(token)

    # Sent to the NEW email address
    deliver(new_email, EmailBrand.castmill(),
      subject: "Verify your new email address",
      preheader: "Verify this address to finish changing your account's email.",
      blocks: [
        {:heading, "Verify your new email address"},
        {:text,
         [
           "Hi ",
           user.name || "there",
           ", verify this address to finish changing the email of your account. It only changes once you verify it."
         ]},
        {:button, "Verify email address", url},
        {:link, url},
        {:note, "If you didn't ask for this change, you can ignore this email."}
      ]
    )
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

    deliver(signup.email, brand,
      subject: "Finish creating your #{brand.name} account",
      preheader: "Confirm your email to finish signing up.",
      reason:
        "You received this email because this address was used to sign up for #{brand.name}.",
      blocks: [
        {:heading, "Confirm your email"},
        {:text,
         [
           "Finish creating your ",
           {:strong, brand.name},
           " account for ",
           {:strong, signup.email},
           " with the button below."
         ]},
        {:button, "Finish sign-up", url},
        {:link, url},
        {:note,
         "The link works once. If you didn't sign up, you can ignore this email: no account is created until you finish."}
      ]
    )
  end

  @doc """
  Deliver a notice to an existing user who tried to sign up again.
  Informs them they already have an account and directs them to log in.
  """
  def deliver_already_registered_notice(email, dashboard_uri) do
    login_url = "#{dashboard_uri}/login?email=#{URI.encode_www_form(email)}"
    brand = EmailBrand.for_origin(dashboard_uri)

    deliver(email, brand,
      subject: "You already have a #{brand.name} account",
      preheader: "Sign in with your existing account.",
      blocks: [
        {:heading, "You already have an account"},
        {:text,
         [
           "Someone tried to sign up for ",
           {:strong, brand.name},
           " with ",
           {:strong, email},
           ", but this address already has an account. Sign in instead."
         ]},
        {:button, "Sign in", login_url},
        {:link, login_url},
        {:note, "If it wasn't you, you can ignore this email. Your account hasn't changed."}
      ]
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
      brand,
      [
        subject: "You're invited to join #{invitation.organization_name} on #{brand.name}",
        preheader: "Create and manage #{invitation.organization_name} on #{brand.name}.",
        blocks: [
          {:heading, "You're invited to #{invitation.organization_name}"},
          {:text,
           [
             "You've been invited to create and manage the organization ",
             {:strong, invitation.organization_name},
             " on ",
             {:strong, brand.name},
             "."
           ]},
          {:button, "Open #{brand.name}", invitation_url},
          {:text, "When asked, enter this invitation code:"},
          {:code, invitation.token},
          {:note, "This invitation expires on #{format_date(invitation.expires_at)}."}
        ]
      ],
      opts
    )
  end

  defp format_date(%DateTime{} = date), do: Calendar.strftime(date, "%B %-d, %Y at %H:%M UTC")

  defp format_date(%NaiveDateTime{} = date),
    do: Calendar.strftime(date, "%B %-d, %Y at %H:%M UTC")

  defp format_date(date), do: to_string(date)

  defp signup_url(
         %Castmill.Accounts.SignUp{id: id, email: email, challenge: challenge},
         dashboard_uri
       ) do
    "#{dashboard_uri}/signup/?signup_id=#{id}&email=#{URI.encode_www_form(email)}&challenge=#{challenge}"
  end
end
