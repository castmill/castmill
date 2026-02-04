defmodule Castmill.Workers.SystemCmdBehaviour do
  @moduledoc """
  Behaviour for executing system commands.
  This allows mocking System.cmd in tests.
  """

  @doc """
  Executes a system command with the given arguments and options.

  ## Parameters
    * `command` - The system command to execute (e.g., "ffmpeg")
    * `args` - List of arguments to pass to the command
    * `opts` - Keyword list of options (e.g., stderr_to_stdout: true)

  ## Returns
    A tuple `{output, exit_code}` where:
    * `output` - The command's output as a binary string
    * `exit_code` - The command's exit code as a non-negative integer
  """
  @callback cmd(binary(), [binary()], keyword()) :: {binary(), non_neg_integer()}
end
