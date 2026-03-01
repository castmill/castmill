defmodule Castmill.EmailDeliveryTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog
  import Swoosh.Email

  alias Castmill.EmailDelivery

  defmodule OkMailerAdapter do
    use Swoosh.Adapter, required_config: []

    @impl true
    def deliver(_email, _config), do: {:ok, %{id: "ok"}}
  end

  defmodule ErrorMailerAdapter do
    use Swoosh.Adapter, required_config: []

    @impl true
    def deliver(_email, _config), do: {:error, :provider_error}
  end

  defmodule RaisingMailerAdapter do
    use Swoosh.Adapter, required_config: []

    @impl true
    def deliver(_email, _config), do: raise(ArgumentError, "forced mailer exception")
  end

  setup do
    previous_mailer_config = Application.get_env(:castmill, Castmill.Mailer)

    on_exit(fn ->
      Application.put_env(:castmill, Castmill.Mailer, previous_mailer_config)
    end)

    :ok
  end

  test "deliver/2 returns {:ok, email} on successful provider response" do
    Application.put_env(:castmill, Castmill.Mailer, adapter: OkMailerAdapter)

    email = new() |> to("to@example.com") |> from("from@example.com") |> subject("test")

    assert {:ok, delivered_email} = EmailDelivery.deliver(email, context: "test.ok")
    assert delivered_email.subject == "test"
  end

  test "deliver/2 returns {:error, reason} on provider error" do
    Application.put_env(:castmill, Castmill.Mailer, adapter: ErrorMailerAdapter)

    email = new() |> to("to@example.com") |> from("from@example.com") |> subject("test")

    capture_log(fn ->
      assert {:error, :provider_error} = EmailDelivery.deliver(email, context: "test.error")
    end)
  end

  test "deliver/2 rescues and returns {:error, exception} when adapter raises" do
    Application.put_env(:castmill, Castmill.Mailer, adapter: RaisingMailerAdapter)

    email = new() |> to("to@example.com") |> from("from@example.com") |> subject("test")

    capture_log(fn ->
      assert {:error, %ArgumentError{message: "forced mailer exception"}} =
               EmailDelivery.deliver(email, context: "test.raise")
    end)
  end
end
