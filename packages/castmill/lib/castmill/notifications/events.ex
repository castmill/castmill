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
    - roles: Optional list of roles to restrict notification (e.g., ["admin", "device_manager"])
  """
  def notify_device_registration(device_name, device_id, organization_id, roles \\ []) do
    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title: "New Device Registered",
      description: "Device '#{device_name}' has been registered",
      link: "/org/#{organization_id}/devices?device=#{device_id}",
      type: "device_registration",
      roles: roles,
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

  @doc """
  Notifies when a device goes offline unexpectedly.
  This is part of the monitoring and alert system.
  
  ## Parameters
    - device_name: The name of the device
    - device_id: The ID of the device
    - organization_id: The ID of the organization
    - roles: Optional list of roles to restrict notification (e.g., ["admin", "device_manager"])
    - metadata: Additional alert metadata (e.g., expected_online_time, last_seen)
  """
  def notify_device_offline_alert(device_name, device_id, organization_id, roles \\ ["admin", "device_manager"], metadata \\ %{}) do
    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title: "Device Offline Alert",
      description: "Device '#{device_name}' is offline when it should be online",
      link: "/org/#{organization_id}/devices?device=#{device_id}",
      type: "device_offline_alert",
      roles: roles,
      metadata: Map.merge(%{
        device_id: device_id,
        device_name: device_name,
        alert_type: "device_offline",
        severity: "warning"
      }, metadata)
    })
  end

  @doc """
  Notifies when a device comes back online after being offline.
  
  ## Parameters
    - device_name: The name of the device
    - device_id: The ID of the device
    - organization_id: The ID of the organization
    - roles: Optional list of roles to restrict notification
    - offline_duration: How long the device was offline (in seconds)
  """
  def notify_device_online_alert(device_name, device_id, organization_id, roles \\ ["admin", "device_manager"], offline_duration \\ nil) do
    description = if offline_duration do
      "Device '#{device_name}' is back online (was offline for #{format_duration(offline_duration)})"
    else
      "Device '#{device_name}' is back online"
    end

    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title: "Device Online",
      description: description,
      link: "/org/#{organization_id}/devices?device=#{device_id}",
      type: "device_online_alert",
      roles: roles,
      metadata: %{
        device_id: device_id,
        device_name: device_name,
        alert_type: "device_online",
        severity: "info",
        offline_duration: offline_duration
      }
    })
  end

  @doc """
  Notifies when a media upload completes.
  Can be user-specific or organization-wide with role filtering.
  
  ## Parameters
    - user_id: The ID of the user who uploaded (nil for org-wide)
    - organization_id: The ID of the organization (for org-wide notifications)
    - media_name: The name of the media file
    - media_id: The ID of the media
    - roles: Optional list of roles for org-wide notifications
  """
  def notify_media_uploaded(user_id \\ nil, organization_id, media_name, media_id, roles \\ []) do
    cond do
      user_id != nil ->
        # User-specific notification
        Notifications.create_user_notification(%{
          user_id: user_id,
          title: "Media Upload Complete",
          description: "Media '#{media_name}' has been uploaded successfully",
          link: "/org/#{organization_id}/medias?media=#{media_id}",
          type: "media_uploaded",
          metadata: %{
            media_id: media_id,
            media_name: media_name
          }
        })

      organization_id != nil ->
        # Organization-wide notification with optional role filtering
        Notifications.create_organization_notification(%{
          organization_id: organization_id,
          title: "New Media Uploaded",
          description: "Media '#{media_name}' has been uploaded",
          link: "/org/#{organization_id}/medias?media=#{media_id}",
          type: "media_uploaded",
          roles: roles,
          metadata: %{
            media_id: media_id,
            media_name: media_name
          }
        })

      true ->
        {:error, :missing_recipient}
    end
  end

  # Helper to format duration in human-readable format
  defp format_duration(seconds) when seconds < 60, do: "#{seconds} seconds"
  defp format_duration(seconds) when seconds < 3600 do
    minutes = div(seconds, 60)
    "#{minutes} minute#{if minutes > 1, do: "s", else: ""}"
  end
  defp format_duration(seconds) do
    hours = div(seconds, 3600)
    "#{hours} hour#{if hours > 1, do: "s", else: ""}"
  end
end
