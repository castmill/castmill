defmodule Castmill.RcSessionsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  RC session entities.
  """

  alias Castmill.Devices.RcSessions

  @doc """
  Generate an RC session.
  """
  def rc_session_fixture(attrs \\ %{}) do
    device_id = attrs[:device_id] || raise "device_id is required"
    user_id = attrs[:user_id] || raise "user_id is required"

    {:ok, session} = RcSessions.create_session(device_id, user_id)
    session
  end
end
