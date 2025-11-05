defmodule Castmill.Devices.RcSessions do
  @moduledoc """
  Context for managing remote control sessions.
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Devices.RcSession

  @doc """
  Creates a new RC session for a device and user.
  """
  def create_session(device_id, user_id) do
    attrs = %{
      device_id: device_id,
      user_id: user_id,
      status: "active",
      started_at: DateTime.utc_now()
    }

    %RcSession{}
    |> RcSession.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Gets an RC session by ID.
  """
  def get_session(id) do
    Repo.get(RcSession, id)
  end

  @doc """
  Gets an active RC session for a device.
  """
  def get_active_session_for_device(device_id) do
    RcSession
    |> where([s], s.device_id == ^device_id and s.status == "active")
    |> order_by([s], desc: s.started_at)
    |> limit(1)
    |> Repo.one()
  end

  @doc """
  Stops an RC session.
  """
  def stop_session(session_id) do
    case get_session(session_id) do
      nil ->
        {:error, :not_found}

      session ->
        session
        |> RcSession.changeset(%{status: "stopped", stopped_at: DateTime.utc_now()})
        |> Repo.update()
    end
  end

  @doc """
  Gets the status of active RC session for a device.
  """
  def get_device_rc_status(device_id) do
    case get_active_session_for_device(device_id) do
      nil ->
        %{has_active_session: false, session: nil}

      session ->
        %{has_active_session: true, session: session}
    end
  end
end
