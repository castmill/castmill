defmodule Castmill.Workers.SystemCmd do
  @moduledoc """
  Default implementation of SystemCmdBehaviour that delegates to System.cmd.
  """

  @behaviour Castmill.Workers.SystemCmdBehaviour

  @impl true
  def cmd(command, args, opts) do
    System.cmd(command, args, opts)
  end
end
