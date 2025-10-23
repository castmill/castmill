defmodule CastmillWeb.NotificationsChannelTest do
  use CastmillWeb.ChannelCase

  import Castmill.OrganizationsFixtures
  import Castmill.NetworksFixtures

  alias Castmill.{Repo, Notifications}
  alias Castmill.Notifications.Notification

  setup do
    # Create network, user and organization using fixtures
    network = network_fixture(%{name: "Test Network"})
    user = user_fixture(%{email: "test@example.com", name: "Test User", network_id: network.id})
    org = organization_fixture(%{name: "Test Org", network_id: network.id})

    # Associate user with organization
    {:ok, _} = Castmill.Organizations.add_user(org.id, user.id, :admin)

    %{user: user, organization: org, network: network}
  end

  describe "join/3" do
    test "allows authorized user to join their notification channel", %{user: user} do
      {:ok, response, _socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          CastmillWeb.NotificationsChannel,
          "notifications:#{user.id}"
        )

      assert response.unread_count == 0
    end

    test "returns unread count on join", %{user: user, organization: org} do
      # Create unread notifications
      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.notification1",
          description_key: "test.description1",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.notification2",
          description_key: "test.description2",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      {:ok, response, _socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          CastmillWeb.NotificationsChannel,
          "notifications:#{user.id}"
        )

      assert response.unread_count == 2
    end

    test "rejects unauthorized users", %{user: user} do
      # Create another user
      another_user =
        user_fixture(%{
          email: "other@example.com",
          name: "Other User",
          network_id: user.network_id
        })

      assert {:error, %{reason: "unauthorized"}} =
               CastmillWeb.UserSocket
               |> socket(another_user.id, %{user: another_user})
               |> subscribe_and_join(
                 CastmillWeb.NotificationsChannel,
                 "notifications:#{user.id}"
               )
    end

    test "subscribes to organization PubSub channels", %{user: user, organization: org} do
      {:ok, _, _socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          CastmillWeb.NotificationsChannel,
          "notifications:#{user.id}"
        )

      # Verify subscription by broadcasting to organization channel
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "organization:#{org.id}",
        {:new_notification, %{id: "test", title_key: "test.org_notification"}}
      )

      # Should receive the broadcast
      assert_push "new_notification", %{notification: %{id: "test"}}
    end
  end

  describe "handle_in mark_read" do
    test "marks notification as read and returns new unread count", %{
      user: user,
      organization: org
    } do
      {:ok, notification} =
        Notifications.create_user_notification(%{
          title_key: "test.notification",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      {:ok, _, socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          CastmillWeb.NotificationsChannel,
          "notifications:#{user.id}"
        )

      ref = push(socket, "mark_read", %{"id" => notification.id})
      assert_reply ref, :ok, %{unread_count: 0}

      # Verify notification was marked as read
      updated = Repo.get(Notification, notification.id)
      assert updated.read == true
    end

    test "returns error for non-existent notification", %{user: user} do
      {:ok, _, socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          CastmillWeb.NotificationsChannel,
          "notifications:#{user.id}"
        )

      ref = push(socket, "mark_read", %{"id" => 999_999_999})
      assert_reply ref, :error, %{reason: "not_found"}
    end
  end

  describe "handle_info new_notification" do
    test "broadcasts new notification to client", %{user: user, organization: org} do
      {:ok, _, _socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          CastmillWeb.NotificationsChannel,
          "notifications:#{user.id}"
        )

      notification_id = Ecto.UUID.generate()

      notification = %{
        id: notification_id,
        title_key: "test.new_notification",
        description_key: "test.description",
        type: "info",
        user_id: user.id,
        organization_id: org.id,
        read: false
      }

      # Broadcast to user's personal channel
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "users:#{user.id}",
        {:new_notification, notification, 1}
      )

      assert_push "new_notification", %{
        notification: %{
          id: ^notification_id,
          title_key: "test.new_notification",
          description_key: "test.description",
          type: "info",
          read: false
        },
        unread_count: 1
      }
    end

    test "receives organization-wide notifications", %{user: user, organization: org} do
      {:ok, _, _socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          CastmillWeb.NotificationsChannel,
          "notifications:#{user.id}"
        )

      notification_id = Ecto.UUID.generate()

      notification = %{
        id: notification_id,
        title_key: "test.org_announcement",
        description_key: "test.important_update",
        type: "info",
        organization_id: org.id,
        read: false
      }

      # Broadcast to organization channel
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "organization:#{org.id}",
        {:new_notification, notification, 0}
      )

      assert_push "new_notification", %{
        notification: %{
          id: ^notification_id,
          title_key: "test.org_announcement",
          description_key: "test.important_update",
          type: "info",
          read: false
        }
      }
    end
  end

  describe "handle_info notification_read" do
    test "broadcasts updated unread count when notification is read", %{
      user: user,
      organization: org
    } do
      {:ok, notification} =
        Notifications.create_user_notification(%{
          title_key: "test.notification",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      {:ok, _, _socket} =
        CastmillWeb.UserSocket
        |> socket(user.id, %{user: user})
        |> subscribe_and_join(
          CastmillWeb.NotificationsChannel,
          "notifications:#{user.id}"
        )

      # Broadcast notification_read event
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "users:#{user.id}",
        {:notification_read, notification.id, 0}
      )

      assert_push "notification_read", %{id: _, unread_count: 0}
    end
  end
end
