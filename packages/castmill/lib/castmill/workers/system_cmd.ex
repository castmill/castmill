defmodule Castmill.Workers.SystemCmd do
  @moduledoc """
  Default implementation of SystemCmdBehaviour that delegates to System.cmd.
  This is the production implementation used when no mock is injected.
  """

  @behaviour Castmill.Workers.SystemCmdBehaviour

  @doc """
  Delegates to System.cmd/3 for actual command execution.
  See System.cmd/3 for full documentation.
  """
  @impl true
  def cmd(command, args, opts) do
    System.cmd(command, args, opts)
  end
end
