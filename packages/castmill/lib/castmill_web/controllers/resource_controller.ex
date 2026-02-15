defmodule CastmillWeb.ResourceController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash

  alias Castmill.Resources.Media
  alias Castmill.Resources.Channel
  alias Castmill.Resources.Playlist
  alias Castmill.Resources.Layout
  alias Castmill.Resources.ChannelEntry
  alias Castmill.Devices.Device
  alias Castmill.Devices
  alias Castmill.Teams
  alias Castmill.Teams.Team

  action_fallback(CastmillWeb.FallbackController)

  @impl CastmillWeb.AccessActorBehaviour

  def check_access(actor_id, :update, %{
        "id" => device_id,
        "organization_id" => organization_id,
        "resources" => "devices"
      }) do
    # First check if device belongs to the given organization.
    device = Devices.get_device(device_id)

    if device.organization_id == organization_id do
      check_access(actor_id, :update, %{
        "organization_id" => organization_id,
        "resources" => "devices"
      })
    else
      {:ok, false}
    end
  end

  def check_access(actor_id, action, %{
        "organization_id" => organization_id,
        "channel_id" => channel_id
      })
      when action in [:add_channel_entry, :delete_channel_entry, :update_channel_entry] do
    channel = Castmill.Resources.get_channel(channel_id)

    if channel == nil do
      {:ok, false}
    else
      if channel.organization_id != organization_id do
        {:ok, false}
      else
        {:ok, Organizations.has_any_role?(organization_id, actor_id, [:admin, :member])}
      end
    end
  end

  def check_access(actor_id, :list_channel_entries, %{
        "organization_id" => organization_id
      }) do
    {:ok, Organizations.has_any_role?(organization_id, actor_id, [:admin, :member, :guest])}
  end

  def check_access(actor_id, action, %{
        "organization_id" => organization_id,
        "resources" => resources
      }) do
    if Organizations.has_access(organization_id, actor_id, resources, action) do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  # Default implementation for other actions not explicitly handled above
  def check_access(_actor_id, _action, _params) do
    # Default to false or implement your own logic based on other conditions
    {:ok, false}
  end

  plug(AuthorizeDash)

  # Filters are encoded in the query string as either a list of comma separated values
  # ?filters=online,premium
  # or as a list of field-value pairs.
  # ?filters=online:true,level:3,status:active
  def parse_filters(value) do
    {:ok,
     value &&
       Enum.map(String.split(value, ","), fn filter ->
         case String.split(filter, ":") do
           [field, value] ->
             {field, value}

           [field] ->
             {field, true}
         end
       end)}
  end

  # Parse tag_ids from comma-separated string: "1,2,3" => [1, 2, 3]
  def parse_tag_ids(nil), do: {:ok, []}
  def parse_tag_ids(""), do: {:ok, []}

  def parse_tag_ids(value) when is_binary(value) do
    tag_ids =
      value
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> Enum.filter(&(&1 != ""))
      |> Enum.map(&String.to_integer/1)

    {:ok, tag_ids}
  rescue
    _ -> {:error, "Invalid tag_ids format. Expected comma-separated integers."}
  end

  @index_params_schema %{
    organization_id: [type: :string, required: true],
    resources: [type: :string, required: true],
    page: [type: :integer, number: [min: 1]],
    page_size: [type: :integer, number: [min: 1, max: 100]],
    search: :string,
    team_id: :integer,
    key: :string,
    direction: :string,
    filters: [
      type: :string,
      cast_func: &CastmillWeb.ResourceController.parse_filters/1
    ],
    # Tag filtering support
    tag_ids: [
      type: :string,
      cast_func: &CastmillWeb.ResourceController.parse_tag_ids/1
    ],
    # Filter mode: "any" (OR) or "all" (AND)
    tag_filter_mode: [type: :string, in: ["any", "all"]]
  }

  # The only reason we have a specific index function for devices is that we need to
  # set the online status of the devices before returning them. Maybe there are better
  # ways to do this.
  def index(conn, %{"resources" => "devices"} = params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      response = %{
        data: Devices.set_devices_online(Organizations.list_devices(params)),
        count: Organizations.count_devices(params)
      }

      conn
      |> put_status(:ok)
      |> json(response)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def index(conn, params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      response = %{
        data: Organizations.list_resources(params),
        count: Organizations.count_resources(params)
      }

      conn
      |> put_status(:ok)
      |> json(response)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  # The update function is used to update some fields of a resource.
  # Every resource has its own allowed fields to be updated,
  # for instance the devices resource can only update the name and the description.
  # Every resource will out its fields to be updated in a special map, for example
  # the devices resource will have a map like this:
  # %{"name" => "New name", "description" => "New description"}
  @update_params_schema %{
    organization_id: [type: :string, required: true],
    resources: [type: :string, required: true],
    id: [type: :string, required: true],
    update: :map
  }

  @update_playlist_params_schema %{
    organization_id: [type: :string, required: true],
    id: [type: :integer, required: true],
    update: :map
  }

  @update_channel_params_schema %{
    organization_id: [type: :string, required: true],
    id: [type: :integer, required: true],
    update: :map
  }

  @update_layout_params_schema %{
    organization_id: [type: :string, required: true],
    id: [type: :integer, required: true],
    update: :map
  }

  @update_media_params_schema %{
    organization_id: [type: :string, required: true],
    resources: [type: :string, cast: :integer, required: true],
    id: [type: :integer, required: true],
    update: :map
  }

  def update(
        conn,
        %{
          "resources" => "devices",
          "id" => id,
          "organization_id" => organization_id
        } = params
      ) do
    with {:ok, params} <- Tarams.cast(params, @update_params_schema) do
      device = %Device{
        id: id,
        organization_id: organization_id
      }

      Devices.update_device(device, params.update)
      |> case do
        {:ok, device} ->
          conn
          |> put_status(:ok)
          |> json(device)

        {:error, errors} ->
          conn
          |> put_status(:bad_request)
          |> Phoenix.Controller.json(%{errors: errors})
          |> halt()
      end
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def update(
        conn,
        %{
          "resources" => "medias",
          "id" => _id,
          "organization_id" => organization_id
        } = params
      ) do
    with {:ok, params} <- Tarams.cast(params, @update_media_params_schema) do
      media = %Media{
        id: params.id,
        organization_id: organization_id
      }

      Castmill.Resources.update_media(media, params.update)
      |> case do
        {:ok, media} ->
          conn
          |> put_status(:ok)
          |> json(media)

        {:error, errors} ->
          conn
          |> put_status(:bad_request)
          |> Phoenix.Controller.json(%{errors: errors})
          |> halt()
      end
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def update(
        conn,
        %{
          "resources" => "playlists",
          "id" => _id
        } = params
      ) do
    with {:ok, params} <- Tarams.cast(params, @update_playlist_params_schema) do
      playlist = Castmill.Resources.get_playlist(params.id)

      Castmill.Resources.update(playlist, params.update)
      |> case do
        {:ok, playlist} ->
          conn
          |> put_status(:ok)
          |> json(playlist)

        {:error, errors} ->
          conn
          |> put_status(:bad_request)
          |> Phoenix.Controller.json(%{errors: errors})
          |> halt()
      end
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def update(
        conn,
        %{
          "resources" => "channels",
          "id" => _id
        } = params
      ) do
    with {:ok, params} <- Tarams.cast(params, @update_channel_params_schema) do
      channel = Castmill.Resources.get_channel(params.id)

      Castmill.Resources.update_channel(channel, params.update)
      |> case do
        {:ok, updated_channel} ->
          # If default_playlist_id was updated and actually changed, notify all connected devices
          # Note: params.update may have string keys ("default_playlist_id") so check both
          has_default_playlist_key =
            Map.has_key?(params.update, :default_playlist_id) or
              Map.has_key?(params.update, "default_playlist_id")

          if has_default_playlist_key and
               channel.default_playlist_id != updated_channel.default_playlist_id do
            notify_devices_of_channel_update(updated_channel.id, updated_channel)
          end

          conn
          |> put_status(:ok)
          |> json(updated_channel)

        {:error, errors} ->
          conn
          |> put_status(:bad_request)
          |> Phoenix.Controller.json(%{errors: errors})
          |> halt()
      end
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def update(
        conn,
        %{
          "resources" => "layouts",
          "id" => _id
        } = params
      ) do
    with {:ok, params} <- Tarams.cast(params, @update_layout_params_schema) do
      layout = Castmill.Resources.get_layout(params.id)

      Castmill.Resources.update_layout(layout, params.update)
      |> case do
        {:ok, layout} ->
          conn
          |> put_status(:ok)
          |> json(layout)

        {:error, errors} ->
          conn
          |> put_status(:bad_request)
          |> Phoenix.Controller.json(%{errors: errors})
          |> halt()
      end
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def update(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> Phoenix.Controller.json(%{errors: ["Resource not found"]})
    |> halt()
  end

  # Notify all devices assigned to a channel when its default playlist changes
  # This is done asynchronously to avoid blocking the HTTP response
  defp notify_devices_of_channel_update(channel_id, channel) do
    Task.start(fn ->
      try do
        devices = Castmill.Resources.get_devices_using_channel(channel_id)

        Enum.each(devices, fn device ->
          Phoenix.PubSub.broadcast(
            Castmill.PubSub,
            "devices:#{device.id}",
            %{
              event: "channel_updated",
              channel_id: channel_id,
              default_playlist_id: channel.default_playlist_id
            }
          )
        end)
      rescue
        error ->
          require Logger
          Logger.error("Failed to notify devices of channel update: #{inspect(error)}")
      end
    end)
  end

  def create(conn, %{
        "resources" => "medias",
        "organization_id" => organization_id,
        "media" => media
      }) do
    create_attrs = Map.merge(media, %{"organization_id" => organization_id})

    case Castmill.Resources.create_media(create_attrs) do
      {:ok, %Media{} = media} ->
        conn
        |> put_status(:created)
        |> put_resp_header(
          "location",
          ~p"/api/organizations/#{organization_id}/medias/#{media.id}"
        )
        |> render(:show, media: media)

      {:error, :quota_exceeded} ->
        conn
        |> put_status(:forbidden)
        |> Phoenix.Controller.json(%{errors: %{quota: ["Media quota exceeded"]}})

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def create(conn, %{
        "resources" => "playlists",
        "organization_id" => organization_id,
        "playlist" => playlist_params
      }) do
    # Extract team_id from params if present
    team_id = Map.get(playlist_params, "team_id")

    # Remove team_id from playlist params as it's not a playlist field
    create_attrs =
      playlist_params
      |> Map.delete("team_id")
      |> Map.merge(%{"organization_id" => organization_id})

    case Castmill.Resources.create_playlist(create_attrs) do
      {:ok, %Playlist{} = playlist} ->
        # If team_id was provided, add the playlist to the team
        if team_id do
          case Castmill.Teams.add_resource_to_team(team_id, "playlists", playlist.id, [
                 :read,
                 :write,
                 :delete
               ]) do
            {:ok, _} ->
              :ok

            {:error, reason} ->
              # Log the error but don't fail the playlist creation
              require Logger

              Logger.warning(
                "Failed to add playlist #{playlist.id} to team #{team_id}: #{inspect(reason)}"
              )
          end
        end

        conn
        |> put_status(:created)
        |> put_resp_header(
          "location",
          ~p"/api/organizations/#{organization_id}/playlists/#{playlist.id}"
        )
        |> render(:show, playlist: playlist)

      {:error, :quota_exceeded} ->
        conn
        |> put_status(:forbidden)
        |> Phoenix.Controller.json(%{errors: %{quota: ["Playlist quota exceeded"]}})

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def create(conn, %{
        "resources" => "channels",
        "organization_id" => organization_id,
        "channel" => channel_params
      }) do
    # Extract team_id from params if present
    team_id = Map.get(channel_params, "team_id")

    # Remove team_id from channel params as it's not a channel field
    create_attrs =
      channel_params
      |> Map.delete("team_id")
      |> Map.merge(%{"organization_id" => organization_id})

    with {:ok, %Channel{} = channel} <- Castmill.Resources.create_channel(create_attrs) do
      # If team_id was provided, add the channel to the team
      if team_id do
        case Castmill.Teams.add_resource_to_team(team_id, "channels", channel.id, [
               :read,
               :write,
               :delete
             ]) do
          {:ok, _} ->
            :ok

          {:error, reason} ->
            # Log the error but don't fail the channel creation
            require Logger

            Logger.warning(
              "Failed to add channel #{channel.id} to team #{team_id}: #{inspect(reason)}"
            )
        end
      end

      conn
      |> put_status(:created)
      |> put_resp_header(
        "location",
        ~p"/api/organizations/#{organization_id}/channels/#{channel.id}"
      )
      |> render(:show, channel: channel)
    end
  end

  def create(conn, %{
        "resources" => "teams",
        "organization_id" => organization_id,
        "team" => team
      }) do
    create_attrs = Map.merge(team, %{"organization_id" => organization_id})

    case Teams.create_team(create_attrs, conn.assigns[:current_user]) do
      {:ok, %Team{} = team} ->
        conn
        |> put_status(:created)
        |> put_resp_header(
          "location",
          ~p"/api/organizations/#{organization_id}/teams/#{team.id}"
        )
        |> render(:show, team: team)

      {:error, :quota_exceeded} ->
        conn
        |> put_status(:forbidden)
        |> Phoenix.Controller.json(%{errors: %{quota: ["Team quota exceeded"]}})

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def create(conn, %{
        "resources" => "layouts",
        "organization_id" => organization_id,
        "layout" => layout_params
      }) do
    # Extract team_id from params if present
    team_id = Map.get(layout_params, "team_id")

    # Remove team_id from layout params as it's not a layout field
    create_attrs =
      layout_params
      |> Map.delete("team_id")
      |> Map.merge(%{"organization_id" => organization_id})

    case Castmill.Resources.create_layout(create_attrs) do
      {:ok, %Layout{} = layout} ->
        # If team_id was provided, add the layout to the team
        if team_id do
          case Castmill.Teams.add_resource_to_team(team_id, "layouts", layout.id, [
                 :read,
                 :write,
                 :delete
               ]) do
            {:ok, _} ->
              :ok

            {:error, reason} ->
              require Logger

              Logger.warning(
                "Failed to add layout #{layout.id} to team #{team_id}: #{inspect(reason)}"
              )
          end
        end

        conn
        |> put_status(:created)
        |> put_resp_header(
          "location",
          ~p"/api/organizations/#{organization_id}/layouts/#{layout.id}"
        )
        |> render(:show, layout_data: layout)

      {:error, :quota_exceeded} ->
        conn
        |> put_status(:forbidden)
        |> Phoenix.Controller.json(%{errors: %{quota: ["Layout quota exceeded"]}})

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def delete(conn, %{
        "resources" => "medias",
        "id" => id
      }) do
    case Castmill.Resources.get_media(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{errors: ["Media not found"]})
        |> halt()

      media ->
        with {:ok, %Media{}} <- Castmill.Resources.delete_media(media) do
          send_resp(conn, :no_content, "")
        else
          {:error, :media_in_use_as_logo} ->
            conn
            |> put_status(:conflict)
            |> Phoenix.Controller.json(%{
              error: "Cannot delete media that is being used as an organization logo"
            })

          {:error, reason} ->
            send_resp(conn, 500, "Error deleting media: #{inspect(reason)}")
        end
    end
  end

  def delete(conn, %{
        "resources" => "playlists",
        "id" => id
      }) do
    case Castmill.Resources.get_playlist(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{errors: ["Playlist not found"]})
        |> halt()

      playlist ->
        with {:ok, %Playlist{}} <- Castmill.Resources.delete_playlist(playlist) do
          send_resp(conn, :no_content, "")
        else
          {:error, :playlist_has_channels} ->
            channels = Castmill.Resources.get_channels_using_playlist(playlist.id)

            # Format channel usage information
            usage_info =
              Enum.map(channels, fn channel ->
                case channel.usage_type do
                  "default" ->
                    %{
                      id: channel.id,
                      name: channel.name,
                      usage_type: "default"
                    }

                  "scheduled" ->
                    %{
                      id: channel.id,
                      name: channel.name,
                      usage_type: "scheduled",
                      entry_start: channel.entry_start,
                      entry_end: channel.entry_end,
                      repeat_until: channel.repeat_until
                    }
                end
              end)

            conn
            |> put_status(:conflict)
            |> Phoenix.Controller.json(%{
              errors: %{
                detail: "Cannot delete playlist that is used in channels",
                channels: usage_info
              }
            })

          {:error, reason} ->
            send_resp(conn, 500, "Error deleting playlist: #{inspect(reason)}")
        end
    end
  end

  def delete(conn, %{
        "resources" => "channels",
        "id" => id
      }) do
    case Castmill.Resources.get_channel(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{errors: ["Channel not found"]})
        |> halt()

      channel ->
        with {:ok, %Channel{}} <- Castmill.Resources.delete_channel(channel) do
          send_resp(conn, :no_content, "")
        else
          {:error, :channel_has_devices} ->
            devices = Castmill.Resources.get_devices_using_channel(channel.id)
            device_names = Enum.map(devices, & &1.name)

            conn
            |> put_status(:conflict)
            |> Phoenix.Controller.json(%{
              errors: %{
                detail: "Cannot delete channel that is assigned to devices",
                devices: device_names
              }
            })

          {:error, reason} ->
            send_resp(conn, 500, "Error deleting channel: #{inspect(reason)}")
        end
    end
  end

  def delete(conn, %{
        "resources" => "devices",
        "id" => id
      }) do
    case Castmill.Devices.get_device(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{errors: ["Device not found"]})
        |> halt()

      device ->
        with {:ok, %Device{}} <- Castmill.Devices.delete_device(device) do
          send_resp(conn, :no_content, "")
        else
          {:error, reason} ->
            send_resp(conn, 500, "Error deleting device: #{inspect(reason)}")
        end
    end
  end

  def delete(conn, %{
        "resources" => "teams",
        "id" => id
      }) do
    case Castmill.Teams.get_team(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{errors: ["Team not found"]})
        |> halt()

      team ->
        with {:ok, %Team{}} <- Teams.delete_team(team) do
          send_resp(conn, :no_content, "")
        else
          {:error, reason} ->
            send_resp(conn, 500, "Error deleting team: #{inspect(reason)}")
        end
    end
  end

  def delete(conn, %{
        "resources" => "layouts",
        "id" => id
      }) do
    case Castmill.Resources.get_layout(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{errors: ["Layout not found"]})
        |> halt()

      layout ->
        with {:ok, %Layout{}} <- Castmill.Resources.delete_layout(layout) do
          send_resp(conn, :no_content, "")
        else
          {:error, reason} ->
            send_resp(conn, 500, "Error deleting layout: #{inspect(reason)}")
        end
    end
  end

  def show(conn, %{"resources" => "medias", "id" => id}) do
    case Castmill.Resources.get_media(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Media not found"})
        |> halt()

      media ->
        conn
        |> render(:show, media: media)
    end
  end

  def show(conn, %{"resources" => "channels", "id" => id}) do
    case Castmill.Resources.get_channel(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Channel not found"})
        |> halt()

      channel ->
        conn
        |> render(:show, channel: channel)
    end
  end

  def show(conn, %{"resources" => "playlists", "id" => id}) do
    case Castmill.Resources.get_playlist(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Playlist not found"})
        |> halt()

      playlist ->
        conn
        |> render(:show, playlist: playlist)
    end
  end

  def show(conn, %{"resources" => "layouts", "id" => id}) do
    case Castmill.Resources.get_layout(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Layout not found"})
        |> halt()

      layout ->
        conn
        |> render(:show, layout_data: layout)
    end
  end

  @list_entries_params_schema %{
    organization_id: [type: :string, required: true],
    channel_id: [type: :string, required: true],
    start_date: [type: :integer, required: false],
    end_date: [type: :integer, required: false]
  }

  def list_channel_entries(conn, params) do
    with {:ok, params} <- Tarams.cast(params, @list_entries_params_schema) do
      _ = %{
        data: Devices.set_devices_online(Organizations.list_devices(params)),
        count: Organizations.count_devices(params)
      }

      case Castmill.Resources.get_channel(params.channel_id) do
        nil ->
          conn
          |> put_status(:not_found)
          |> Phoenix.Controller.json(%{message: "Channel not found"})
          |> halt()

        _ ->
          entries =
            Castmill.Resources.list_channel_entries(
              params.channel_id,
              params.start_date,
              params.end_date
            )

          conn
          |> put_status(:ok)
          |> json(entries)
      end
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> json(%{errors: errors})
        |> halt()
    end
  end

  def add_channel_entry(
        %Plug.Conn{
          body_params: body_params
        } = conn,
        %{"channel_id" => channel_id_str, "organization_id" => organization_id}
      ) do
    channel_id = String.to_integer(channel_id_str)

    case Castmill.Resources.get_channel(channel_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Channel #{channel_id} not found"})
        |> halt()

      channel ->
        with {:ok, %ChannelEntry{} = entry} <-
               Castmill.Resources.add_channel_entry(channel_id, body_params) do
          conn
          |> put_status(:created)
          |> put_resp_header(
            "location",
            ~p"/api/organizations/#{organization_id}/channels/#{channel.id}"
          )
          |> render(:show, entry: entry)
        end
    end
  end

  def delete_channel_entry(
        conn,
        %{"channel_id" => channel_id_str, "id" => id_str}
      ) do
    channel_id = String.to_integer(channel_id_str)
    id = String.to_integer(id_str)

    case Castmill.Resources.get_channel(channel_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Channel #{channel_id} not found"})
        |> halt()

      _ ->
        case Castmill.Resources.get_channel_entry(id) do
          nil ->
            conn
            |> put_status(:not_found)
            |> Phoenix.Controller.json(%{message: "Channel entry #{id} not found"})
            |> halt()

          entry ->
            with {:ok, %ChannelEntry{}} <- Castmill.Resources.delete_channel_entry(entry) do
              send_resp(conn, :no_content, "")
            else
              {:error, reason} ->
                send_resp(conn, 500, "Error deleting channel entry: #{inspect(reason)}")
            end
        end
    end
  end

  def update_channel_entry(
        %Plug.Conn{
          body_params: body_params
        } = conn,
        %{"channel_id" => channel_id_str, "id" => id_str}
      ) do
    channel_id = String.to_integer(channel_id_str)
    id = String.to_integer(id_str)

    case Castmill.Resources.get_channel(channel_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Channel #{channel_id} not found"})
        |> halt()

      _ ->
        case Castmill.Resources.get_channel_entry(id) do
          nil ->
            conn
            |> put_status(:not_found)
            |> Phoenix.Controller.json(%{message: "Channel entry #{id} not found"})
            |> halt()

          entry ->
            with {:ok, %ChannelEntry{} = entry} <-
                   Castmill.Resources.update_channel_entry(entry, body_params) do
              conn
              |> put_status(:ok)
              |> render(:show, entry: entry)
            end
        end
    end
  end
end
