defmodule Castmill.Addons.Onboarding do
  use Castmill.Addons.Addon
  require Logger

  import Swoosh.Email
  alias Castmill.EmailBrand
  alias Castmill.EmailDelivery
  alias Castmill.EmailLayout

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
      {html, text} = EmailLayout.render(brand, welcome(user, brand))

      new()
      |> to(email)
      |> EmailBrand.put_sender(brand)
      |> subject("Welcome to #{brand.name}")
      |> text_body(text)
      |> html_body(html)
      |> EmailDelivery.deliver(context: "onboarding.welcome")
    end
  end

  @doc false
  # The welcome email's content, in Castmill.EmailLayout blocks.
  def welcome(user, brand) do
    greeting =
      case user.name && String.trim(user.name) do
        name when is_binary(name) and name != "" and name != user.email -> "Welcome, #{name}"
        _ -> "Welcome to #{brand.name}"
      end

    button =
      if brand.dashboard_url,
        do: [{:button, "Open your dashboard", brand.dashboard_url}],
        else: []

    [
      subject: "Welcome to #{brand.name}",
      preheader: "Your account is ready. Here's how to get your first screen running.",
      blocks:
        [
          {:heading, greeting},
          {:text,
           [
             "Your ",
             {:strong, brand.name},
             " account is ready. Here's how to get your first screen showing your content:"
           ]},
          {:steps,
           [
             {"Register a screen",
              "Open the player on your screen. In the dashboard, go to Devices, choose Register device and enter the pincode the screen shows."},
             {"Add your content", "Upload images and videos in Content > Medias."},
             {"Build a playlist", "Arrange your media and widgets in Content > Playlists."},
             {"Show it on your screen",
              "Each registered screen gets its own channel. In Channels, open your screen's channel and choose your playlist as its default playlist, or schedule it on the calendar."}
           ]}
        ] ++ button
    ]
  end
end
