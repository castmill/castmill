defmodule Castmill.Addons.Onboarding do
  use Castmill.Addons.Addon

  import Swoosh.Email
  alias Castmill.Mailer

  @impl Castmill.Addons.AddonBehaviour
  def register_hooks() do
    IO.puts("[info] Registering onboarding hooks")
    Castmill.Hooks.register_hook(:user_signup, &__MODULE__.on_user_signup/1)
  end

  @doc """
    Send an onborading email to the user, eventually schedule another email
    to be sent in 3 days.
  """
  def on_user_signup(%{user_id: user_id, email: email}) do
    _result = welcome_email(user_id, email)
    # Schedule another email to be sent in 3 days
    # Castmill.Scheduler.schedule_in(3 * 24 * 60 * 60, &reminder_email/1, [user_id])
  end

  defp welcome_email(user_id, email) do
    user = Castmill.Accounts.get_user(user_id)

    subject = "Welcome to Castmill!"

    body = """
    Hello #{user.name || ""}

    Welcome to Castmill! We're excited to have you on board.
    """

    deliver(email, subject, body)
  end

  # Delivers the email using the application mailer.
  defp deliver(recipient, subject, body) do
    email =
      new()
      |> to(recipient)
      |> from({"Castmill", "no-reply@castmill.com"})
      |> subject(subject)
      |> text_body(body)

    with {:ok, _metadata} <- Mailer.deliver(email) do
      {:ok, email}
    end
  end
end
