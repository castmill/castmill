defmodule CastmillWeb.NotificationControllerTest do
  use CastmillWeb.ConnCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.{Notifications, Repo}

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{network_id: network.id})

    # Setup session-based auth (for /dashboard routes)
    # The authenticate_user plug checks conn.assigns[:current_user]
    conn_session =
      conn
      |> assign(:current_user, user)
      |> put_req_header("accept", "application/json")

    # Setup token-based auth (for /api routes)
    conn_token =
      conn
      |> assign(:user, user)
      |> put_req_header("accept", "application/json")

    {:ok,
     conn_session: conn_session,
     conn_token: conn_token,
     user: user,
     organization: organization,
     network: network}
  end

  describe "index/2 with session auth" do
    test "lists notifications for current user", %{
      conn_session: conn,
      user: user,
      organization: org
    } do
      # Create test notifications
      {:ok, _n1} =
        Notifications.create_user_notification(%{
          title_key: "test.notification1",
          description_key: "test.description1",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      {:ok, _n2} =
        Notifications.create_user_notification(%{
          title_key: "test.notification2",
          description_key: "test.description2",
          type: "success",
          user_id: user.id,
          organization_id: org.id,
          read: true
        })

      conn = get(conn, "/dashboard/notifications")

      response = json_response(conn, 200)
      assert length(response["data"]) == 2
      assert response["unread_count"] == 1
    end

    test "supports pagination", %{conn_session: conn, user: user, organization: org} do
      # Create 25 notifications
      for i <- 1..25 do
        Notifications.create_user_notification(%{
          title_key: "test.notification_#{i}",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })
      end

      # Get first page
      conn1 = get(conn, "/dashboard/notifications?page=1&page_size=10")
      response1 = json_response(conn1, 200)
      assert length(response1["data"]) == 10

      # Get second page
      conn2 = get(conn, "/dashboard/notifications?page=2&page_size=10")
      response2 = json_response(conn2, 200)
      assert length(response2["data"]) == 10

      # Verify pages are different
      page1_ids = Enum.map(response1["data"], & &1["id"])
      page2_ids = Enum.map(response2["data"], & &1["id"])
      assert page1_ids != page2_ids
    end

    test "returns empty list when no notifications", %{conn_session: conn} do
      conn = get(conn, "/dashboard/notifications")

      response = json_response(conn, 200)
      assert response["data"] == []
      assert response["unread_count"] == 0
    end
  end

  describe "index/2 with token auth" do
    @tag :skip
    test "lists notifications using token authentication", %{
      conn_token: conn,
      user: user,
      organization: org
    } do
      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.notification",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      conn = get(conn, "/dashboard/notifications")

      response = json_response(conn, 200)
      assert length(response["data"]) == 1
      assert response["unread_count"] == 1
    end
  end

  describe "unread_count/2" do
    test "returns unread notification count", %{conn_session: conn, user: user, organization: org} do
      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.unread1",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.unread2",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.read",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: true
        })

      conn = get(conn, "/dashboard/notifications/unread_count")

      response = json_response(conn, 200)
      assert response["count"] == 2
    end

    test "returns 0 when no unread notifications", %{conn_session: conn} do
      conn = get(conn, "/dashboard/notifications/unread_count")

      response = json_response(conn, 200)
      assert response["count"] == 0
    end
  end

  describe "mark_read/2" do
    test "marks notification as read", %{conn_session: conn, user: user, organization: org} do
      {:ok, notification} =
        Notifications.create_user_notification(%{
          title_key: "test.notification",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      conn = patch(conn, "/dashboard/notifications/#{notification.id}/read")

      response = json_response(conn, 200)
      assert response["data"]["read"] == true

      # Verify in database
      updated = Repo.get(Castmill.Notifications.Notification, notification.id)
      assert updated.read == true
    end

    test "returns error for non-existent notification", %{conn_session: conn} do
      conn = patch(conn, "/dashboard/notifications/999999999/read")

      assert json_response(conn, 404)
    end
  end

  describe "mark_all_read/2" do
    test "marks all user notifications as read", %{
      conn_session: conn,
      user: user,
      organization: org
    } do
      # Create unread notifications
      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.unread1",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.unread2",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.unread3",
          description_key: "test.description",
          type: "info",
          user_id: user.id,
          organization_id: org.id,
          read: false
        })

      conn = post(conn, "/dashboard/notifications/mark_all_read")

      response = json_response(conn, 200)
      assert response["marked_read"] == 3

      # Verify unread count is now 0
      count = Notifications.count_unread_notifications(user.id)
      assert count == 0
    end

    test "returns 0 when no unread notifications", %{conn_session: conn} do
      conn = post(conn, "/dashboard/notifications/mark_all_read")

      response = json_response(conn, 200)
      assert response["marked_read"] == 0
    end
  end

  describe "authorization" do
    test "requires authentication for index", %{conn: conn} do
      # Use fresh conn without any user assigned
      conn =
        conn
        |> put_req_header("accept", "application/json")
        |> get("/dashboard/notifications")

      # Should return unauthorized or redirect
      assert conn.status in [401, 302, 404]
    end

    test "user can only see their own notifications", %{
      conn_session: conn,
      organization: org,
      user: _user,
      network: network
    } do
      # Create another user using fixture
      other_user =
        user_fixture(%{
          email: "other@example.com",
          name: "Other User",
          network_id: network.id
        })

      # Create notification for other user
      {:ok, _} =
        Notifications.create_user_notification(%{
          title_key: "test.other_user_notification",
          description_key: "test.description",
          type: "info",
          user_id: other_user.id,
          organization_id: org.id,
          read: false
        })

      # Current user should not see other user's notification
      conn = get(conn, "/dashboard/notifications")
      response = json_response(conn, 200)
      assert response["data"] == []
    end
  end
end
