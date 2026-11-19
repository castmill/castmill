defmodule Castmill.FailingMailerAdapter do
  @moduledoc """
  A Swoosh adapter that always fails, to test what happens when an email
  cannot be sent. Tests using it must not be async, because it changes the
  mailer configuration.
  """
  use Swoosh.Adapter

  @impl true
  def deliver(_email, _config), do: {:error, :mailer_unavailable}

  @doc "Runs `fun` while every email fails."
  def with_failing_mailer(fun) when is_function(fun, 0) do
    previous = Application.get_env(:castmill, Castmill.Mailer, [])
    Application.put_env(:castmill, Castmill.Mailer, Keyword.put(previous, :adapter, __MODULE__))

    try do
      fun.()
    after
      Application.put_env(:castmill, Castmill.Mailer, previous)
    end
  end
end
