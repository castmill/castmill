defmodule Castmill.EmailRenderer do
  @moduledoc """
  Renders email templates using EEx templates.
  Provides both HTML and text versions for all emails.
  """

  require EEx

  @template_dir "lib/castmill/templates/email"

  # Compile templates at compile time for performance
  EEx.function_from_file(
    :defp,
    :render_base_layout_html,
    Path.join(@template_dir, "base_layout.html.eex"),
    [:assigns]
  )

  EEx.function_from_file(
    :defp,
    :render_organization_invite_body_html,
    Path.join(@template_dir, "organization_invite.html.eex"),
    [:assigns]
  )

  EEx.function_from_file(
    :defp,
    :render_organization_invite_text,
    Path.join(@template_dir, "organization_invite.text.eex"),
    [:assigns]
  )

  EEx.function_from_file(
    :defp,
    :render_team_invite_body_html,
    Path.join(@template_dir, "team_invite.html.eex"),
    [:assigns]
  )

  EEx.function_from_file(
    :defp,
    :render_team_invite_text,
    Path.join(@template_dir, "team_invite.text.eex"),
    [:assigns]
  )

  @doc """
  Renders an organization invitation email.

  Returns a tuple with {html_body, text_body}.

  ## Parameters
    - organization_name: Name of the organization
    - network_name: Name of the network
    - email: Recipient email address
    - token: Invitation token
    - base_url: Base URL for the invitation link

  ## Examples
      iex> render_organization_invite("Acme Corp", "Castmill", "user@example.com", "abc123", "https://app.castmill.com")
      {html_body, text_body}
  """
  def render_organization_invite(organization_name, network_name, email, token, base_url) do
    invitation_url = "#{base_url}/invite-organization/?token=#{token}"

    assigns = %{
      organization_name: organization_name,
      network_name: network_name,
      email: email,
      invitation_url: invitation_url
    }

    html_body_content = render_organization_invite_body_html(assigns)

    html_body =
      render_base_layout_html(%{
        subject: "You have been invited to an Organization on #{network_name}",
        body: html_body_content
      })

    text_body = render_organization_invite_text(assigns)

    {html_body, text_body}
  end

  @doc """
  Renders a team invitation email.

  Returns a tuple with {html_body, text_body}.

  ## Parameters
    - team_name: Name of the team
    - email: Recipient email address
    - token: Invitation token
    - base_url: Base URL for the invitation link

  ## Examples
      iex> render_team_invite("Engineering Team", "user@example.com", "abc123", "https://app.castmill.com")
      {html_body, text_body}
  """
  def render_team_invite(team_name, email, token, base_url) do
    invitation_url = "#{base_url}/invite/?token=#{token}"

    assigns = %{
      team_name: team_name,
      email: email,
      invitation_url: invitation_url
    }

    html_body_content = render_team_invite_body_html(assigns)

    html_body =
      render_base_layout_html(%{
        subject: "You have been invited to a Team on Castmill™",
        body: html_body_content
      })

    text_body = render_team_invite_text(assigns)

    {html_body, text_body}
  end
end
