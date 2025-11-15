defmodule Castmill.Devices.RcLogger do
  @moduledoc """
  Structured logging for Remote Control sessions with correlation IDs.
  
  Provides consistent logging with device_id and session_id metadata for
  traceability and debugging of RC sessions.
  """
  require Logger

  @doc """
  Logs an info message with RC session correlation IDs.
  """
  def info(message, session_id, device_id \\ nil, metadata \\ []) do
    Logger.info(message, build_metadata(session_id, device_id, metadata))
  end

  @doc """
  Logs a warning message with RC session correlation IDs.
  """
  def warning(message, session_id, device_id \\ nil, metadata \\ []) do
    Logger.warning(message, build_metadata(session_id, device_id, metadata))
  end

  @doc """
  Logs an error message with RC session correlation IDs.
  """
  def error(message, session_id, device_id \\ nil, metadata \\ []) do
    Logger.error(message, build_metadata(session_id, device_id, metadata))
  end

  @doc """
  Logs a debug message with RC session correlation IDs.
  """
  def debug(message, session_id, device_id \\ nil, metadata \\ []) do
    Logger.debug(message, build_metadata(session_id, device_id, metadata))
  end

  # Private helpers

  defp build_metadata(session_id, device_id, extra_metadata) do
    base_metadata = [
      session_id: session_id,
      device_id: device_id,
      component: :rc_session
    ]

    Keyword.merge(base_metadata, extra_metadata)
  end
end
