defmodule Castmill.Accounts.UserNotifierTest do
  use ExUnit.Case, async: true

  alias Castmill.Accounts.SignUp
  alias Castmill.Accounts.UserNotifier

  test "deliver_signup_instructions returns error tuple when mailer raises" do
    previous_mailer_config = Application.get_env(:castmill, Castmill.Mailer)

    on_exit(fn ->
      Application.put_env(:castmill, Castmill.Mailer, previous_mailer_config)
    end)

    Application.put_env(:castmill, Castmill.Mailer,
      adapter: Swoosh.Adapters.AmazonSES,
      region: "eu-central-1"
    )

    signup = %SignUp{
      id: Ecto.UUID.generate(),
      email: "invitee@example.com",
      challenge: "challenge"
    }

    assert {:error, %ArgumentError{}} =
             UserNotifier.deliver_signup_instructions(signup, "https://app.castmill.dev")
  end
end
