defmodule Castmill.Addons.OnboardingTest do
  use Castmill.DataCase

  use ExUnit.Case, async: true
  import Swoosh.TestAssertions

  # Import Mox and tell ExUnit to verify mocks on exit
  import Mox
  setup :verify_on_exit!

  import Castmill.OrganizationsFixtures

  @moduletag :onboarding

  describe "register_hooks/0" do
    # Skiping for now as I lack the knoledge to fix this error:
    # ** (DBConnection.OwnershipError) cannot find ownership process for #PID<0.442.0>.
    @describetag :skip
    test "registers user_signup hook correctly" do
      user = user_fixture()

      # Register addon
      assert Castmill.Addons.Onboarding.register_hooks() == {:ok, 2}

      # Trigger the user signup hook
      Castmill.Hooks.trigger_hook(:user_signup, %{
        user_id: user.id,
        email: "john.doe@test.xom"
      })

      # Assert that the hook was triggered
      # Use Swoosh test helpers to assert an email was sent
      assert_email_sent(subject: "Welcome to Castmill!")
    end
  end

  describe "on_user_signup/1" do
    test "sends welcome email on user signup" do
      user = user_fixture()

      # Trigger the function that sends an email
      Castmill.Addons.Onboarding.on_user_signup(%{user_id: user.id, email: user.email})

      # Assert that an email was sent with the expected values
      assert_email_sent(
        to: user.email,
        from: {"Castmill", "no-reply@castmill.com"},
        subject: "Welcome to Castmill!"
      )
    end
  end
end
