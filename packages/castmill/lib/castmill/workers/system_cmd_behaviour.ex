defmodule Castmill.Workers.SystemCmdBehaviour do
  @moduledoc """
  Behaviour for executing system commands.
  This allows mocking System.cmd in tests.
  """

  @callback cmd(binary(), [binary()], keyword()) :: {binary(), non_neg_integer()}
end
