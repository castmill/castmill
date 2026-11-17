defmodule Castmill.Accounts.UserNotifierRaisingAdapter do
  use Swoosh.Adapter, required_config: []

  @impl true
  def deliver(_email, _config) do
    raise ArgumentError, "forced mailer error for notifier test"
  end
end

defmodule Castmill.Accounts.UserNotifierTest do
  use Castmill.DataCase, async: false

  import ExUnit.CaptureLog
  import Swoosh.TestAssertions

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

  test "deliver_already_registered_notice sends email with expected subject and login URL" do
    email = "existing@example.com"
    dashboard_uri = "https://app.castmill.dev"

    {:ok, _email} = UserNotifier.deliver_already_registered_notice(email, dashboard_uri)

    assert_email_sent(fn sent_email ->
      assert sent_email.subject == "Castmill™ — You Already Have an Account"
      assert Enum.any?(sent_email.to, fn {_name, addr} -> addr == email end)

      login_url = "#{dashboard_uri}/login?email=#{URI.encode_www_form(email)}"

      assert sent_email.text_body =~ login_url
      assert sent_email.html_body =~ login_url
    end)
  end

  test "emails for a network's dashboard are branded as the network" do
    network =
      Castmill.NetworksFixtures.network_fixture(%{
        name: "Tylöprint <b>",
        domain: "signage.tyloprint.test",
        email: "info@tyloprint.test",
        copyright: "© 2024 Castmill AB"
      })

    {:ok, _email} =
      UserNotifier.deliver_already_registered_notice(
        "existing@example.com",
        "https://signage.tyloprint.test"
      )

    assert_email_sent(fn sent ->
      assert sent.subject == "Tylöprint <b> — You Already Have an Account"
      assert sent.from == {"Tylöprint <b>", "no-reply@castmill.com"}
      assert sent.reply_to == {"", "info@tyloprint.test"}

      for body <- [sent.text_body, sent.html_body] do
        refute body =~ "Castmill"
        assert body =~ "info@tyloprint.test"
        assert body =~ "© #{Date.utc_today().year} Tylöprint"
      end

      assert sent.html_body =~ "Tylöprint &lt;b&gt;"
      refute sent.html_body =~ "Tylöprint <b>"
      refute sent.text_body =~ "please do not reply"
      true
    end)

    signup = %SignUp{
      id: Ecto.UUID.generate(),
      email: "new@example.com",
      challenge: "challenge",
      network_id: network.id
    }

    {:ok, _email} =
      UserNotifier.deliver_signup_instructions(signup, "https://signage.tyloprint.test")

    assert_email_sent(fn sent ->
      assert sent.subject == "Complete Your Tylöprint <b> Signup"
      refute sent.text_body =~ "Castmill"
      refute sent.html_body =~ "Castmill"
      true
    end)
  end

  test "deliver_already_registered_notice returns error tuple when mailer raises" do
    previous_mailer_config = Application.get_env(:castmill, Castmill.Mailer)

    on_exit(fn ->
      Application.put_env(:castmill, Castmill.Mailer, previous_mailer_config)
    end)

    Application.put_env(:castmill, Castmill.Mailer,
      adapter: Castmill.Accounts.UserNotifierRaisingAdapter
    )

    capture_log(fn ->
      assert {:error, %ArgumentError{message: "forced mailer error for notifier test"}} =
               UserNotifier.deliver_already_registered_notice(
                 "existing@example.com",
                 "https://app.castmill.dev"
               )
    end)
  end
end
