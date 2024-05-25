defmodule CastmillWeb.ResourceController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash

  alias Castmill.Resources.Media
  alias Castmill.Resources.Channel
  alias Castmill.Resources.Playlist
  alias Castmill.Resources.ChannelEntry
  alias Castmill.Devices.Device
  alias Castmill.Devices

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

  @index_params_schema %{
    organization_id: [type: :string, required: true],
    resources: [type: :string, required: true],
    page: [type: :integer, number: [min: 1]],
    page_size: [type: :integer, number: [min: 1, max: 100]],
    search: :string,
    filters: [
      type: :string,
      cast_func: &CastmillWeb.ResourceController.parse_filters/1
    ]
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

  def update(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> Phoenix.Controller.json(%{errors: ["Resource not found"]})
    |> halt()
  end

  def create(conn, %{
        "resources" => "medias",
        "organization_id" => organization_id,
        "media" => media
      }) do
    create_attrs = Map.merge(media, %{"organization_id" => organization_id})

    with {:ok, %Media{} = media} <- Castmill.Resources.create_media(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/organizations/#{organization_id}/medias/#{media.id}")
      |> render(:show, media: media)
    end
  end

  def create(conn, %{
        "resources" => "playlists",
        "organization_id" => organization_id,
        "playlist" => playlist
      }) do
    create_attrs = Map.merge(playlist, %{"organization_id" => organization_id})

    with {:ok, %Playlist{} = playlist} <- Castmill.Resources.create_playlist(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header(
        "location",
        ~p"/api/organizations/#{organization_id}/playlists/#{playlist.id}"
      )
      |> render(:show, playlist: playlist)
    end
  end

  def create(conn, %{
        "resources" => "channels",
        "organization_id" => organization_id,
        "channel" => channel
      }) do
    create_attrs = Map.merge(channel, %{"organization_id" => organization_id})

    with {:ok, %Channel{} = channel} <- Castmill.Resources.create_channel(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header(
        "location",
        ~p"/api/organizations/#{organization_id}/channels/#{channel.id}"
      )
      |> render(:show, channel: channel)
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
        |> Phoenix.Controller.json(%{message: "Channel not found"})
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
end
