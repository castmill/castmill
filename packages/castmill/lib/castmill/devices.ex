defmodule Castmill.Devices do
  @moduledoc """
  The Devices context.
  """
  import Ecto.Query, warn: false
  import Argon2

  alias Castmill.Organizations.Organization
  alias Castmill.Repo
  alias Castmill.Devices.Device
  alias Castmill.Devices.DevicesRegistrations
  alias Castmill.Devices.DevicesEvents

  alias Castmill.Protocol.Access
  alias Castmill.QueryHelpers

  alias CastmillWeb.Endpoint

  defimpl Access, for: Device do
    def canAccess(_device, user, _action) do
      if is_nil(user) do
        {:error, "No user provided"}
      else
        {:ok, true}
      end
    end
  end

  @doc """
  Creates a device.
  """
  def create_device(attrs \\ %{}) do
    %Device{}
    |> Device.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking device changes.

  ## Examples

      iex> change_device(user)
      %Ecto.Changeset{data: %Device{}}

  """
  def change_device(%Device{} = device, attrs \\ %{}) do
    Device.changeset(device, attrs)
  end

  @doc """
    Gets a device
  """
  def get_device(id) when is_binary(id) and byte_size(id) == 36 do
    Device
    |> where(id: ^id)
    |> Repo.one()
  end

  def get_device(_), do: nil

  # compute online based on last_online date and online status
  # If online is false, then the device is offline
  # If online is true, and last_online is more than 1 minute ago, then the device is offline
  def set_devices_online(devices) do
    current_time = DateTime.utc_now() |> DateTime.to_naive()

    Enum.map(devices, fn device ->
      Map.update!(device, :online, fn online ->
        online && check_online_within_minute(device.last_online, current_time)
      end)
    end)
  end

  defp check_online_within_minute(nil, _current_time), do: false

  defp check_online_within_minute(last_online, current_time) do
    one_minute_ago = NaiveDateTime.add(current_time, -60, :second)
    NaiveDateTime.compare(last_online, one_minute_ago) == :gt
  end

  @doc """
  Returns the list of devices for a given organization.

  Excludes token.

  ## Examples

      iex> list_devices()
      [%Device{}, ...]
  """
  def list_devices(%{
        organization_id: organization_id,
        search: search,
        page: page,
        page_size: page_size
      }) do
    offset = if is_nil(page_size), do: 0, else: max((page - 1) * page_size, 0)

    Device.base_query()
    |> Organization.where_org_id(organization_id)
    |> QueryHelpers.where_name_like(search)
    |> Ecto.Query.order_by([d], asc: d.name)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Repo.all()
    |> Enum.map(&Map.drop(&1, [:token, :token_hash]))
  end

  def list_devices(%{organization_id: organization_id}) do
    list_devices(%{organization_id: organization_id, search: nil, page: 1, page_size: nil})
  end

  def list_devices(%{page: page, page_size: page_size}) do
    list_devices(%{organization_id: nil, page: page, page_size: page_size, search: nil})
  end

  def list_devices(%{search: search}) do
    list_devices(%{organization_id: nil, search: search, page: 1, page_size: nil})
  end

  def list_devices(_params) do
    list_devices(%{organization_id: nil, search: nil, page: 1, page_size: nil})
  end

  def list_devices() do
    Repo.all(Device)
    |> Enum.map(&Map.drop(&1, [:token, :token_hash]))
  end

  def count_devices(%{organization_id: organization_id, search: search}) do
    Device.base_query()
    |> Organization.where_org_id(organization_id)
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
  end

  def count_devices(%{organization_id: organization_id}) do
    count_devices(%{organization_id: organization_id, search: nil})
  end

  def count_devices(%{search: search}) do
    count_devices(%{organization_id: nil, search: search})
  end

  def count_devices(_params) do
    count_devices(%{organization_id: nil, search: nil})
  end

  @doc """
    Mark a device as online. Sets the online field as well as the last_online field.
  """
  def mark_online(device_id, ip) do
    fast_update_device(device_id, %{online: true, last_online: DateTime.utc_now(), last_ip: ip})
  end

  @doc """
    Mark a device as offline. Sets the online field as well as the last_online field.
  """
  def mark_offline(device_id) do
    fast_update_device(device_id, %{online: false, last_online: DateTime.utc_now()})
  end

  @doc """
    Fast device update without validations.
  """
  def fast_update_device(id, attrs) do
    # Convert the map `attrs` to a keyword list if it's not already
    updates = Enum.into(attrs, [])

    query = from(d in Device, where: d.id == ^id)

    case Repo.update_all(query, set: updates) do
      {1, nil} -> {:ok, nil}
      _ -> {:error, "Failed to update device"}
    end
  end

  @doc """
    Updates a device.
  """
  def update_device(%Device{} = device, attrs) do
    device
    |> Device.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
    Creates a device registration.
  """
  def create_device_registration(
        %{
          device_ip: _device_ip,
          hardware_id: _hardware_id
          # user_agent: _user_agent,
          # version: _version,
          # timezone: _timezone,
          # loc_lat: _loc_lat,
          # loc_long: _loc_long,
        } = attrs
      ) do
    symbols = ~c"123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    symbol_count = Enum.count(symbols)

    pincode = for _ <- 1..10, into: "", do: <<Enum.at(symbols, :rand.uniform(symbol_count) - 1)>>

    %DevicesRegistrations{pincode: pincode}
    |> DevicesRegistrations.changeset(attrs)
    |> Repo.insert(on_conflict: :replace_all, conflict_target: :hardware_id)
  end

  @doc """
    Gets a device registration.
  """
  def get_devices_registration(hardware_id, pincode) do
    DevicesRegistrations
    |> where([d], d.hardware_id == ^hardware_id and d.pincode == ^pincode)
    |> Repo.one()
  end

  def get_devices_registration(pincode) do
    DevicesRegistrations
    |> where([d], d.pincode == ^pincode)
    |> Repo.one()
  end

  @doc """
  Registers a device.

  Perform the following steps inside a transaction:
    Check if there is a devices registration with the given pincode.
    If there is, create a new device and delete the register.
    If there is not, return an error.
    If there is a register, but the pincode is expired, return an error.
    Optionally, add a default channel to the device based on the `add_default_channel` option.
  """
  def register_device(organization_id, pincode, attrs \\ %{}, opts \\ %{}) do
    Repo.transaction(fn ->
      devices_registration = Repo.get_by(DevicesRegistrations, pincode: pincode)

      if devices_registration do
        case DateTime.compare(devices_registration.expires_at, DateTime.utc_now()) do
          :lt ->
            # expires_at is before utc_now()
            # Handle the expired logic here
            Repo.rollback(:pincode_expired)
          :eq -> handle_non_expired_device(devices_registration, organization_id, opts, attrs)
          :gt -> handle_non_expired_device(devices_registration, organization_id, opts, attrs)
        end
      else
        Repo.rollback(:invalid_pincode)
      end
    end)
  end

  defp handle_non_expired_device(devices_registration, organization_id, opts, attrs) do
    token = generate_token()

    params =
      Map.merge(
        %{
          organization_id: organization_id,
          token: token,
          last_online: DateTime.utc_now(),
          last_ip: devices_registration.device_ip
        },
        Map.from_struct(devices_registration)
      )

    with {:ok, _} <- Repo.delete(devices_registration),
         {:ok, device} <- create_device(Map.merge(params, attrs)) do
      add_channel_option = Map.get(opts, :add_default_channel, false)

      add_channel_result =
        if add_channel_option do
          with {:ok, channel} <- create_default_channel(device),
               {:ok, _} <- add_channel(device.id, channel.id) do
            {:ok, channel}
          else
            {:error, changeset} -> Repo.rollback(changeset)
          end
        else
          {:ok, nil}
        end

      case add_channel_result do
        {:ok, _channel} ->
          Endpoint.broadcast("register:#{device.hardware_id}", "device:registered", %{
            device: %{
              id: device.id,
              name: device.name,
              token: token
            }
          })

          {Map.drop(device, [:token, :token_hash]), token}

        {:error, _} = error ->
          error
      end
    else
      {:error, changeset} -> Repo.rollback(changeset)
    end
  end

  # Creates a default channel for a given device
  # This channel is used to store the default playlist for the device
  # The default playlist is the playlist that is played when no other playlist is selected
  defp create_default_channel(device) do
    # Create default playlist and assign it as default playlist to the channel
    {:ok, playlist} = create_default_playlist("#{device.name} Default", device.organization_id)

    %Castmill.Resources.Channel{}
    |> Castmill.Resources.Channel.changeset(%{
      name: "#{device.name} Default",
      organization_id: device.organization_id,
      default_playlist_id: playlist.id,
      timezone: "UTC"
    })
    |> Castmill.Repo.insert()
  end

  defp create_default_playlist(name, organization_id) do
    {:ok, playlist} =
      %Castmill.Resources.Playlist{}
      |> Castmill.Resources.Playlist.changeset(%{
        name: name,
        organization_id: organization_id
      })
      |> Castmill.Repo.insert()

    # Add a default entry to the playlist (we will add the Intro widget)
    widget = Castmill.Widgets.get_widget_by_slug("intro")

    if widget != nil do
      {:ok, _item} =
        Castmill.Resources.insert_item_into_playlist(
          playlist.id,
          nil,
          widget.id,
          0,
          10000
        )
    end

    {:ok, playlist}
  end

  @doc """
    Verify device token.
  """
  def verify_device_token(device_id, token) do
    Repo.get_by(Device, id: device_id)
    |> check_password(token, hash_key: :token_hash)
  end

  # The following are helper functions that were deprecated in Argon2
  defp check_password(nil, _password, opts) do
    if opts[:hide_user] != false, do: no_user_verify(opts)
    {:error, :invalid_device}
  end

  defp check_password(device, password, opts) when is_binary(password) do
    case get_hash(device, opts[:hash_key]) do
      {:ok, hash} ->
        if verify_pass(password, hash), do: {:ok, device}, else: {:error, "invalid password"}

      _ ->
        {:error, "no token hash found in the device struct"}
    end
  end

  defp check_password(_a, _b, _c) do
    {:error, "token is not a string"}
  end

  defp get_hash(%{password_hash: hash}, nil), do: {:ok, hash}
  defp get_hash(%{encrypted_password: hash}, nil), do: {:ok, hash}
  defp get_hash(_, nil), do: nil

  defp get_hash(user, hash_key) do
    if hash = Map.get(user, hash_key), do: {:ok, hash}
  end

  @doc """
    Automatically recovers a device. If a device has lost its token for some reason, it is possible to recover it
    by providing the device id only, but some limitations apply, a device can only be recovered once per hour,
    it must have the same IP address as the last time it was online, and it must have the "auto_recovery"
    setting enabled.
  """
  def recover_device(hardware_id, device_ip) do
    Repo.transaction(fn ->
      # Find device by hardware_id
      device = Repo.get_by(Device, hardware_id: hardware_id)

      # TODO: also check if auto_recovery is enabled
      if not is_nil(device) and
           device.last_ip == device_ip and
           device.updated_at >= DateTime.from_unix(:os.system_time(:seconds) - 60 * 60, :second) do
        # Update device token
        token = generate_token()
        device = update_device(device, %{token: token})
        {device, token}
      else
        Repo.rollback("Device not found or not eligible for recovery")
      end
    end)
  end

  defp generate_token do
    :crypto.strong_rand_bytes(64) |> Base.encode64()
  end

  @doc """
    Add channel to device. A device can have multiple channels attached to it.
  """
  def add_channel(device_id, channel_id) do
    %Castmill.Devices.DevicesChannels{}
    |> Castmill.Devices.DevicesChannels.changeset(%{
      device_id: device_id,
      channel_id: channel_id
    })
    |> Castmill.Repo.insert()
  end

  @doc """
    Remove channel from device.
  """
  def remove_channel(device_id, channel_id) do
    query =
      from(dc in Castmill.Devices.DevicesChannels,
        where: dc.device_id == ^device_id and dc.channel_id == ^channel_id
      )

    Repo.delete_all(query)
  end

  @doc """
    List device channels.
  """
  def list_channels(device_id) do
    query =
      from(channel in Castmill.Resources.Channel,
        join: dc in Castmill.Devices.DevicesChannels,
        on: channel.id == dc.channel_id,
        where: dc.device_id == ^device_id,
        select: channel
      )

    channels = Repo.all(query)
    Repo.preload(channels, :entries)
  end

  @doc """
  Removes a device and all its entries.
  """
  def delete_device(%Device{} = device) do
    Repo.delete(device)
  end

  @doc """
    Checks if a device has access to a channeö entry
  """
  def has_access_to_channel_entry(device_id, channel_entry_id) do
    query =
      from(dc in Castmill.Devices.DevicesChannels,
        join: ce in Castmill.Resources.ChannelEntry,
        on: dc.channel_id == ce.channel_id,
        where: dc.device_id == ^device_id and ce.id == ^channel_entry_id
      )

    Repo.one(query) !== nil
  end

  @doc """
    Checks if a device has access to a playlist.
    If a playlist is used by a channel entry, it is considered to be accessible
    by the device that has the channel with the given channel entry.
  """
  def has_access_to_playlist(device_id, playlist_id) do
    query =
      from(dc in Castmill.Devices.DevicesChannels,
        join: ce in Castmill.Resources.ChannelEntry,
        on: dc.channel_id == ce.channel_id,
        join: pl in Castmill.Resources.Playlist,
        on: ce.playlist_id == pl.id,
        where: dc.device_id == ^device_id and pl.id == ^playlist_id
      )

    Repo.one(query) !== nil
  end

  @doc """
    Inserts an event entry for a device.

    If the number of event exceeds the limit, the oldest entries are deleted.
  """
  def insert_event(%{device_id: device_id} = attrs, max_logs \\ 100) do
    Repo.transaction(fn ->
      # Count the current number of logs for this device
      current_count =
        from(l in DevicesEvents, where: l.device_id == ^device_id)
        |> Repo.aggregate(:count, :id)

      # Identify and delete the oldest log IDs if the count exceeds the limit
      if current_count >= max_logs do
        oldest_ids =
          from(l in DevicesEvents, where: l.device_id == ^device_id)
          |> order_by([l], asc: l.id)
          |> limit(^max(current_count - max_logs + 1, 0))
          |> select([l], l.id)
          |> Repo.all()

        from(l in DevicesEvents, where: l.id in ^oldest_ids)
        |> Repo.delete_all()
      end

      # Insert the new event entry with the current UTC timestamp
      %DevicesEvents{}
      |> DevicesEvents.changeset(Map.put(attrs, :timestamp, DateTime.utc_now()))
      |> Repo.insert!()
    end)
  end

  @doc """
  Returns the list of events for a given device. Supports pagination and search.

  ## Examples

      iex> list_resources(Media, params)
      [%Media{}, ...]
  """
  def list_devices_events(%{
        device_id: device_id,
        page: page,
        page_size: page_size,
        search: search
      }) do
    offset = if is_nil(page_size), do: 0, else: max((page - 1) * page_size, 0)

    Castmill.Devices.DevicesEvents.base_query()
    # Pin the device_id variable using ^
    |> where([dl], dl.device_id == ^device_id)
    |> where_msg_like(search)
    |> Ecto.Query.order_by([d], desc: d.timestamp)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Repo.all()
  end

  defp where_msg_like(query, nil) do
    query
  end

  defp where_msg_like(query, pattern) do
    from(e in query,
      where: ilike(e.msg, ^"%#{pattern}%")
    )
  end

  def count_devices_events(%{device_id: device_id, search: search}) do
    Castmill.Devices.DevicesEvents.base_query()
    |> where([dl], dl.device_id == ^device_id)
    |> where_msg_like(search)
    |> Repo.aggregate(:count, :id)
  end
end
