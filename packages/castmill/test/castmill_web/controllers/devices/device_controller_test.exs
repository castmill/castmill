defmodule CastmillWeb.DeviceControllerTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Organizations

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures
  import Castmill.ChannelsFixtures
  import Castmill.PlaylistsFixtures

  @moduletag :e2e
  @moduletag :device_controller

  setup %{conn: conn} do
    # Create network, organization, user
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    # Set user as admin
    {:ok, _} = Organizations.set_user_role(organization.id, user.id, :admin)

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

      channel2 =
        channel_fixture(%{organization_id: organization.id, timezone: "America/New_York"})

      Castmill.Devices.add_channel(device.id, channel1.id)
      Castmill.Devices.add_channel(device.id, channel2.id)

      # Make request to remove channel from device
      conn = delete(conn, "/dashboard/devices/#{device.id}/channels/#{channel1.id}")

      # Should return 200 OK for admin
      assert json_response(conn, 200)
    end
  end

  describe "manager role authorization" do
    @describetag device_controller: true

    test "manager can view and manage device channels", %{organization: organization} do
      # Create a manager user
      manager_user = user_fixture(%{organization_id: organization.id, email: "manager@test.com"})
      {:ok, _} = Organizations.set_user_role(organization.id, manager_user.id, :manager)

      # Create access token for manager
      manager_token =
        access_token_fixture(%{
          secret: "manager:testpass",
          user_id: manager_user.id,
          is_root: false
        })

      # Build authenticated conn for manager
      manager_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{manager_token.secret}")

      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-mgr-1", pincode: "123461"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device Manager"
        })

      # Create channels
      channel1 = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      channel2 = channel_fixture(%{organization_id: organization.id, timezone: "Europe/London"})
      Castmill.Devices.add_channel(device.id, channel1.id)

      # Manager should be able to view channels (show permission)
      conn = get(manager_conn, "/dashboard/devices/#{device.id}/channels")
      assert json_response(conn, 200)

      # Manager should be able to add channels (update permission)
      conn =
        post(manager_conn, "/dashboard/devices/#{device.id}/channels", %{
          "channel_id" => channel2.id
        })

      assert response(conn, 200)

      # Manager should be able to remove channels (update permission)
      conn = delete(manager_conn, "/dashboard/devices/#{device.id}/channels/#{channel1.id}")
      assert json_response(conn, 200)
    end
  end

  describe "member role authorization" do
    @describetag device_controller: true

    test "member can view and manage device channels", %{organization: organization} do
      # Create a member user
      member_user = user_fixture(%{organization_id: organization.id, email: "member@test.com"})
      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)

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

      # Create channels
      channel1 = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      channel2 = channel_fixture(%{organization_id: organization.id, timezone: "Europe/London"})
      Castmill.Devices.add_channel(device.id, channel1.id)

      # Member should be able to view channels (show permission)
      conn = get(member_conn, "/dashboard/devices/#{device.id}/channels")
      assert json_response(conn, 200)

      # Member should be able to add channels (update permission)
      conn =
        post(member_conn, "/dashboard/devices/#{device.id}/channels", %{
          "channel_id" => channel2.id
        })

      assert response(conn, 200)

      # Member should be able to remove channels (update permission)
      conn = delete(member_conn, "/dashboard/devices/#{device.id}/channels/#{channel1.id}")
      assert json_response(conn, 200)
    end
  end

  describe "device_manager role authorization" do
    @describetag device_controller: true

    test "device_manager can view and manage device channels", %{organization: organization} do
      # Create a device_manager user
      device_mgr_user =
        user_fixture(%{organization_id: organization.id, email: "device_mgr@test.com"})

      {:ok, _} =
        Organizations.set_user_role(organization.id, device_mgr_user.id, :device_manager)

      # Create access token for device_manager
      device_mgr_token =
        access_token_fixture(%{
          secret: "device_mgr:testpass",
          user_id: device_mgr_user.id,
          is_root: false
        })

      # Build authenticated conn for device_manager
      device_mgr_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{device_mgr_token.secret}")

      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-dm-1", pincode: "123462"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device DM"
        })

      # Create channels
      channel1 = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      channel2 = channel_fixture(%{organization_id: organization.id, timezone: "Europe/London"})
      Castmill.Devices.add_channel(device.id, channel1.id)

      # Device Manager should be able to view channels (show permission)
      conn = get(device_mgr_conn, "/dashboard/devices/#{device.id}/channels")
      assert json_response(conn, 200)

      # Device Manager should be able to add channels (update permission)
      conn =
        post(device_mgr_conn, "/dashboard/devices/#{device.id}/channels", %{
          "channel_id" => channel2.id
        })

      assert response(conn, 200)

      # Device Manager should be able to remove channels (update permission)
      conn = delete(device_mgr_conn, "/dashboard/devices/#{device.id}/channels/#{channel1.id}")
      assert json_response(conn, 200)
    end
  end

  describe "editor role authorization" do
    @describetag device_controller: true

    test "editor can view but not modify device channels", %{organization: organization} do
      # Create an editor user
      editor_user = user_fixture(%{organization_id: organization.id, email: "editor@test.com"})
      {:ok, _} = Organizations.set_user_role(organization.id, editor_user.id, :editor)

      # Create access token for editor
      editor_token =
        access_token_fixture(%{
          secret: "editor:testpass",
          user_id: editor_user.id,
          is_root: false
        })

      # Build authenticated conn for editor
      editor_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{editor_token.secret}")

      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-editor-1", pincode: "123463"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device Editor"
        })

      # Create channels
      channel1 = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      channel2 = channel_fixture(%{organization_id: organization.id, timezone: "Europe/London"})
      Castmill.Devices.add_channel(device.id, channel1.id)
      Castmill.Devices.add_channel(device.id, channel2.id)

      # Editor should be able to view channels (show permission)
      conn = get(editor_conn, "/dashboard/devices/#{device.id}/channels")
      assert json_response(conn, 200)

      # Editor should NOT be able to add channels (no update permission)
      channel3 = channel_fixture(%{organization_id: organization.id, timezone: "Asia/Tokyo"})

      conn =
        post(editor_conn, "/dashboard/devices/#{device.id}/channels", %{
          "channel_id" => channel3.id
        })

      assert json_response(conn, 403)

      # Editor should NOT be able to remove channels (no update permission)
      conn = delete(editor_conn, "/dashboard/devices/#{device.id}/channels/#{channel1.id}")
      assert json_response(conn, 403)
    end
  end

  describe "publisher role authorization" do
    @describetag device_controller: true

    test "publisher can view but not modify device channels", %{organization: organization} do
      # Create a publisher user
      publisher_user =
        user_fixture(%{organization_id: organization.id, email: "publisher@test.com"})

      {:ok, _} = Organizations.set_user_role(organization.id, publisher_user.id, :publisher)

      # Create access token for publisher
      publisher_token =
        access_token_fixture(%{
          secret: "publisher:testpass",
          user_id: publisher_user.id,
          is_root: false
        })

      # Build authenticated conn for publisher
      publisher_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{publisher_token.secret}")

      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-pub-1", pincode: "123464"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device Publisher"
        })

      # Create channels
      channel1 = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      channel2 = channel_fixture(%{organization_id: organization.id, timezone: "Europe/London"})
      Castmill.Devices.add_channel(device.id, channel1.id)
      Castmill.Devices.add_channel(device.id, channel2.id)

      # Publisher should be able to view channels (show permission)
      conn = get(publisher_conn, "/dashboard/devices/#{device.id}/channels")
      assert json_response(conn, 200)

      # Publisher should NOT be able to add channels (no update permission)
      channel3 = channel_fixture(%{organization_id: organization.id, timezone: "Asia/Tokyo"})

      conn =
        post(publisher_conn, "/dashboard/devices/#{device.id}/channels", %{
          "channel_id" => channel3.id
        })

      assert json_response(conn, 403)

      # Publisher should NOT be able to remove channels (no update permission)
      conn = delete(publisher_conn, "/dashboard/devices/#{device.id}/channels/#{channel1.id}")
      assert json_response(conn, 403)
    end
  end

  describe "guest role authorization" do
    @describetag device_controller: true

    test "guest can view but not modify device channels", %{organization: organization} do
      # Create a guest user
      guest_user = user_fixture(%{organization_id: organization.id, email: "guest@test.com"})
      {:ok, _} = Organizations.set_user_role(organization.id, guest_user.id, :guest)

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

      # Create channels
      channel1 = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})
      channel2 = channel_fixture(%{organization_id: organization.id, timezone: "Europe/London"})
      Castmill.Devices.add_channel(device.id, channel1.id)
      Castmill.Devices.add_channel(device.id, channel2.id)

      # Guest should be able to view channels (show permission)
      conn = get(guest_conn, "/dashboard/devices/#{device.id}/channels")
      assert json_response(conn, 200)

      # Guest should NOT be able to add channels (no update permission)
      channel3 = channel_fixture(%{organization_id: organization.id, timezone: "Asia/Tokyo"})

      conn =
        post(guest_conn, "/dashboard/devices/#{device.id}/channels", %{
          "channel_id" => channel3.id
        })

      assert json_response(conn, 403)

      # Guest should NOT be able to remove channels (no update permission)
      conn = delete(guest_conn, "/dashboard/devices/#{device.id}/channels/#{channel1.id}")
      assert json_response(conn, 403)
    end
  end

  describe "list_events authorization" do
    @describetag device_controller: true

    test "admin can list device events", %{conn: conn, organization: organization} do
      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-events-1", pincode: "123465"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device Events"
        })

      # Make request to list device events
      conn = get(conn, "/dashboard/devices/#{device.id}/events")

      # Should return 200 OK for admin
      response = json_response(conn, 200)
      assert Map.has_key?(response, "data")
      assert is_list(response["data"])
    end

    test "manager can list device events", %{organization: organization} do
      # Create a manager user
      manager_user = user_fixture(%{organization_id: organization.id, email: "manager-events@test.com"})
      {:ok, _} = Organizations.set_user_role(organization.id, manager_user.id, :manager)

      # Create access token for manager
      manager_token =
        access_token_fixture(%{
          secret: "manager-events:testpass",
          user_id: manager_user.id,
          is_root: false
        })

      # Build authenticated conn for manager
      manager_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{manager_token.secret}")

      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "test-hw-id-events-2", pincode: "123466"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device Events Manager"
        })

      # Manager should be able to list events (show permission)
      conn = get(manager_conn, "/dashboard/devices/#{device.id}/events")
      assert json_response(conn, 200)
    end

    test "member can list device events", %{organization: organization} do
      # Create a member user
      member_user = user_fixture(%{organization_id: organization.id, email: "member-events@test.com"})
      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)

      # Create access token for member
      member_token =
        access_token_fixture(%{
          secret: "member-events:testpass",
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
        device_registration_fixture(%{hardware_id: "test-hw-id-events-3", pincode: "123467"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device Events Member"
        })

      # Member should be able to list events (show permission)
      conn = get(member_conn, "/dashboard/devices/#{device.id}/events")
      assert json_response(conn, 200)
    end

    test "guest can list device events", %{organization: organization} do
      # Create a guest user
      guest_user = user_fixture(%{organization_id: organization.id, email: "guest-events@test.com"})
      {:ok, _} = Organizations.set_user_role(organization.id, guest_user.id, :guest)

      # Create access token for guest
      guest_token =
        access_token_fixture(%{
          secret: "guest-events:testpass",
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
        device_registration_fixture(%{hardware_id: "test-hw-id-events-4", pincode: "123468"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device Events Guest"
        })

      # Guest should be able to list events (show permission)
      conn = get(guest_conn, "/dashboard/devices/#{device.id}/events")
      assert json_response(conn, 200)
    end
  end

  describe "get_playlist authorization (device preview)" do
    @describetag device_controller: true

    test "admin can get playlist assigned to device via channel entry", %{
      conn: conn,
      organization: organization
    } do
      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "preview-hw-1", pincode: "preview1"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Preview Test Device"
        })

      # Create a playlist and channel
      playlist = playlist_fixture(%{organization_id: organization.id, name: "Test Playlist"})
      channel = channel_fixture(%{organization_id: organization.id, timezone: "UTC"})

      # Add playlist to channel via channel entry
      entry_attrs = %{
        "name" => "scheduled entry",
        "start" => DateTime.to_unix(~U[2025-01-01 10:00:00Z]),
        "end" => DateTime.to_unix(~U[2025-12-31 23:59:59Z]),
        "playlist_id" => playlist.id
      }

      {:ok, _entry} = Castmill.Resources.add_channel_entry(channel.id, entry_attrs)

      # Assign channel to device
      Castmill.Devices.add_channel(device.id, channel.id)

      # Admin should be able to get the playlist
      conn = get(conn, "/dashboard/devices/#{device.id}/playlists/#{playlist.id}")
      assert json_response(conn, 200)
      response = json_response(conn, 200)
      assert response["name"] == "Test Playlist"
    end

    test "admin can get default playlist assigned to device", %{
      conn: conn,
      organization: organization
    } do
      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "preview-hw-2", pincode: "preview2"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Preview Test Device 2"
        })

      # Create a playlist
      playlist = playlist_fixture(%{organization_id: organization.id, name: "Default Playlist"})

      # Create a channel with default playlist
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          timezone: "UTC",
          default_playlist_id: playlist.id
        })

      # Assign channel to device
      Castmill.Devices.add_channel(device.id, channel.id)

      # Admin should be able to get the playlist
      conn = get(conn, "/dashboard/devices/#{device.id}/playlists/#{playlist.id}")
      assert json_response(conn, 200)
      response = json_response(conn, 200)
      assert response["name"] == "Default Playlist"
    end

    test "manager can get playlist assigned to device", %{organization: organization} do
      # Create a manager user
      manager_user =
        user_fixture(%{organization_id: organization.id, email: "manager-preview@test.com"})

      {:ok, _} = Organizations.set_user_role(organization.id, manager_user.id, :manager)

      # Create access token for manager
      manager_token =
        access_token_fixture(%{
          secret: "manager-preview:testpass",
          user_id: manager_user.id,
          is_root: false
        })

      # Build authenticated conn for manager
      manager_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{manager_token.secret}")

      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "preview-hw-3", pincode: "preview3"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Preview Test Device 3"
        })

      # Create playlist and channel
      playlist =
        playlist_fixture(%{organization_id: organization.id, name: "Manager Test Playlist"})

      channel =
        channel_fixture(%{
          organization_id: organization.id,
          timezone: "UTC",
          default_playlist_id: playlist.id
        })

      Castmill.Devices.add_channel(device.id, channel.id)

      # Manager should be able to get the playlist
      conn = get(manager_conn, "/dashboard/devices/#{device.id}/playlists/#{playlist.id}")
      assert json_response(conn, 200)
    end

    test "member can get playlist assigned to device", %{organization: organization} do
      # Create a member user
      member_user =
        user_fixture(%{organization_id: organization.id, email: "member-preview@test.com"})

      {:ok, _} = Organizations.set_user_role(organization.id, member_user.id, :member)

      # Create access token for member
      member_token =
        access_token_fixture(%{
          secret: "member-preview:testpass",
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
        device_registration_fixture(%{hardware_id: "preview-hw-4", pincode: "preview4"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Preview Test Device 4"
        })

      # Create playlist and channel
      playlist = playlist_fixture(%{organization_id: organization.id, name: "Member Test Playlist"})

      channel =
        channel_fixture(%{
          organization_id: organization.id,
          timezone: "UTC",
          default_playlist_id: playlist.id
        })

      Castmill.Devices.add_channel(device.id, channel.id)

      # Member should be able to get the playlist
      conn = get(member_conn, "/dashboard/devices/#{device.id}/playlists/#{playlist.id}")
      assert json_response(conn, 200)
    end

    test "guest can get playlist assigned to device", %{organization: organization} do
      # Create a guest user
      guest_user = user_fixture(%{organization_id: organization.id, email: "guest-preview@test.com"})
      {:ok, _} = Organizations.set_user_role(organization.id, guest_user.id, :guest)

      # Create access token for guest
      guest_token =
        access_token_fixture(%{
          secret: "guest-preview:testpass",
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
        device_registration_fixture(%{hardware_id: "preview-hw-5", pincode: "preview5"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Preview Test Device 5"
        })

      # Create playlist and channel
      playlist = playlist_fixture(%{organization_id: organization.id, name: "Guest Test Playlist"})

      channel =
        channel_fixture(%{
          organization_id: organization.id,
          timezone: "UTC",
          default_playlist_id: playlist.id
        })

      Castmill.Devices.add_channel(device.id, channel.id)

      # Guest should be able to get the playlist
      conn = get(guest_conn, "/dashboard/devices/#{device.id}/playlists/#{playlist.id}")
      assert json_response(conn, 200)
    end

    test "editor cannot get playlist assigned to device", %{organization: organization} do
      # Create an editor user
      editor_user = user_fixture(%{organization_id: organization.id, email: "editor-preview@test.com"})
      {:ok, _} = Organizations.set_user_role(organization.id, editor_user.id, :editor)

      # Create access token for editor
      editor_token =
        access_token_fixture(%{
          secret: "editor-preview:testpass",
          user_id: editor_user.id,
          is_root: false
        })

      # Build authenticated conn for editor
      editor_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{editor_token.secret}")

      # Create a device
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "preview-hw-6", pincode: "preview6"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Preview Test Device 6"
        })

      # Create playlist and channel
      playlist = playlist_fixture(%{organization_id: organization.id, name: "Editor Test Playlist"})

      channel =
        channel_fixture(%{
          organization_id: organization.id,
          timezone: "UTC",
          default_playlist_id: playlist.id
        })

      Castmill.Devices.add_channel(device.id, channel.id)

      # Editor should NOT be able to get the playlist (no show permission on devices)
      conn = get(editor_conn, "/dashboard/devices/#{device.id}/playlists/#{playlist.id}")
      assert json_response(conn, 403)
    end

    test "user from different organization cannot access device playlist", %{
      organization: _organization
    } do
      # Create first organization setup
      network1 = network_fixture(%{name: "Network 1"})
      organization1 = organization_fixture(%{network_id: network1.id, name: "Org 1"})

      # Create second organization with user
      network2 = network_fixture(%{name: "Network 2"})
      organization2 = organization_fixture(%{network_id: network2.id, name: "Org 2"})
      other_user = user_fixture(%{organization_id: organization2.id, email: "other@test.com"})
      {:ok, _} = Organizations.set_user_role(organization2.id, other_user.id, :admin)

      other_token =
        access_token_fixture(%{
          secret: "other:testpass",
          user_id: other_user.id,
          is_root: false
        })

      other_conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> put_req_header("authorization", "Bearer #{other_token.secret}")

      # Create device in first organization
      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "preview-hw-7", pincode: "preview7"})

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization1.id, devices_registration.pincode, %{
          name: "Org1 Device"
        })

      # Create playlist in first organization
      playlist = playlist_fixture(%{organization_id: organization1.id, name: "Org1 Playlist"})

      channel =
        channel_fixture(%{
          organization_id: organization1.id,
          timezone: "UTC",
          default_playlist_id: playlist.id
        })

      Castmill.Devices.add_channel(device.id, channel.id)

      # User from other organization should NOT be able to access
      conn = get(other_conn, "/dashboard/devices/#{device.id}/playlists/#{playlist.id}")
      assert json_response(conn, 403)
    end
  end
end
