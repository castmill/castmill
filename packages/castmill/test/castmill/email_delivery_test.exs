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

  # ---------------------------------------------------------------------------
  # deliver/2 — enqueues via BullMQ (inline in test mode)
  # ---------------------------------------------------------------------------

  test "deliver/2 returns {:ok, :queued} on successful provider response" do
    Application.put_env(:castmill, Castmill.Mailer, adapter: OkMailerAdapter)

    email = new() |> to("to@example.com") |> from("from@example.com") |> subject("test")

    assert {:ok, :queued} = EmailDelivery.deliver(email, context: "test.ok")
  end

  test "deliver/2 returns {:error, reason} on provider error (inline mode)" do
    Application.put_env(:castmill, Castmill.Mailer, adapter: ErrorMailerAdapter)

    email = new() |> to("to@example.com") |> from("from@example.com") |> subject("test")

    capture_log(fn ->
      assert {:error, :provider_error} = EmailDelivery.deliver(email, context: "test.error")
    end)
  end

  test "deliver/2 returns {:error, exception} when adapter raises (inline mode)" do
    Application.put_env(:castmill, Castmill.Mailer, adapter: RaisingMailerAdapter)

    email = new() |> to("to@example.com") |> from("from@example.com") |> subject("test")

    capture_log(fn ->
      assert {:error, %ArgumentError{message: "forced mailer exception"}} =
               EmailDelivery.deliver(email, context: "test.raise")
    end)
  end

  # ---------------------------------------------------------------------------
  # deliver_now/2 — direct Mailer call (used by EmailWorker)
  # ---------------------------------------------------------------------------

  test "deliver_now/2 returns {:ok, email} on successful provider response" do
    Application.put_env(:castmill, Castmill.Mailer, adapter: OkMailerAdapter)

    email = new() |> to("to@example.com") |> from("from@example.com") |> subject("test")

    assert {:ok, delivered_email} = EmailDelivery.deliver_now(email, context: "test.ok")
    assert delivered_email.subject == "test"
  end

  test "deliver_now/2 returns {:error, reason} on provider error" do
    Application.put_env(:castmill, Castmill.Mailer, adapter: ErrorMailerAdapter)

    email = new() |> to("to@example.com") |> from("from@example.com") |> subject("test")

    capture_log(fn ->
      assert {:error, :provider_error} = EmailDelivery.deliver_now(email, context: "test.error")
    end)
  end

  test "deliver_now/2 rescues and returns {:error, exception} when adapter raises" do
    Application.put_env(:castmill, Castmill.Mailer, adapter: RaisingMailerAdapter)

    email = new() |> to("to@example.com") |> from("from@example.com") |> subject("test")

    capture_log(fn ->
      assert {:error, %ArgumentError{message: "forced mailer exception"}} =
               EmailDelivery.deliver_now(email, context: "test.raise")
    end)
  end

  # ---------------------------------------------------------------------------
  # Serialization round-trip
  # ---------------------------------------------------------------------------

  test "serialize/deserialize preserves email fields" do
    original =
      new()
      |> to("to@example.com")
      |> from({"Castmill", "noreply@castmill.com"})
      |> subject("Hello")
      |> text_body("Plain text")
      |> html_body("<p>HTML</p>")

    data = EmailDelivery.serialize_email(original, context: "test", metadata: %{id: 1})
    restored = EmailDelivery.deserialize_email(data)

    assert restored.to == [{"Castmill", "to@example.com"}] ||
             restored.to == [{"", "to@example.com"}]

    assert restored.from == {"Castmill", "noreply@castmill.com"}
    assert restored.subject == "Hello"
    assert restored.text_body == "Plain text"
    assert restored.html_body == "<p>HTML</p>"
    assert data["context"] == "test"
    assert data["metadata"] == %{id: 1}
  end

  # ---------------------------------------------------------------------------
  # Validation — deliver/2 rejects invalid emails
  # ---------------------------------------------------------------------------

  describe "deliver/2 validation" do
    test "returns {:error, {:invalid_email, _}} when from is nil" do
      email = new() |> to("to@example.com") |> subject("Test")

      assert {:error, {:invalid_email, "from is required"}} = EmailDelivery.deliver(email)
    end

    test "returns {:error, {:invalid_email, _}} when to is empty list" do
      email = %{new() | to: []} |> from("noreply@castmill.com") |> subject("Test")

      assert {:error, {:invalid_email, "to is required"}} = EmailDelivery.deliver(email)
    end

    test "returns {:error, {:invalid_email, _}} when to is nil" do
      email = %{new() | to: nil} |> from("noreply@castmill.com") |> subject("Test")

      assert {:error, {:invalid_email, "to is required"}} = EmailDelivery.deliver(email)
    end

    test "accepts valid email with binary from and to" do
      email =
        new()
        |> to("to@example.com")
        |> from("noreply@castmill.com")
        |> subject("Valid")

      assert {:ok, :queued} = EmailDelivery.deliver(email)
    end

    test "accepts valid email with tuple from and to" do
      email =
        new()
        |> to({"Recipient", "to@example.com"})
        |> from({"Castmill", "noreply@castmill.com"})
        |> subject("Valid")

      assert {:ok, :queued} = EmailDelivery.deliver(email)
    end
  end
end
