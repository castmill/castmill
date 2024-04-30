defmodule Castmill.HookSchemasTest do
  use ExUnit.Case

  describe "validate_hook/2" do
    test "validates known hook with correct arguments" do
      assert Castmill.HookSchemas.validate_hook(:user_signup, %{
               user_id: 1,
               email: "user@example.com"
             }) == :ok
    end

    test "rejects known hook with incorrect arguments" do
      assert Castmill.HookSchemas.validate_hook(:user_signup, %{user_id: 1}) ==
               {:error, :invalid_args}
    end

    test "rejects known hook with extra arguments" do
      assert Castmill.HookSchemas.validate_hook(:user_signup, %{
               user_id: 1,
               email: "user@example.com",
               extra: "value"
             }) == {:error, :invalid_args}
    end

    test "rejects unknown hook" do
      assert Castmill.HookSchemas.validate_hook(:unknown_hook, %{}) == {:error, :invalid_hook}
    end
  end
end
