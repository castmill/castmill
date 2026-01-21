defmodule CastmillWeb.ResourceController.ChannelsTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Teams

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.TeamsFixtures
  import Castmill.ChannelsFixtures
  import Castmill.DevicesFixtures

  @moduletag :e2e

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    team = team_fixture(%{organization_id: organization.id})
    {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :member)

    access_token =
      access_token_fixture(%{secret: "testuser:testpass", user_id: user.id, is_root: true})

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, user: user, organization: organization, team: team}
  end

  describe "list channels" do
    test "lists all channels", %{conn: conn, organization: organization} do
      channel_fixture(%{
        organization_id: organization.id,
        name: "channel1",
        timezone: "Europe/Amsterdam"
      })

      conn = get(conn, "/api/organizations/#{organization.id}/channels")
      response = json_response(conn, 200)

      assert %{"data" => [%{"name" => "channel1"}], "count" => 1} = response
    end

    test "lists channels with pagination", %{conn: conn, organization: organization} do
      for i <- 1..5 do
        channel_fixture(%{
          organization_id: organization.id,
          name: "channel#{i}",
          timezone: "Europe/Amsterdam"
        })
      end

      conn =
        get(conn, "/api/organizations/#{organization.id}/channels", %{page: 1, page_size: 2})

      response = json_response(conn, 200)

      assert %{"data" => [%{"name" => "channel1"}, %{"name" => "channel2"}], "count" => 5} =
               response
    end
  end

  describe "create channels" do
    test "creates a new channel", %{conn: conn, organization: organization} do
      channel_params = %{
        "channel" => %{"name" => "Office Channel", "timezone" => "Europe/Amsterdam"}
      }

      conn = post(conn, "/api/organizations/#{organization.id}/channels", channel_params)
      response = json_response(conn, 201)

      assert %{"data" => %{"name" => "Office Channel"}} = response
    end

    test "fails to create a new channel when data is incomplete", %{
      conn: conn,
      organization: organization
    } do
      incomplete_channel_params = %{"channel" => %{}}

      conn =
        post(conn, "/api/organizations/#{organization.id}/channels", incomplete_channel_params)

      response = json_response(conn, 422)

      assert response["errors"] != nil
    end
  end

  describe "delete channel" do
    test "deletes an existing channel successfully", %{conn: conn, organization: organization} do
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "channel1",
          timezone: "Europe/Amsterdam"
        })

      conn = delete(conn, "/api/organizations/#{organization.id}/channels/#{channel.id}")
      assert response(conn, 204)
    end

    test "fails to delete a non-existent channel", %{conn: conn, organization: organization} do
      conn = delete(conn, "/api/organizations/#{organization.id}/channels/0")
      assert response(conn, 404)
    end

    test "fails to delete a channel assigned to a device", %{
      conn: conn,
      organization: organization
    } do
      # Create a channel
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "Active Channel",
          timezone: "Europe/Amsterdam"
        })

      # Register a device
      {:ok, devices_registration} = device_registration_fixture()

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device"
        })

      # Add the channel to the device
      Castmill.Devices.add_channel(device.id, channel.id)

      # Try to delete the channel - should fail
      conn = delete(conn, "/api/organizations/#{organization.id}/channels/#{channel.id}")
      response = json_response(conn, 409)

      assert response["errors"]["detail"] == "Cannot delete channel that is assigned to devices"
      assert response["errors"]["devices"] == ["Test Device"]
    end
  end

  describe "full channel lifecycle" do
    test "creates and retrieves a new channel from the list", %{
      conn: conn,
      organization: organization
    } do
      channel_params = %{
        "channel" => %{"name" => "Office Channel", "timezone" => "Europe/Amsterdam"}
      }

      conn = post(conn, "/api/organizations/#{organization.id}/channels", channel_params)
      response = json_response(conn, 201)

      assert %{"data" => %{"name" => "Office Channel", "id" => id}} = response

      conn = get(conn, "/api/organizations/#{organization.id}/channels")
      retrieval_response = json_response(conn, 200)

      assert %{"data" => [%{"name" => "Office Channel", "id" => ^id}], "count" => 1} =
               retrieval_response
    end
  end

  describe "update channel default_playlist_id" do
    import Castmill.PlaylistsFixtures

    test "updates channel default_playlist_id and broadcasts to devices", %{
      conn: conn,
      organization: organization
    } do
      # Create a playlist
      playlist = playlist_fixture(%{organization_id: organization.id})

      # Create a channel
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "Test Channel",
          timezone: "Europe/Amsterdam"
        })

      channel_id = channel.id

      # Register a device
      {:ok, devices_registration} = device_registration_fixture()

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device"
        })

      # Add the channel to the device
      Castmill.Devices.add_channel(device.id, channel.id)

      # Subscribe to the device's PubSub topic to verify broadcast
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      # Update the channel's default_playlist_id
      update_params = %{
        "update" => %{"default_playlist_id" => playlist.id}
      }

      conn = put(conn, "/api/organizations/#{organization.id}/channels/#{channel.id}", update_params)
      response = json_response(conn, 200)

      # Verify the update was successful
      assert response["default_playlist_id"] == playlist.id

      # Wait for the async task to broadcast the message
      assert_receive %{
        event: "channel_updated",
        channel_id: ^channel_id,
        default_playlist_id: playlist_id
      }, 1000

      assert playlist_id == playlist.id
    end

    test "does not broadcast when default_playlist_id is not changed", %{
      conn: conn,
      organization: organization
    } do
      # Create a playlist
      playlist = playlist_fixture(%{organization_id: organization.id})

      # Create a channel with the playlist already set
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "Test Channel",
          timezone: "Europe/Amsterdam",
          default_playlist_id: playlist.id
        })

      # Register a device
      {:ok, devices_registration} = device_registration_fixture()

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device"
        })

      # Add the channel to the device
      Castmill.Devices.add_channel(device.id, channel.id)

      # Subscribe to the device's PubSub topic
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      # Update with the same default_playlist_id (no actual change)
      update_params = %{
        "update" => %{"default_playlist_id" => playlist.id}
      }

      conn = put(conn, "/api/organizations/#{organization.id}/channels/#{channel.id}", update_params)
      response = json_response(conn, 200)

      # Verify the update was successful
      assert response["default_playlist_id"] == playlist.id

      # Should NOT receive a broadcast since value didn't change
      refute_receive %{event: "channel_updated", channel_id: _, default_playlist_id: _}, 500
    end

    test "broadcasts when default_playlist_id is changed to a different playlist", %{
      conn: conn,
      organization: organization
    } do
      # Create two playlists
      playlist1 = playlist_fixture(%{organization_id: organization.id, name: "Playlist 1"})
      playlist2 = playlist_fixture(%{organization_id: organization.id, name: "Playlist 2"})

      # Create a channel with playlist1
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "Test Channel",
          timezone: "Europe/Amsterdam",
          default_playlist_id: playlist1.id
        })

      channel_id = channel.id

      # Register a device
      {:ok, devices_registration} = device_registration_fixture()

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device"
        })

      # Add the channel to the device
      Castmill.Devices.add_channel(device.id, channel.id)

      # Subscribe to the device's PubSub topic
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      # Update to playlist2
      update_params = %{
        "update" => %{"default_playlist_id" => playlist2.id}
      }

      conn = put(conn, "/api/organizations/#{organization.id}/channels/#{channel.id}", update_params)
      response = json_response(conn, 200)

      # Verify the update was successful
      assert response["default_playlist_id"] == playlist2.id

      # Should receive a broadcast since value changed
      assert_receive %{
        event: "channel_updated",
        channel_id: ^channel_id,
        default_playlist_id: new_playlist_id
      }, 1000

      assert new_playlist_id == playlist2.id
    end

    test "broadcasts to multiple devices using the same channel", %{
      conn: conn,
      organization: organization
    } do
      # Create a playlist
      playlist = playlist_fixture(%{organization_id: organization.id})

      # Create a channel
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "Test Channel",
          timezone: "Europe/Amsterdam"
        })

      channel_id = channel.id

      # Register two devices
      {:ok, devices_registration1} = device_registration_fixture(%{hardware_id: "device1"})
      {:ok, devices_registration2} = device_registration_fixture(%{hardware_id: "device2"})

      {:ok, {device1, _token1}} =
        Castmill.Devices.register_device(organization.id, devices_registration1.pincode, %{
          name: "Test Device 1"
        })

      {:ok, {device2, _token2}} =
        Castmill.Devices.register_device(organization.id, devices_registration2.pincode, %{
          name: "Test Device 2"
        })

      # Add the channel to both devices
      Castmill.Devices.add_channel(device1.id, channel.id)
      Castmill.Devices.add_channel(device2.id, channel.id)

      # Subscribe to both devices' PubSub topics
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device1.id}")
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device2.id}")

      # Update the channel's default_playlist_id
      update_params = %{
        "update" => %{"default_playlist_id" => playlist.id}
      }

      conn = put(conn, "/api/organizations/#{organization.id}/channels/#{channel.id}", update_params)
      response = json_response(conn, 200)

      # Verify the update was successful
      assert response["default_playlist_id"] == playlist.id

      # Both devices should receive the broadcast
      assert_receive %{
        event: "channel_updated",
        channel_id: ^channel_id,
        default_playlist_id: playlist_id1
      }, 1000

      assert_receive %{
        event: "channel_updated",
        channel_id: ^channel_id,
        default_playlist_id: playlist_id2
      }, 1000

      assert playlist_id1 == playlist.id
      assert playlist_id2 == playlist.id
    end

    test "broadcasts when default_playlist_id is set to nil", %{
      conn: conn,
      organization: organization
    } do
      # Create a playlist
      playlist = playlist_fixture(%{organization_id: organization.id})

      # Create a channel with a playlist
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "Test Channel",
          timezone: "Europe/Amsterdam",
          default_playlist_id: playlist.id
        })

      channel_id = channel.id

      # Register a device
      {:ok, devices_registration} = device_registration_fixture()

      {:ok, {device, _token}} =
        Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Test Device"
        })

      # Add the channel to the device
      Castmill.Devices.add_channel(device.id, channel.id)

      # Subscribe to the device's PubSub topic
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      # Update to nil (removing default playlist)
      update_params = %{
        "update" => %{"default_playlist_id" => nil}
      }

      conn = put(conn, "/api/organizations/#{organization.id}/channels/#{channel.id}", update_params)
      response = json_response(conn, 200)

      # Verify the update was successful
      assert response["default_playlist_id"] == nil

      # Should receive a broadcast since value changed
      assert_receive %{
        event: "channel_updated",
        channel_id: ^channel_id,
        default_playlist_id: nil
      }, 1000
    end
  end
end
