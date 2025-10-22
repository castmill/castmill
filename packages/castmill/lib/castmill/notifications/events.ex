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
    - token: The invitation token for accepting the invitation
    - actor_id: The ID of the user who sent the invitation (optional)
  """
  def notify_organization_invitation(
        user_id,
        organization_name,
        organization_id,
        token,
        actor_id \\ nil
      ) do
    Notifications.create_user_notification(%{
      user_id: user_id,
      title_key: "organizations.notifications.types.organizationInvitation.title",
      description_key: "organizations.notifications.types.organizationInvitation.description",
      link: "/invite-organization?token=#{token}",
      type: "organization_invitation",
      actor_id: actor_id,
      actor_type: "user",
      metadata: %{
        organization_id: organization_id,
        organization_name: organization_name,
        token: token
      }
    })
  end

  @doc """
  Sends a notification when a user is invited to a team.

  ## Parameters
    - user_id: The ID of the user being invited
    - team_name: The name of the team
    - team_id: The ID of the team
    - token: The invitation token for accepting the invitation
    - actor_id: The ID of the user who sent the invitation (optional)
  """
  def notify_team_invitation(user_id, team_name, team_id, token, actor_id \\ nil) do
    Notifications.create_user_notification(%{
      user_id: user_id,
      title_key: "organizations.notifications.types.teamInvitation.title",
      description_key: "organizations.notifications.types.teamInvitation.description",
      link: "/invite?token=#{token}",
      type: "team_invitation",
      actor_id: actor_id,
      actor_type: "user",
      metadata: %{
        team_id: team_id,
        team_name: team_name,
        token: token
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
      title_key: "organizations.notifications.types.deviceRegistration.title",
      description_key: "organizations.notifications.types.deviceRegistration.description",
      link: "/org/#{organization_id}/devices?device=#{device_id}",
      type: "device_registration",
      roles: roles,
      actor_id: device_id,
      actor_type: "device",
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
    - device_id: The ID of the device (for actor tracking)
  """
  def notify_device_removal(device_name, organization_id, device_id \\ nil) do
    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title_key: "organizations.notifications.types.deviceRemoval.title",
      description_key: "organizations.notifications.types.deviceRemoval.description",
      type: "device_removal",
      actor_id: device_id,
      actor_type: "device",
      metadata: %{
        device_name: device_name
      }
    })
  end

  @doc """
  Notifies an organization when media transcoding is complete.

  ## Parameters
    - media_name: The name of the media file
    - media_id: The ID of the media
    - organization_id: The ID of the organization
  """
  def notify_media_transcoded(media_name, media_id, organization_id) do
    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title_key: "organizations.notifications.types.mediaTranscoded.title",
      description_key: "organizations.notifications.types.mediaTranscoded.description",
      link: "/org/#{organization_id}/medias?media=#{media_id}",
      type: "media_transcoded",
      actor_type: "system",
      metadata: %{
        media_id: media_id,
        media_name: media_name
      }
    })
  end

  @doc """
  Notifies when media transcoding reaches a certain progress (typically 100%).
  Only sends notification on completion (100%) to avoid spamming.
  Uses "uploaded" terminology for better UX (users see "Media uploaded" = "Media ready to use").

  ## Parameters
    - media_id: The ID of the media being transcoded
    - progress: The progress percentage (0.0 to 100.0)
    - files: Map of transcoded files with metadata
    - total_size: Total size of all transcoded files in bytes
    - completed: Whether transcoding is complete
  """
  def notify_media_progress(media_id, progress, files, total_size, completed) do
    # Only notify on completion
    if completed and progress >= 100.0 do
      case Castmill.Resources.get_media(media_id) do
        nil ->
          {:error, :media_not_found}

        media ->
          # Include file information in metadata
          file_count = if is_map(files), do: map_size(files), else: 0

          # Determine media type for UX-friendly message
          media_type =
            cond do
              media.mimetype && String.starts_with?(media.mimetype, "image/") -> "Image"
              media.mimetype && String.starts_with?(media.mimetype, "video/") -> "Video"
              true -> "Media"
            end

          Notifications.create_organization_notification(%{
            organization_id: media.organization_id,
            title_key: "organizations.notifications.types.mediaUploaded.title#{media_type}",
            description_key:
              "organizations.notifications.types.mediaUploaded.description#{media_type}",
            link: "/org/#{media.organization_id}/medias?media=#{media_id}",
            type: "media_uploaded",
            actor_type: "system",
            metadata: %{
              media_id: media_id,
              media_name: media.name,
              media_type: String.downcase(media_type),
              total_size: total_size,
              file_count: file_count
            }
          })
      end
    else
      {:ok, :skipped}
    end
  end

  @doc """
  Notifies organization/team users when someone accepts an invitation.
  The user who accepted the invitation is excluded from receiving this notification.

  ## Parameters
    - user_name: The name of the user who accepted
    - user_id: The ID of the user who accepted (excluded from notification)
    - organization_id: The ID of the organization (optional)
    - team_id: The ID of the team (optional)
  """
  def notify_invitation_accepted(user_name, user_id, organization_id \\ nil, team_id \\ nil) do
    cond do
      organization_id != nil ->
        Notifications.create_organization_notification(%{
          organization_id: organization_id,
          title_key: "organizations.notifications.types.invitationAccepted.title",
          description_key: "organizations.notifications.types.invitationAccepted.descriptionOrg",
          type: "invitation_accepted",
          actor_id: user_id,
          actor_type: "user",
          metadata: %{
            user_name: user_name,
            excluded_user_ids: [user_id]
          }
        })

      team_id != nil ->
        Notifications.create_team_notification(%{
          team_id: team_id,
          title_key: "organizations.notifications.types.invitationAccepted.title",
          description_key: "organizations.notifications.types.invitationAccepted.descriptionTeam",
          type: "invitation_accepted",
          actor_id: user_id,
          actor_type: "user",
          metadata: %{
            user_name: user_name,
            excluded_user_ids: [user_id]
          }
        })

      true ->
        {:error, :missing_recipient}
    end
  end

  @doc """
  Notifies when a user is removed from an organization.

  ## Parameters
    - user_name: The name of the user who was removed
    - organization_id: The ID of the organization
    - actor_id: The ID of the user who performed the removal (optional)
  """
  def notify_member_removed(user_name, organization_id, actor_id \\ nil) do
    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title_key: "organizations.notifications.types.memberRemoved.title",
      description_key: "organizations.notifications.types.memberRemoved.description",
      type: "member_removed",
      actor_id: actor_id,
      actor_type: "user",
      metadata: %{
        user_name: user_name
      }
    })
  end

  @doc """
  Notifies when a user is removed from a team.
  Sends two notifications:
  1. To the removed user
  2. To all remaining team members

  ## Parameters
    - user_id: The ID of the user who was removed
    - user_name: The name of the user who was removed
    - team_id: The ID of the team
    - team_name: The name of the team
    - actor_id: The ID of the user who performed the removal (optional)
  """
  def notify_team_member_removed(user_id, user_name, team_id, team_name, actor_id \\ nil) do
    # Notify the removed user
    Notifications.create_user_notification(%{
      user_id: user_id,
      title_key: "organizations.notifications.types.teamMemberRemoved.titleSelf",
      description_key: "organizations.notifications.types.teamMemberRemoved.descriptionSelf",
      type: "team_member_removed",
      actor_id: actor_id,
      actor_type: "user",
      metadata: %{
        team_id: team_id,
        team_name: team_name
      }
    })

    # Notify remaining team members
    Notifications.create_team_notification(%{
      team_id: team_id,
      title_key: "organizations.notifications.types.teamMemberRemoved.titleOthers",
      description_key: "organizations.notifications.types.teamMemberRemoved.descriptionOthers",
      type: "team_member_removed",
      actor_id: actor_id,
      actor_type: "user",
      metadata: %{
        user_name: user_name,
        team_name: team_name
      }
    })
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
  def notify_device_offline_alert(
        device_name,
        device_id,
        organization_id,
        roles \\ ["admin", "device_manager"],
        metadata \\ %{}
      ) do
    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title_key: "organizations.notifications.types.deviceOfflineAlert.title",
      description_key: "organizations.notifications.types.deviceOfflineAlert.description",
      link: "/org/#{organization_id}/devices?device=#{device_id}",
      type: "device_offline_alert",
      roles: roles,
      actor_id: device_id,
      actor_type: "device",
      metadata:
        Map.merge(
          %{
            device_id: device_id,
            device_name: device_name,
            alert_type: "device_offline",
            severity: "warning"
          },
          metadata
        )
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
  def notify_device_online_alert(
        device_name,
        device_id,
        organization_id,
        roles \\ ["admin", "device_manager"],
        offline_duration \\ nil
      ) do
    Notifications.create_organization_notification(%{
      organization_id: organization_id,
      title_key: "organizations.notifications.types.deviceOnlineAlert.title",
      description_key:
        if offline_duration do
          "organizations.notifications.types.deviceOnlineAlert.descriptionWithDuration"
        else
          "organizations.notifications.types.deviceOnlineAlert.description"
        end,
      link: "/org/#{organization_id}/devices?device=#{device_id}",
      type: "device_online_alert",
      roles: roles,
      actor_id: device_id,
      actor_type: "device",
      metadata: %{
        device_id: device_id,
        device_name: device_name,
        alert_type: "device_online",
        severity: "info",
        offline_duration: offline_duration,
        offline_duration_formatted:
          if(offline_duration, do: format_duration(offline_duration), else: nil)
      }
    })
  end

  @doc """
  Notifies when a media upload completes.
  Can be user-specific or organization-wide with role filtering.

  ## Parameters
    - media_id: The ID of the media
    - media_name: The name of the media file
    - mimetype: The MIME type of the media (e.g., "image/jpeg", "video/mp4")
    - user_id: The ID of the user who uploaded (nil for org-wide)
    - organization_id: The ID of the organization
    - roles: Optional list of roles for org-wide notifications
  """
  def notify_media_uploaded(media_id, media_name, mimetype, user_id, organization_id, roles \\ []) do
    # Determine media type from mimetype
    media_type =
      cond do
        mimetype && String.starts_with?(mimetype, "image/") -> "image"
        mimetype && String.starts_with?(mimetype, "video/") -> "video"
        true -> "media"
      end

    # Use specific translation keys based on media type
    title_key =
      "organizations.notifications.types.mediaUploaded.title#{String.capitalize(media_type)}"

    description_key =
      "organizations.notifications.types.mediaUploaded.description#{String.capitalize(media_type)}"

    cond do
      user_id != nil ->
        # User-specific notification
        Notifications.create_user_notification(%{
          user_id: user_id,
          organization_id: organization_id,
          title_key: title_key,
          description_key: description_key,
          link: "/content/medias?media=#{media_id}",
          type: "media_uploaded",
          actor_id: user_id,
          actor_type: "user",
          metadata: %{
            media_id: media_id,
            media_name: media_name,
            media_type: media_type
          }
        })

      organization_id != nil ->
        # Organization-wide notification with optional role filtering
        Notifications.create_organization_notification(%{
          organization_id: organization_id,
          title_key: title_key,
          description_key: description_key,
          link: "/content/medias?media=#{media_id}",
          type: "media_uploaded",
          roles: roles,
          actor_type: "system",
          metadata: %{
            media_id: media_id,
            media_name: media_name,
            media_type: media_type
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
