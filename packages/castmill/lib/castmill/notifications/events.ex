defmodule Castmill.Notifications.Events do
  @moduledoc """
  Helper functions for creating notifications for common events.
  This module provides a clean API for plugins and other parts of the system
  to trigger notifications.
  """

  alias Castmill.Notifications

  @doc """
  Sends a notification when a user is invited to an organization.
  
  ## Parameters
    - user_id: The ID of the user being invited
    - organization_name: The name of the organization
    - organization_id: The ID of the organization
  """
  def notify_organization_invitation(user_id, organization_name, organization_id) do
    Notifications.create_user_notification(%{
      user_id: user_id,
      title: "Organization Invitation",
      description: "You have been invited to join #{organization_name}",
      link: "/invite-organization",
      type: "organization_invitation",
      metadata: %{
        organization_id: organization_id,
        organization_name: organization_name
      }
    })
  end

  @doc """
  Sends a notification when a user is invited to a team.
  
  ## Parameters
    - user_id: The ID of the user being invited
    - team_name: The name of the team
    - team_id: The ID of the team
  """
  def notify_team_invitation(user_id, team_name, team_id) do
    Notifications.create_user_notification(%{
      user_id: user_id,
      title: "Team Invitation",
      description: "You have been invited to join #{team_name}",
      link: "/invite",
      type: "team_invitation",
      metadata: %{
        team_id: team_id,
        team_name: team_name
      }
    })
  end

  @doc """
  Notifies organization users when a new device is registered.
  
  ## Parameters
    - device_name: The name of the device
    - device_id: The ID of the device
    - organization_id: The ID of the organization
  """
  def notify_device_registration(device_name, device_id, organization_id) do
    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title: "New Device Registered",
      description: "Device '#{device_name}' has been registered",
      link: "/org/#{organization_id}/devices?device=#{device_id}",
      type: "device_registration",
      metadata: %{
        device_id: device_id,
        device_name: device_name
      }
    })
  end

  @doc """
  Notifies organization users when a device is removed.
  
  ## Parameters
    - device_name: The name of the device
    - organization_id: The ID of the organization
  """
  def notify_device_removal(device_name, organization_id) do
    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title: "Device Removed",
      description: "Device '#{device_name}' has been removed",
      type: "device_removal",
      metadata: %{
        device_name: device_name
      }
    })
  end

  @doc """
  Notifies a user when media transcoding is complete.
  
  ## Parameters
    - user_id: The ID of the user who uploaded the media
    - media_name: The name of the media file
    - media_id: The ID of the media
    - organization_id: The ID of the organization
  """
  def notify_media_transcoded(user_id, media_name, media_id, organization_id) do
    Notifications.create_user_notification(%{
      user_id: user_id,
      title: "Media Transcoding Complete",
      description: "Media '#{media_name}' has been successfully transcoded",
      link: "/org/#{organization_id}/medias?media=#{media_id}",
      type: "media_transcoded",
      metadata: %{
        media_id: media_id,
        media_name: media_name
      }
    })
  end

  @doc """
  Notifies organization/team users when someone accepts an invitation.
  
  ## Parameters
    - user_name: The name of the user who accepted
    - organization_id: The ID of the organization (optional)
    - team_id: The ID of the team (optional)
  """
  def notify_invitation_accepted(user_name, organization_id \\ nil, team_id \\ nil) do
    cond do
      organization_id != nil ->
        Notifications.create_organization_notification(%{
          organization_id: organization_id,
          title: "Invitation Accepted",
          description: "#{user_name} has joined the organization",
          type: "invitation_accepted",
          metadata: %{
            user_name: user_name
          }
        })

      team_id != nil ->
        Notifications.create_team_notification(%{
          team_id: team_id,
          title: "Invitation Accepted",
          description: "#{user_name} has joined the team",
          type: "invitation_accepted",
          metadata: %{
            user_name: user_name
          }
        })

      true ->
        {:error, :missing_recipient}
    end
  end
end
