defmodule CastmillWeb.ResourceController.DevicesTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Teams

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.TeamsFixtures
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

  describe "create devices" do
    @valid_pincode "DEADBEEF"
    @invalid_pincode "INVALID"

    test "registers a new device", %{conn: conn, organization: organization} do
      device_registration_fixture(%{hardware_id: "some hardware id", pincode: "DEADBEEF"})

      device_params = %{
        "name" => "new_device",
        "pincode" => @valid_pincode
      }

      conn = post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      response = json_response(conn, 201)

      assert %{
               "data" => %{
                 "name" => "new_device"
               }
             } = response
    end

    test "registers a new device with an api-requested pincode", %{
      conn: conn,
      organization: organization
    } do
      registration_params = %{
        "hardware_id" => "some hardware id",
        "location" => %{
          "latitude" => 55.7298126,
          "longitude" => 13.2001097
        },
        "timezone" => "Europe/Stocholm"
      }

      conn =
        conn
        |> put_req_header("user-agent", "some user agent")
        |> post("/registrations", registration_params)

      %{
        "data" => %{
          "pincode" => pincode
        }
      } = json_response(conn, 201)

      device_params = %{
        "name" => "new_device",
        "pincode" => pincode
      }

      conn = post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      response = json_response(conn, 201)

      assert %{
               "data" => %{
                 "name" => "new_device"
               }
             } = response
    end

    test "fails to register a device with invalid pincode", %{
      conn: conn,
      organization: organization
    } do
      device_params = %{
        "name" => "new_device",
        "pincode" => @invalid_pincode
      }

      conn = post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      response = json_response(conn, 422)

      assert %{"errors" => %{"pincode" => ["Invalid pincode"]}} = response
    end

    test "fails to register a device with expired pincode", %{
      conn: conn,
      organization: organization
    } do
      # Create a device registration with an expired pincode
      {:ok, expired_registration} =
        device_registration_fixture(%{
          hardware_id: "expired_hardware",
          pincode: "EXPIRED1"
        })

      # Update the registration to set expires_at to the past
      # Use DateTime.truncate to remove microseconds for :utc_datetime fields
      expired_datetime =
        DateTime.utc_now()
        |> DateTime.add(-3600, :second)
        |> DateTime.truncate(:second)

      Castmill.Repo.update!(
        Ecto.Changeset.change(expired_registration, %{
          expires_at: expired_datetime
        })
      )

      device_params = %{
        "name" => "expired_device",
        "pincode" => "EXPIRED1"
      }

      conn = post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      response = json_response(conn, 422)

      assert %{"errors" => %{"pincode" => ["Pincode has expired"]}} = response
    end

    test "registers a device with case-insensitive pincode (lowercase)", %{
      conn: conn,
      organization: organization
    } do
      device_registration_fixture(%{hardware_id: "hardware_lowercase", pincode: "DEADBEEF"})

      device_params = %{
        "name" => "device_lowercase",
        "pincode" => "deadbeef"
      }

      conn = post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      response = json_response(conn, 201)

      assert %{
               "data" => %{
                 "name" => "device_lowercase"
               }
             } = response
    end

    test "registers a device with case-insensitive pincode (mixed case)", %{
      conn: conn,
      organization: organization
    } do
      device_registration_fixture(%{hardware_id: "hardware_mixed", pincode: "DEADBEEF"})

      device_params = %{
        "name" => "device_mixed",
        "pincode" => "DeAdBeEf"
      }

      conn = post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      response = json_response(conn, 201)

      assert %{
               "data" => %{
                 "name" => "device_mixed"
               }
             } = response
    end

    test "fails to register a new device with missing parameters", %{
      conn: conn,
      organization: organization
    } do
      device_params = %{
        "name" => "new_device"
        # pincode is missing in this test
      }

      conn = post(conn, "/api/organizations/#{organization.id}/devices", device_params)

      assert json_response(conn, 400)
    end
  end

  describe "list devices" do
    test "lists all devices", %{conn: conn, organization: organization} do
      device_registration_fixture(%{hardware_id: "some hardware id", pincode: @valid_pincode})

      device_params = %{
        "name" => "device1",
        "pincode" => @valid_pincode
      }

      conn = post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      response = json_response(conn, 201)

      assert %{
               "data" => %{
                 "name" => "device1"
               }
             } = response

      conn = get(conn, "/api/organizations/#{organization.id}/devices")
      response = json_response(conn, 200)

      assert %{
               "data" => [
                 %{
                   "name" => "device1"
                 }
               ],
               "count" => 1
             } = response
    end

    test "lists devices with pagination", %{conn: conn, organization: organization} do
      # Create some devices
      for i <- 1..5 do
        device_registration_fixture(%{hardware_id: "hardware#{i}", pincode: "DEADBEEF#{i}"})
        device_params = %{"name" => "device#{i}", "pincode" => "DEADBEEF#{i}"}
        post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      end

      # Request the first page with 2 items per page
      conn = get(conn, "/api/organizations/#{organization.id}/devices", %{page: 1, page_size: 2})
      response = json_response(conn, 200)

      # Assert the first page contains the first 2 items
      assert %{
               "data" => [
                 %{"name" => "device1"},
                 %{"name" => "device2"}
               ],
               "count" => 5
             } = response

      # Request the second page
      conn = get(conn, "/api/organizations/#{organization.id}/devices", %{page: 2, page_size: 2})
      response = json_response(conn, 200)

      # Assert the second page contains the next 2 items
      assert %{
               "data" => [
                 %{"name" => "device3"},
                 %{"name" => "device4"}
               ],
               "count" => 5
             } = response
    end

    test "searches devices by name", %{conn: conn, organization: organization} do
      # Create some devices
      for i <- 1..2 do
        device_registration_fixture(%{hardware_id: "hardware#{i}", pincode: "DEADBEEF#{i}"})
        device_params = %{"name" => "device#{i}", "pincode" => "DEADBEEF#{i}"}
        post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      end

      # Search for devices with the term "device1"
      conn = get(conn, "/api/organizations/#{organization.id}/devices", %{search: "device1"})
      response = json_response(conn, 200)

      # Assert only the "device1" is returned
      assert %{"data" => [%{"name" => "device1"}], "count" => 1} = response
    end

    test "searches devices by name and applies pagination", %{
      conn: conn,
      organization: organization
    } do
      # Create several devices to test pagination
      for i <- 1..10 do
        padded_i = String.pad_leading("#{i}", 2, "0")

        device_registration_fixture(%{
          hardware_id: "hardware#{padded_i}",
          pincode: "DEADBEEF#{padded_i}"
        })

        device_params = %{"name" => "device#{padded_i}", "pincode" => "DEADBEEF#{padded_i}"}
        post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      end

      # Create a few other devices that won't match the search term to test search
      for i <- 11..15 do
        padded_i = String.pad_leading("#{i}", 2, "0")

        device_registration_fixture(%{
          hardware_id: "other_hardware#{padded_i}",
          pincode: "BEEFDEAD#{padded_i}"
        })

        device_params = %{"name" => "other#{padded_i}", "pincode" => "BEEFDEAD#{padded_i}"}
        post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      end

      # Search for devices with the term "device", but only get the first 5 results (first page)
      conn =
        get(conn, "/api/organizations/#{organization.id}/devices", %{
          search: "device",
          page: 1,
          page_size: 5
        })

      response = json_response(conn, 200)

      # Assert the first page contains the first 5 devices
      assert %{
               "data" => [
                 %{"name" => "device01"},
                 %{"name" => "device02"},
                 %{"name" => "device03"},
                 %{"name" => "device04"},
                 %{"name" => "device05"}
               ],
               # Total count of devices matching the search term
               "count" => 10
             } = response

      # Now, request the second page of the search results
      conn =
        get(conn, "/api/organizations/#{organization.id}/devices", %{
          search: "device",
          page: 2,
          page_size: 5
        })

      response = json_response(conn, 200)

      # Assert the second page contains the next set of devices
      assert %{
               "data" => [
                 %{"name" => "device06"},
                 %{"name" => "device07"},
                 %{"name" => "device08"},
                 %{"name" => "device09"},
                 %{"name" => "device10"}
               ],
               # Total count of devices matching the search term remains the same
               "count" => 10
             } = response
    end
  end

  describe "delete device" do
    test "deletes an existing device successfully", %{conn: conn, organization: organization} do
      # Create a device using a POST request
      device_registration_fixture(%{hardware_id: "hardware1", pincode: "DEADBEEF1"})
      device_params = %{"name" => "device1", "pincode" => "DEADBEEF1"}

      post_device_response =
        post(conn, "/api/organizations/#{organization.id}/devices", device_params)

      created_device = json_response(post_device_response, 201)

      # Deleting the device
      conn =
        delete(
          conn,
          "/api/organizations/#{organization.id}/devices/#{created_device["data"]["id"]}"
        )

      assert response(conn, 204)

      # Verifying the device is deleted by checking if it's still in the list
      conn = get(conn, "/api/organizations/#{organization.id}/devices")
      response = json_response(conn, 200)

      assert %{"count" => 0} = response
    end

    test "fails to delete a non-existent device", %{conn: conn, organization: organization} do
      # Attempting to delete a device with an invalid ID
      conn = delete(conn, "/api/organizations/#{organization.id}/devices/0")
      assert response(conn, 404)

      # Verifying the response message
      response = json_response(conn, 404)
      assert %{"errors" => ["Device not found"]} = response
    end
  end

  describe "full lifecycle of a device" do
    test "create, list, and delete a device", %{conn: conn, organization: organization} do
      # Registering a new device
      hardware_id = "lifecycle_hardware_id"
      pincode = "LIFEDEAD"
      device_registration_fixture(%{hardware_id: hardware_id, pincode: pincode})
      device_params = %{"name" => "lifecycle_device", "pincode" => pincode}

      conn = post(conn, "/api/organizations/#{organization.id}/devices", device_params)
      response = json_response(conn, 201)
      created_device_id = response["data"]["id"]

      assert %{
               "data" => %{
                 "name" => "lifecycle_device"
               }
             } = response

      # Listing devices to ensure the device exists
      conn = get(conn, "/api/organizations/#{organization.id}/devices")
      list_response = json_response(conn, 200)
      assert %{"count" => 1} = list_response
      assert Enum.any?(list_response["data"], fn device -> device["id"] == created_device_id end)

      # Deleting the device
      conn = delete(conn, "/api/organizations/#{organization.id}/devices/#{created_device_id}")
      assert response(conn, 204)

      # Listing devices again to ensure the device was deleted
      conn = get(conn, "/api/organizations/#{organization.id}/devices")
      final_list_response = json_response(conn, 200)
      assert %{"count" => 0} = final_list_response
    end
  end
end
