defmodule CastmillWeb.ResourceController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash

  alias Castmill.Resources.Media
  alias Castmill.Resources.Calendar
  alias Castmill.Resources.Playlist
  alias Castmill.Resources.CalendarEntry
  alias Castmill.Devices.Device
  alias Castmill.Devices

  action_fallback(CastmillWeb.FallbackController)

  @impl CastmillWeb.AccessActorBehaviour

  def check_access(actor_id, action, %{
        "organization_id" => organization_id,
        "resources" => resources
      }) do
    if Organizations.is_admin?(organization_id, actor_id) or
         Organizations.has_access(organization_id, actor_id, resources, action) do
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

  @index_params_schema %{
    resources: [type: :string, required: true],
    page: [type: :integer, number: [min: 1]],
    page_size: [type: :integer, number: [min: 1, max: 100]],
    search: :string
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
        "resources" => "calendars",
        "organization_id" => organization_id,
        "calendar" => calendar
      }) do
    create_attrs = Map.merge(calendar, %{"organization_id" => organization_id})

    with {:ok, %Calendar{} = calendar} <- Castmill.Resources.create_calendar(create_attrs) do
      conn
      |> put_status(:created)
      |> put_resp_header(
        "location",
        ~p"/api/organizations/#{organization_id}/calendars/#{calendar.id}"
      )
      |> render(:show, calendar: calendar)
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
        "resources" => "calendars",
        "id" => id
      }) do
    case Castmill.Resources.get_calendar(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{errors: ["Calendar not found"]})
        |> halt()

      calendar ->
        with {:ok, %Calendar{}} <- Castmill.Resources.delete_calendar(calendar) do
          send_resp(conn, :no_content, "")
        else
          {:error, reason} ->
            send_resp(conn, 500, "Error deleting calendar: #{inspect(reason)}")
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

  def show(conn, %{"resources" => "calendars", "id" => id}) do
    case Castmill.Resources.get_calendar(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Calendar not found"})
        |> halt()

      calendar ->
        conn
        |> render(:show, calendar: calendar)
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

  def add_calendar_entry(
        %Plug.Conn{
          body_params: body_params
        } = conn,
        %{"calendar_id" => calendar_id_str, "organization_id" => organization_id}
      ) do
    calendar_id = String.to_integer(calendar_id_str)

    case Castmill.Resources.get_calendar(calendar_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> Phoenix.Controller.json(%{message: "Calendar not found"})
        |> halt()

      calendar ->
        with {:ok, %CalendarEntry{} = entry} <-
               Castmill.Resources.add_calendar_entry(calendar_id, body_params) do
          conn
          |> put_status(:created)
          |> put_resp_header(
            "location",
            ~p"/api/organizations/#{organization_id}/calendars/#{calendar.id}"
          )
          |> render(:show, entry: entry)
        end
    end
  end
end
