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
    {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :regular)

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
end
