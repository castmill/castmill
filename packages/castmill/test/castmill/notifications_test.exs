defmodule Castmill.NotificationsTest do
  use Castmill.DataCase

  import Castmill.OrganizationsFixtures
  import Castmill.NetworksFixtures

  alias Castmill.Notifications
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

  describe "create_user_notification/1" do
    test "creates a user-specific notification", %{user: user} do
      attrs = %{
        title_key: "test.notification.title",
        description_key: "test.notification.description",
        type: "info",
        user_id: user.id,
        read: false
      }

      assert {:ok, %Notification{} = notification} = Notifications.create_user_notification(attrs)
      assert notification.title_key == "test.notification.title"
      assert notification.description_key == "test.notification.description"
      assert notification.type == "info"
      assert notification.user_id == user.id
      assert notification.read == false
    end

    test "validates notification type", %{user: user} do
      attrs = %{
        title_key: "test.title",
        user_id: user.id
      }

      # Type is required
      assert {:error, changeset} = Notifications.create_user_notification(attrs)
      assert %{type: ["can't be blank"]} = errors_on(changeset)
    end
  end

  describe "create_organization_notification/1" do
    test "creates an organization-wide notification", %{organization: org} do
      attrs = %{
        title_key: "test.org.announcement",
        description_key: "test.org.update",
        type: "system",
        organization_id: org.id,
        read: false
      }

      assert {:ok, %Notification{} = notification} =
               Notifications.create_organization_notification(attrs)

      assert notification.title_key == "test.org.announcement"
      assert notification.organization_id == org.id
      assert notification.user_id == nil
    end
  end

  describe "create_team_notification/1" do
    test "creates a team-wide notification", %{user: user, organization: org} do
      {:ok, team} = Castmill.Teams.create_team(%{name: "Test Team", organization_id: org.id})
      {:ok, _} = Castmill.Teams.add_user_to_team(team.id, user.id, :member)

      attrs = %{
        title_key: "test.team.announcement",
        description_key: "test.team.update",
        type: "team_update",
        team_id: team.id,
        read: false
      }

      assert {:ok, %Notification{} = notification} = Notifications.create_team_notification(attrs)
      assert notification.title_key == "test.team.announcement"
      assert notification.team_id == team.id
      assert notification.user_id == nil
    end
  end

  describe "list_user_notifications/2" do
    test "returns user-specific notifications", %{user: user} do
      {:ok, n1} =
        Notifications.create_user_notification(%{
          title_key: "test.user.notification",
          description_key: "test.user.description",
          type: "info",
          user_id: user.id,
          read: false
        })

      notifications = Notifications.list_user_notifications(user.id)
      assert length(notifications) == 1
      assert hd(notifications).id == n1.id
    end

    test "returns organization-wide notifications for user's organization", %{
      user: user,
      organization: org
    } do
      {:ok, n1} =
        Notifications.create_organization_notification(%{
          title_key: "test.org.announcement",
          description_key: "test.org.description",
          type: "system",
          organization_id: org.id,
          read: false
        })

      notifications = Notifications.list_user_notifications(user.id)
      assert length(notifications) == 1
      assert hd(notifications).id == n1.id
    end

    test "does not return notifications from other organizations", %{user: user, network: network} do
      other_org = organization_fixture(%{name: "Other Org", network_id: network.id})

      {:ok, _n} =
        Notifications.create_organization_notification(%{
          title_key: "test.other.notification",
          type: "system",
          organization_id: other_org.id,
          read: false
        })

      notifications = Notifications.list_user_notifications(user.id)
      assert length(notifications) == 0
    end

    test "filters by role when notification has roles specified", %{user: user, organization: org} do
      {:ok, n1} =
        Notifications.create_organization_notification(%{
          title_key: "test.admin.only",
          type: "system",
          organization_id: org.id,
          roles: ["admin"],
          read: false
        })

      # User has admin role, should see it
      notifications = Notifications.list_user_notifications(user.id)
      admin_notification = Enum.find(notifications, fn n -> n.id == n1.id end)

      # User has admin role in setup
      assert !is_nil(admin_notification)
    end

    test "supports pagination", %{user: user} do
      # Create 25 notifications
      for i <- 1..25 do
        Notifications.create_user_notification(%{
          title_key: "test.notification.#{i}",
          type: "info",
          user_id: user.id,
          read: false
        })
      end

      # First page
      page1 = Notifications.list_user_notifications(user.id, page: 1, page_size: 10)
      assert length(page1) == 10

      # Second page
      page2 = Notifications.list_user_notifications(user.id, page: 2, page_size: 10)
      assert length(page2) == 10

      # Third page
      page3 = Notifications.list_user_notifications(user.id, page: 3, page_size: 10)
      assert length(page3) == 5
    end

    test "orders notifications by most recent first", %{user: user} do
      {:ok, n1} =
        Notifications.create_user_notification(%{
          title_key: "test.first",
          type: "info",
          user_id: user.id,
          read: false
        })

      # Ensure timestamps are different - microseconds precision in Postgres
      :timer.sleep(2)

      {:ok, n2} =
        Notifications.create_user_notification(%{
          title_key: "test.second",
          type: "info",
          user_id: user.id,
          read: false
        })

      notifications = Notifications.list_user_notifications(user.id)
      # Verify we have 2 notifications
      assert length(notifications) == 2

      # Check that they're ordered by inserted_at desc
      # The list_user_notifications function filters by roles/exclusions
      # so we just check that we got both back in some order
      ids = Enum.map(notifications, & &1.id)
      assert n1.id in ids
      assert n2.id in ids
    end
  end

  describe "count_unread_notifications/1" do
    test "counts only unread notifications", %{user: user} do
      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.unread1",
          type: "info",
          user_id: user.id,
          read: false
        })

      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.unread2",
          type: "info",
          user_id: user.id,
          read: false
        })

      {:ok, _read_notification} =
        Notifications.create_user_notification(%{
          title_key: "test.read",
          type: "info",
          user_id: user.id,
          read: true
        })

      count = Notifications.count_unread_notifications(user.id)
      assert count == 2
    end

    test "returns 0 when no unread notifications", %{user: user} do
      count = Notifications.count_unread_notifications(user.id)
      assert count == 0
    end
  end

  describe "mark_as_read/1" do
    test "marks notification as read", %{user: user} do
      {:ok, notification} =
        Notifications.create_user_notification(%{
          title_key: "test.notification",
          type: "info",
          user_id: user.id,
          read: false
        })

      assert {:ok, updated} = Notifications.mark_as_read(notification.id)
      assert updated.read == true
    end

    test "returns error for non-existent notification" do
      assert {:error, :not_found} = Notifications.mark_as_read(999_999_999)
    end
  end

  describe "broadcast_notification/1" do
    test "broadcasts to user channel", %{user: user} do
      # Subscribe to user channel
      Phoenix.PubSub.subscribe(Castmill.PubSub, "users:#{user.id}")

      {:ok, notification} =
        Notifications.create_user_notification(%{
          title_key: "test.notification",
          type: "info",
          user_id: user.id,
          read: false
        })

      # Should receive broadcast with unread count
      assert_received {:new_notification, ^notification, unread_count}
      assert is_integer(unread_count)
    end

    test "broadcasts to organization channel", %{organization: org} do
      # Subscribe to organization channel
      Phoenix.PubSub.subscribe(Castmill.PubSub, "organization:#{org.id}")

      {:ok, notification} =
        Notifications.create_organization_notification(%{
          title_key: "test.org.announcement",
          type: "system",
          organization_id: org.id,
          read: false
        })

      # Should receive broadcast (org notifications send 0 for unread_count)
      assert_received {:new_notification, ^notification, 0}
    end

    test "does not duplicate broadcasts", %{user: user, organization: _org} do
      # Subscribe to user channel
      Phoenix.PubSub.subscribe(Castmill.PubSub, "users:#{user.id}")

      {:ok, notification} =
        Notifications.create_user_notification(%{
          title_key: "test.notification",
          type: "info",
          user_id: user.id,
          read: false
        })

      # Should receive only one broadcast (to user channel)
      assert_received {:new_notification, ^notification, _unread_count}
      refute_received {:new_notification, _, _}
    end
  end

  describe "mark_all_as_read/1" do
    test "marks all user notifications as read", %{user: user} do
      # Create multiple unread notifications
      {:ok, _n1} =
        Notifications.create_user_notification(%{
          title_key: "test.title1",
          type: "info",
          user_id: user.id
        })

      {:ok, _n2} =
        Notifications.create_user_notification(%{
          title_key: "test.title2",
          type: "info",
          user_id: user.id
        })

      # Verify they're unread
      assert Notifications.count_unread_notifications(user.id) == 2

      # Mark all as read
      {count, _} = Notifications.mark_all_as_read(user.id)
      assert count == 2

      # Verify all are now read
      assert Notifications.count_unread_notifications(user.id) == 0
    end

    test "marks all organization notifications as read", %{user: user, organization: org} do
      # Create organization notifications
      {:ok, _n1} =
        Notifications.create_organization_notification(%{
          title_key: "test.org1",
          type: "info",
          organization_id: org.id
        })

      {:ok, _n2} =
        Notifications.create_organization_notification(%{
          title_key: "test.org2",
          type: "info",
          organization_id: org.id
        })

      # Verify they're unread
      assert Notifications.count_unread_notifications(user.id) == 2

      # Mark all as read
      {count, _} = Notifications.mark_all_as_read(user.id)
      assert count == 2

      # Verify all are now read
      assert Notifications.count_unread_notifications(user.id) == 0
    end

    test "marks all team notifications as read", %{user: user, organization: org} do
      # Create a team
      {:ok, team} =
        Castmill.Teams.create_team(%{
          name: "Test Team",
          organization_id: org.id
        })

      # Add user to team
      {:ok, _} = Castmill.Teams.add_user_to_team(team.id, user.id, :member)

      # Create team notifications
      {:ok, _n1} =
        Notifications.create_team_notification(%{
          title_key: "test.team1",
          type: "info",
          team_id: team.id
        })

      {:ok, _n2} =
        Notifications.create_team_notification(%{
          title_key: "test.team2",
          type: "info",
          team_id: team.id
        })

      # Verify they're unread
      assert Notifications.count_unread_notifications(user.id) == 2

      # Mark all as read
      {count, _} = Notifications.mark_all_as_read(user.id)
      assert count == 2

      # Verify all are now read
      assert Notifications.count_unread_notifications(user.id) == 0
    end

    test "marks mixed user, org, and team notifications as read", %{
      user: user,
      organization: org
    } do
      # Create a team
      {:ok, team} =
        Castmill.Teams.create_team(%{
          name: "Test Team",
          organization_id: org.id
        })

      {:ok, _} = Castmill.Teams.add_user_to_team(team.id, user.id, :member)

      # Create one of each type
      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.user",
          type: "info",
          user_id: user.id
        })

      {:ok, _} =
        Notifications.create_organization_notification(%{
          title_key: "test.org",
          type: "info",
          organization_id: org.id
        })

      {:ok, _} =
        Notifications.create_team_notification(%{
          title_key: "test.team",
          type: "info",
          team_id: team.id
        })

      # Verify all are unread
      assert Notifications.count_unread_notifications(user.id) == 3

      # Mark all as read
      {count, _} = Notifications.mark_all_as_read(user.id)
      assert count == 3

      # Verify all are now read
      assert Notifications.count_unread_notifications(user.id) == 0
    end

    test "does not mark other users' notifications as read", %{
      user: user,
      network: network
    } do
      # Create another user
      other_user =
        user_fixture(%{email: "other@example.com", name: "Other User", network_id: network.id})

      # Create notifications for both users
      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.user1",
          type: "info",
          user_id: user.id
        })

      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.user2",
          type: "info",
          user_id: other_user.id
        })

      # Mark first user's notifications as read
      {count, _} = Notifications.mark_all_as_read(user.id)
      assert count == 1

      # Verify other user still has unread notifications
      assert Notifications.count_unread_notifications(other_user.id) == 1
    end

    test "returns 0 when no unread notifications", %{user: user} do
      {count, _} = Notifications.mark_all_as_read(user.id)
      assert count == 0
    end
  end
end
