defmodule Castmill.Notifications.ActorTest do
  @moduledoc """
  Notifications name the user who performed the action (#625).
  """
  use Castmill.DataCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  alias Castmill.{Devices, Notifications, Organizations}
  alias Castmill.Notifications.{Events, Notification}

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    admin = user_fixture(%{name: "Ana Admin", network_id: network.id})
    {:ok, _} = Organizations.add_user(organization.id, admin.id, :admin)

    %{network: network, organization: organization, admin: admin}
  end

  defp latest(type) do
    Repo.one!(
      from n in Notification,
        where: n.type == ^type,
        order_by: [desc: n.inserted_at, desc: n.id],
        limit: 1
    )
  end

  describe "put_actor_names/1" do
    test "names user actors with one query, current names and missing users", %{admin: admin} do
      notifications = [
        %Notification{actor_type: "user", actor_id: admin.id},
        %Notification{actor_type: "user", actor_id: Ecto.UUID.generate()},
        %Notification{actor_type: "user", actor_id: "not-a-uuid"},
        %Notification{actor_type: "device", actor_id: Ecto.UUID.generate()},
        %Notification{actor_type: "system"}
      ]

      assert Enum.map(Notifications.put_actor_names(notifications), & &1.actor_name) ==
               ["Ana Admin", nil, nil, nil, nil]

      {:ok, _} = Castmill.Accounts.update_user(admin, %{name: "Ana Renamed"})

      assert [%{actor_name: "Ana Renamed"}] =
               Notifications.put_actor_names([hd(notifications)])
    end

    test "lists notifications with their actor's name", %{organization: org, admin: admin} do
      Events.notify_member_removed("Bob", org.id, admin.id)

      assert [%Notification{actor_type: "user", actor_name: "Ana Admin"}] =
               Notifications.list_user_notifications(admin.id)
    end

    test "broadcasts notifications with their actor's name", %{organization: org, admin: admin} do
      Phoenix.PubSub.subscribe(Castmill.PubSub, "organization:#{org.id}")
      Events.notify_member_removed("Bob", org.id, admin.id)

      assert_receive {:new_notification, %Notification{actor_name: "Ana Admin"}, _}
    end
  end

  describe "event actors" do
    test "a device registered by a user names the user", %{organization: org, admin: admin} do
      device_id = Ecto.UUID.generate()
      Events.notify_device_registration("Lobby", device_id, org.id, [], actor_id: admin.id)

      assert %{actor_type: "user", actor_id: actor_id, metadata: %{"device_id" => ^device_id}} =
               latest("device_registration")

      assert actor_id == admin.id

      # Without a user the device stays the actor.
      Events.notify_device_registration("Hall", device_id, org.id)
      assert %{actor_type: "device", actor_id: ^device_id} = latest("device_registration")
    end

    test "media uploads name the uploader", %{organization: org, admin: admin} do
      media_id = 123

      Events.notify_media_uploaded(media_id, "Poster", "image/png", nil, org.id, [],
        actor_id: admin.id
      )

      assert %{actor_type: "user"} = notification = latest("media_uploaded")
      assert notification.actor_id == admin.id
      assert notification.organization_id == org.id

      Events.notify_media_uploaded(media_id, "Poster", "image/png", nil, org.id)
      assert %{actor_type: "system", actor_id: nil} = latest("media_uploaded")
    end

    test "deleting a device names the user", %{organization: org, admin: admin} do
      device = device_fixture(%{organization_id: org.id})

      assert {:ok, _} = Devices.delete_device(device, actor_id: admin.id)

      assert %{actor_type: "user", metadata: %{"device_name" => "Hangar 42"}} =
               notification = latest("device_removal")

      assert notification.actor_id == admin.id
    end

    test "removing a member names the admin", %{network: network, organization: org, admin: admin} do
      other_org = organization_fixture(%{network_id: network.id, name: "Other org"})
      member = user_fixture(%{name: "Bob"})
      {:ok, _} = Organizations.add_user(org.id, member.id, :member)
      {:ok, _} = Organizations.add_user(other_org.id, member.id, :member)

      assert {:ok, _} = Organizations.remove_user(org.id, member.id, actor_id: admin.id)

      assert %{actor_type: "user", metadata: %{"user_name" => "Bob"}} =
               notification = latest("member_removed")

      assert notification.actor_id == admin.id
    end
  end
end
