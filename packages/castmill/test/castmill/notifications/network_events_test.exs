defmodule Castmill.Notifications.NetworkEventsTest do
  use Castmill.DataCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Notifications
  alias Castmill.Notifications.Events

  @attrs %{
    type: "network_test_event",
    title_key: "test.network.title",
    description_key: "test.network.description",
    link: "/network/settings",
    metadata: %{hostname: "signage.example.com"}
  }

  setup do
    network = network_fixture()
    admins = for _ <- 1..2, do: user_fixture(%{network_id: network.id, network_role: :admin})
    member = user_fixture(%{network_id: network.id})
    other_admin = user_fixture(%{network_id: network_fixture().id, network_role: :admin})

    %{network: network, admins: admins, member: member, other_admin: other_admin}
  end

  describe "notify_network_admins/2" do
    test "notifies each admin of the network and nobody else", %{
      network: network,
      admins: admins,
      member: member,
      other_admin: other_admin
    } do
      assert {:ok, notifications} = Events.notify_network_admins(network.id, @attrs)

      assert notifications |> Enum.map(& &1.user_id) |> Enum.sort() ==
               admins |> Enum.map(& &1.id) |> Enum.sort()

      for notification <- notifications do
        assert notification.type == "network_test_event"
        assert notification.link == "/network/settings"
        assert notification.actor_type == "system"
        assert notification.metadata == %{hostname: "signage.example.com"}
      end

      for admin <- admins do
        assert [%{type: "network_test_event"}] = Notifications.list_user_notifications(admin.id)
      end

      assert Notifications.list_user_notifications(member.id) == []
      assert Notifications.list_user_notifications(other_admin.id) == []
    end

    test "broadcasts each notification to its admin", %{network: network, admins: [admin | _]} do
      Phoenix.PubSub.subscribe(Castmill.PubSub, "users:#{admin.id}")

      assert {:ok, _} = Events.notify_network_admins(network.id, @attrs)

      assert_receive {:new_notification, %{type: "network_test_event", user_id: user_id}, 1}
      assert user_id == admin.id
    end

    test "keeps an explicit actor", %{network: network} do
      assert {:ok, [notification | _]} =
               Events.notify_network_admins(network.id, Map.put(@attrs, :actor_type, "user"))

      assert notification.actor_type == "user"
    end

    test "returns no notifications for a network without admins" do
      assert {:ok, []} = Events.notify_network_admins(network_fixture().id, @attrs)
    end

    test "returns the error of an invalid notification", %{network: network} do
      assert {:error, %Ecto.Changeset{}} =
               Events.notify_network_admins(network.id, Map.delete(@attrs, :type))
    end
  end
end
