defmodule Castmill.Accounts.UserNotifierRaisingAdapter do
  use Swoosh.Adapter, required_config: []

  @impl true
  def deliver(_email, _config) do
    raise ArgumentError, "forced mailer error for notifier test"
  end
end

defmodule Castmill.Accounts.UserNotifierTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog

  alias Castmill.Accounts.SignUp
  alias Castmill.Accounts.UserNotifier

  test "deliver_signup_instructions returns error tuple when mailer raises" do
    previous_mailer_config = Application.get_env(:castmill, Castmill.Mailer)

    on_exit(fn ->
      Application.put_env(:castmill, Castmill.Mailer, previous_mailer_config)
    end)

    Application.put_env(:castmill, Castmill.Mailer,
      adapter: Castmill.Accounts.UserNotifierRaisingAdapter
    )

    signup = %SignUp{
      id: Ecto.UUID.generate(),
      email: "invitee@example.com",
      challenge: "challenge"
    }

    capture_log(fn ->
      assert {:error, %ArgumentError{message: "forced mailer error for notifier test"}} =
               UserNotifier.deliver_signup_instructions(signup, "https://app.castmill.dev")
    end)
  end
end
