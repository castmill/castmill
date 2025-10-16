defmodule Castmill.HooksTest do
  use Castmill.DataCase

  alias Castmill.Hooks

  import Castmill.OrganizationsFixtures

  @moduletag :hooks

  describe "register_hook/2" do
    test "registers a hook and returns an ID" do
      assert {:ok, _id} =
               Hooks.register_hook(:user_signup, fn %{user_id: _, email: _} -> :ok end)
    end
  end

  describe "unregister_hook/2" do
    test "unregisters a previously registered hook" do
      {:ok, id} = Hooks.register_hook(:user_signup, fn %{user_id: _, email: _} -> :ok end)
      assert :ok = Hooks.unregister_hook(:user_signup, id)
    end
  end

  describe "trigger_hook/2" do
    @describetag :skip

    test "triggers a registered hook" do
      # Allow the Hooks GenServer to access the test database
      Ecto.Adapters.SQL.Sandbox.allow(Castmill.Repo, self(), Process.whereis(Castmill.Hooks))

      # Adjusted test_args to match the expected schema for :user_signup
      user = user_fixture()
      test_args = %{user_id: user.id, email: user.email}

      send_self = self()

      Hooks.register_hook(:user_signup, fn args ->
        send(send_self, {:hook_called, args})
      end)

      Hooks.trigger_hook(:user_signup, test_args)
      assert_receive {:hook_called, ^test_args}
    end
  end
end
