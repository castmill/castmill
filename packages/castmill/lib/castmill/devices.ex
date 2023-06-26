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

  alias Castmill.Protocol.Access
  alias Castmill.QueryHelpers

  alias CastmillWeb.Endpoint

  defimpl Access, for: Device do
    def canAccess(_device, user, _action) do
      if user == nil do
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
  Returns the list of devices for a given organization.

  Excludes token.

  ## Examples

      iex> list_devices()
      [%Device{}, ...]
  """
  def list_devices(params) when is_map(params) do
    organization_id = params[:organization_id]
    page = params[:page] || 0
    page_size = params[:page_size]
    search = params[:search]
    offset = if page_size == nil, do: 0, else: max((page - 1) * page_size, 0)

    Device.base_query()
    |> Organization.where_org_id(organization_id)
    |> QueryHelpers.where_name_like(search)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Repo.all()
    |> Enum.map(&Map.drop(&1, [:token, :token_hash]))
  end

  def list_devices() do
    Repo.all(Device)
    |> Enum.map(&Map.drop(&1, [:token, :token_hash]))
  end

  def count_devices(params) when is_map(params) do
    organization_id = params[:organization_id]
    search = params[:search]

    Device.base_query()
    |> Organization.where_org_id(organization_id)
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
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
    symbols = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
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
      Check if there is a devices register with the given pincode.
      If there is, create a new device and delete the register.
      If there is not, return an error.
      If there is a register, but the pincode is expired, return an error.
  """
  def register_device(organization_id, pincode, attrs \\ {}) do
    Repo.transaction(fn ->
      devices_registration = Repo.get_by(DevicesRegistrations, pincode: pincode)

      if devices_registration do
        if devices_registration.expires_at < DateTime.utc_now() do
          Repo.rollback(:pincode_expired)
        else
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
            Endpoint.broadcast("register:#{device.hardware_id}", "device:registered", %{
              device: %{
                id: device.id,
                name: device.name,
                token: token
              }
            })

            {Map.drop(device, [:token, :token_hash]), token}
          else
            {:error, changeset} -> Repo.rollback(changeset)
          end
        end
      else
        Repo.rollback(:invalid_pincode)
      end
    end)
  end

  @doc """
    Verify device token.
  """
  def verify_device_token(device_id, token) do
    Repo.get_by(Device, id: device_id)
    |> check_pass(token, hash_key: :token_hash)
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
      if device !== nil and
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
    Add calendar to device
  """
  def add_calendar(device_id, calendar_id) do
    %Castmill.Devices.DevicesCalendars{device_id: device_id, calendar_id: calendar_id}
    |> Castmill.Repo.insert()
  end

  @doc """
    Remove calendar from device
  """
  def remove_calendar(device_id, calendar_id) do
    query =
      from(dc in Castmill.Devices.DevicesCalendars,
        where: dc.device_id == ^device_id and dc.calendar_id == ^calendar_id
      )

    Repo.delete_all(query)
  end

  @doc """
    List device calendars.
  """
  def list_calendars(device_id) do
    query =
      from(calendar in Castmill.Resources.Calendar,
        join: dc in Castmill.Devices.DevicesCalendars,
        on: calendar.id == dc.calendar_id,
        where: dc.device_id == ^device_id,
        select: calendar
      )

    Repo.all(query)
  end

  @doc """
  Removes a device and all its entries.
  """
  def delete_device(%Device{} = device) do
    Repo.delete(device)
  end

  @doc """
    Checks if a device has access to a calendar entry
  """
  def has_access_to_calendar_entry(device_id, calendar_entry_id) do
    query =
      from(dc in Castmill.Devices.DevicesCalendars,
        join: ce in Castmill.Resources.CalendarEntry,
        on: dc.calendar_id == ce.calendar_id,
        where: dc.device_id == ^device_id and ce.id == ^calendar_entry_id
      )

    Repo.one(query) !== nil
  end

  @doc """
    Checks if a device has access to a playlist.
    If a playlist is used by a calendar entry, it is considered to be accessible
    by the device that has the calendar with the given calendar entry.
  """
  def has_access_to_playlist(device_id, playlist_id) do
    query =
      from(dc in Castmill.Devices.DevicesCalendars,
        join: ce in Castmill.Resources.CalendarEntry,
        on: dc.calendar_id == ce.calendar_id,
        join: pl in Castmill.Resources.Playlist,
        on: ce.playlist_id == pl.id,
        where: dc.device_id == ^device_id and pl.id == ^playlist_id
      )

    Repo.one(query) !== nil
  end
end
