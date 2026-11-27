defmodule Castmill.EmailRenderer do
  @moduledoc """
  Organization and team invitation emails, in `Castmill.EmailLayout`.
  Each returns `{html_body, text_body}`.
  """

  alias Castmill.EmailBrand
  alias Castmill.EmailLayout

  @doc """
  Renders an organization invitation email. `base_url` is the dashboard's
  URL or domain (`https://` is added when it has no scheme).
  """
  def render_organization_invite(
        organization_name,
        network_name,
        email,
        token,
        base_url,
        brand \\ EmailBrand.castmill()
      ) do
    url = "#{EmailBrand.dashboard_url(base_url)}/invite-organization/?token=#{token}"

    EmailLayout.render(brand,
      subject: "You have been invited to an Organization on #{network_name}",
      preheader: "Join #{organization_name} on #{network_name}.",
      blocks: [
        {:heading, "Join #{organization_name}"},
        {:text,
         [
           "You've been invited to join the organization ",
           {:strong, organization_name},
           " on ",
           {:strong, network_name},
           "."
         ]},
        {:button, "Accept invitation", url},
        {:link, url},
        {:note,
         "This invitation was sent to #{email}. If you weren't expecting it, you can ignore this email."}
      ]
    )
  end

  @doc """
  Renders a team invitation email. `base_url` is the dashboard's URL or
  domain (`https://` is added when it has no scheme).
  """
  def render_team_invite(team_name, email, token, base_url, brand \\ EmailBrand.castmill()) do
    url = "#{EmailBrand.dashboard_url(base_url)}/invite/?token=#{token}"

    EmailLayout.render(brand,
      subject: "You have been invited to a Team on #{brand.name}",
      preheader: "Join the #{team_name} team on #{brand.name}.",
      blocks: [
        {:heading, "Join the #{team_name} team"},
        {:text,
         [
           "You've been invited to join the team ",
           {:strong, team_name},
           " on ",
           {:strong, brand.name},
           "."
         ]},
        {:button, "Accept invitation", url},
        {:link, url},
        {:note,
         "This invitation was sent to #{email}. If you weren't expecting it, you can ignore this email."}
      ]
    )
  end
end
