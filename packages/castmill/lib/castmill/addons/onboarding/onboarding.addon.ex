defmodule Castmill.Addons.Onboarding do
  use Castmill.Addons.Addon
  require Logger

  import Swoosh.Email
  alias Castmill.EmailBrand
  alias Castmill.EmailDelivery

  @impl Castmill.Addons.AddonBehaviour
  def register_hooks() do
    IO.puts("[info] Registering onboarding hooks")
    Castmill.Hooks.register_hook(:user_signup, &__MODULE__.on_user_signup/1)
  end

  @doc """
    Send an onborading email to the user, eventually schedule another email
    to be sent in 3 days.
  """
  def on_user_signup(%{user_id: user_id, email: email} = event) do
    # Welcome the user as the network they signed up to.
    brand = EmailBrand.for_network(Map.get(event, :network_id))
    _result = welcome_email(user_id, email, brand)
    # Schedule another email to be sent in 3 days
    # Castmill.Scheduler.schedule_in(3 * 24 * 60 * 60, &reminder_email/1, [user_id])
  end

  defp welcome_email(user_id, email, brand) do
    user = Castmill.Accounts.get_user(user_id)

    if user == nil do
      Logger.error("User not found for id #{user_id}")
    else
      subject = "Welcome to #{brand.name}!"

      body = """
      Hello #{user.name || ""}

      Welcome to #{brand.name}! We're excited to have you on board.
      """

      deliver(email, subject, body, brand)
    end
  end

  # Delivers the email using the application mailer.
  defp deliver(recipient, subject, body, brand) do
    email =
      new()
      |> to(recipient)
      |> EmailBrand.put_sender(brand)
      |> subject(subject)
      |> text_body(body)

    EmailDelivery.deliver(email, context: "onboarding.welcome")
  end
end
