defmodule CastmillWeb.RcSocketTest do
  use CastmillWeb.ChannelCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.AccountsFixtures

  describe "connect/3 with user token" do
    test "successfully authenticates user with valid token" do
      # Create test user
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture(%{organization_id: organization.id})

      # Generate a valid token
      token =
        Phoenix.Token.sign(
          CastmillWeb.Endpoint,
          CastmillWeb.Secrets.get_dashboard_user_token_salt(),
          user.id
        )

      # Connect with token
      assert {:ok, socket} = connect(CastmillWeb.RcSocket, %{"token" => token})
      assert socket.assigns.user.id == user.id
    end

    test "rejects connection with invalid token" do
      # Try to connect with invalid token
      assert {:error, %{reason: "unauthorized"}} =
               connect(CastmillWeb.RcSocket, %{"token" => "invalid_token"})
    end

    test "rejects connection with expired token" do
      # Create test user
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture(%{organization_id: organization.id})

      # Generate a token with a backdated timestamp to simulate expiration
      # The token is signed as if it was created 86,401 seconds ago (>24 hours)
      # which exceeds the max_age of 86,400 seconds in authenticate_user
      token =
        Phoenix.Token.sign(
          CastmillWeb.Endpoint,
          CastmillWeb.Secrets.get_dashboard_user_token_salt(),
          user.id,
          signed_at: System.system_time(:second) - 86_401
        )

      # Try to connect with expired token
      assert {:error, %{reason: "unauthorized"}} =
               connect(CastmillWeb.RcSocket, %{"token" => token})
    end

    test "rejects connection with token for non-existent user" do
      # Generate a token for a non-existent user ID
      fake_user_id = Ecto.UUID.generate()

      token =
        Phoenix.Token.sign(
          CastmillWeb.Endpoint,
          CastmillWeb.Secrets.get_dashboard_user_token_salt(),
          fake_user_id
        )

      # Try to connect with token for non-existent user
      assert {:error, %{reason: "unauthorized"}} =
               connect(CastmillWeb.RcSocket, %{"token" => token})
    end
  end

  describe "connect/3 without token (device connections)" do
    test "allows connection without token for device channels" do
      # Device connections don't need token at socket level
      # They authenticate in channel join with device token
      assert {:ok, socket} = connect(CastmillWeb.RcSocket, %{})
      assert is_nil(socket.assigns[:user])
    end
  end
end
