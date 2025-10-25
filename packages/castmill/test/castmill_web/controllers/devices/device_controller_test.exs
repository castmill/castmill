defmodule CastmillWeb.DeviceControllerTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Organizations

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures
  import Castmill.ChannelsFixtures

  @moduletag :e2e
  @moduletag :device_controller

  setup %{conn: conn} do
    # Create network, organization, user
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    # Set user as admin
    :ok = Organizations.set_user_role(organization.id, user.id, "admin")

    # Create an access token for the user
    access_token =
      access_token_fixture(%{
        secret: "testuser:testpass",
        user_id: user.id,
        is_root: false
      })

    # Build an authenticated conn
    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, user: user, organization: organization}
  end

  describe "get_channels as admin" do
    @describetag device_controller: true

    test "admin can get device channels", %{
      conn: conn,
      organization: organization
    } do
      # Create a device registration and register a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id", pincode: "123456"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device"
        })

      # Create a channel and add it to the device
      channel = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      Castmill.Devices.add_channel(device.id, channel.id)

      # Make request to get device channels
      conn = get(conn, "/dashboard/devices/#{device.id}/channels")

      # Should return 200 OK for admin
      assert json_response(conn, 200)
      response = json_response(conn, 200)
      assert Map.has_key?(response, "data")
      assert is_list(response["data"])
      assert length(response["data"]) == 1
    end
  end

  describe "add_channel as admin" do
    @describetag device_controller: true

    test "admin can add channel to device", %{
      conn: conn,
      organization: organization
    } do
      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-2", pincode: "123457"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device 2"
        })

      # Create a channel
      channel = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})

      # Make request to add channel to device
      conn =
        post(conn, "/dashboard/devices/#{device.id}/channels", %{
          "channel_id" => channel.id
        })

      # Should return 200 OK for admin
      assert response(conn, 200)
    end
  end

  describe "remove_channel as admin" do
    @describetag device_controller: true

    test "admin can remove channel from device", %{
      conn: conn,
      organization: organization
    } do
      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-3", pincode: "123458"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device 3"
        })

      # Create two channels and add them to the device (need at least 2 to be able to remove one)
      channel1 = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      channel2 = channel_fixture(%{organization_id: organization.id, timezone: "America/New_York"})
      Castmill.Devices.add_channel(device.id, channel1.id)
      Castmill.Devices.add_channel(device.id, channel2.id)

      # Make request to remove channel from device
      conn = delete(conn, "/dashboard/devices/#{device.id}/channels/#{channel1.id}")

      # Should return 200 OK for admin
      assert json_response(conn, 200)
    end
  end

  describe "authorization for non-admin user" do
    @describetag device_controller: true

    test "member role can view device channels", %{organization: organization} do
      # Create a member user
      member_user = user_fixture(%{organization_id: organization.id, email: "member@test.com"})
      :ok = Organizations.set_user_role(organization.id, member_user.id, "member")

      # Create access token for member
      member_token =
        access_token_fixture(%{
          secret: "member:testpass",
          user_id: member_user.id,
          is_root: false
        })

      # Build authenticated conn for member
      member_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{member_token.secret}")

      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-4", pincode: "123459"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device 4"
        })

      # Create and add a channel
      channel = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      Castmill.Devices.add_channel(device.id, channel.id)

      # Member should be able to view channels (show permission)
      conn = get(member_conn, "/dashboard/devices/#{device.id}/channels")
      assert json_response(conn, 200)

      # Member should be able to update device (add/remove channels)
      channel2 = channel_fixture(%{organization_id: organization.id, timezone: "Europe/London"})
      conn =
        post(member_conn, "/dashboard/devices/#{device.id}/channels", %{
          "channel_id" => channel2.id
        })

      assert response(conn, 200)
    end

    test "guest role cannot modify device channels", %{organization: organization} do
      # Create a guest user
      guest_user = user_fixture(%{organization_id: organization.id, email: "guest@test.com"})
      :ok = Organizations.set_user_role(organization.id, guest_user.id, "guest")

      # Create access token for guest
      guest_token =
        access_token_fixture(%{
          secret: "guest:testpass",
          user_id: guest_user.id,
          is_root: false
        })

      # Build authenticated conn for guest
      guest_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{guest_token.secret}")

      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-5", pincode: "123460"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device 5"
        })

      # Create and add a channel
      channel = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      Castmill.Devices.add_channel(device.id, channel.id)

      # Guest should be able to view channels (show permission)
      conn = get(guest_conn, "/dashboard/devices/#{device.id}/channels")
      assert json_response(conn, 200)

      # Guest should NOT be able to add channels (no update permission)
      channel2 = channel_fixture(%{organization_id: organization.id, timezone: "Europe/London"})
      conn =
        post(guest_conn, "/dashboard/devices/#{device.id}/channels", %{
          "channel_id" => channel2.id
        })

      assert json_response(conn, 403)
    end
  end
end
