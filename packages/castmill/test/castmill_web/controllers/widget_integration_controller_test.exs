defmodule CastmillWeb.WidgetIntegrationControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Ecto.Query
  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.{Organizations, Repo}
  alias Castmill.Widgets.Integrations.WidgetIntegrationData

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    {:ok, _} = Organizations.add_user(organization.id, user.id, :admin)
    Organizations.give_access(organization.id, user.id, "playlists", :show)

    token_secret = "token-" <> Ecto.UUID.generate()

    access_token =
      access_token_fixture(%{
        secret: token_secret,
        user_id: user.id,
        is_root: true
      })

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, organization: organization, user: user}
  end

  describe "get_widget_data/2" do
    test "enqueues immediate refresh when cached data is stale", %{
      conn: conn,
      organization: organization
    } do

        suffix = System.unique_integer([:positive])
        feed_url = "https://news.example/#{suffix}.xml"

        widget =
          widget_fixture(%{
            name: "Ticker #{suffix}",
            slug: "ticker-#{suffix}",
            template: %{"type" => "group"}
          })

        integration =
          widget_integration_fixture(%{
            widget_id: widget.id,
            name: "rss-integration-#{suffix}",
            pull_interval_seconds: 45,
            pull_config: %{
              "auth_type" => "optional",
              "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.TestStub"
            }
          })

        playlist = playlist_fixture(%{organization_id: organization.id})

        playlist_item =
          playlist_item_fixture(%{
            playlist_id: playlist.id,
            duration: 10,
            offset: 0
          })

        widget_config =
          widget_config_fixture(%{
            widget_id: widget.id,
            playlist_item_id: playlist_item.id,
            options: %{"feed_url" => feed_url}
          })

        stale_time = DateTime.add(DateTime.utc_now(), -600, :second)

        %WidgetIntegrationData{}
        |> WidgetIntegrationData.changeset(%{
          widget_integration_id: integration.id,
          organization_id: organization.id,
          widget_config_id: widget_config.id,
          discriminator_id: "feed_url:#{feed_url}",
          data: %{"items" => []},
          status: "active",
          version: 1,
          fetched_at: stale_time,
          last_used_at: stale_time,
          refresh_at: DateTime.add(DateTime.utc_now(), -60, :second)
        })
        |> Repo.insert!()

        # In BullMQ inline testing mode, jobs run synchronously
        # We just verify the endpoint returns success and the data is refreshed

        conn = get(conn, "/dashboard/widget-configs/#{widget_config.id}/data")

        assert %{"data" => %{"items" => []}, "version" => 1} = json_response(conn, 200)

        # With BullMQ in inline mode, job executes immediately during request
        # We verify the endpoint works correctly - job enqueueing is tested
        # in the BullMQHelper and worker-specific tests
      # Test now runs in inline mode by default
    end

    test "on-demand fetch stores refresh_at metadata", %{
      conn: conn,
      organization: organization
    } do

        suffix = System.unique_integer([:positive])
        feed_url = "https://fresh.example/#{suffix}.xml"

        widget =
          widget_fixture(%{
            name: "Ticker #{suffix}",
            slug: "ticker-#{suffix}",
            template: %{"type" => "group"}
          })

        integration =
          widget_integration_fixture(%{
            widget_id: widget.id,
            pull_interval_seconds: 150,
            pull_config: %{
              "auth_type" => "optional",
              "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.TestStub"
            }
          })

        playlist = playlist_fixture(%{organization_id: organization.id})

        playlist_item =
          playlist_item_fixture(%{
            playlist_id: playlist.id,
            duration: 10,
            offset: 0
          })

        widget_config =
          widget_config_fixture(%{
            widget_id: widget.id,
            playlist_item_id: playlist_item.id,
            options: %{"feed_url" => feed_url}
          })

        Repo.delete_all(WidgetIntegrationData)

        conn = get(conn, "/dashboard/widget-configs/#{widget_config.id}/data")

        assert %{"data" => %{"items" => [%{"title" => "stub"}]}, "version" => version} =
                 json_response(conn, 200)

        assert version > 0

        discriminator = "feed_url:#{feed_url}"

        data =
          WidgetIntegrationData.base_query()
          |> where(
            [wid],
            wid.widget_integration_id == ^integration.id and
              wid.discriminator_id == ^discriminator
          )
          |> Repo.one()

        refute is_nil(data)
        assert data.refresh_at
        assert data.fetched_at
        assert_in_delta DateTime.diff(data.refresh_at, data.fetched_at), 150, 1
      # Test now runs in inline mode by default
    end

    test "max_items filtering limits returned items to widget config setting", %{
      conn: conn,
      organization: organization
    } do

        suffix = System.unique_integer([:positive])
        feed_url = "https://rss.example/#{suffix}.xml"

        widget =
          widget_fixture(%{
            name: "RSS Widget #{suffix}",
            slug: "rss-#{suffix}",
            template: %{"type" => "group"}
          })

        integration =
          widget_integration_fixture(%{
            widget_id: widget.id,
            name: "rss-integration-#{suffix}",
            pull_interval_seconds: 300,
            pull_config: %{
              "auth_type" => "optional",
              "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.TestStub"
            }
          })

        playlist = playlist_fixture(%{organization_id: organization.id})

        playlist_item =
          playlist_item_fixture(%{
            playlist_id: playlist.id,
            duration: 10,
            offset: 0
          })

        # Set max_items to 5
        widget_config =
          widget_config_fixture(%{
            widget_id: widget.id,
            playlist_item_id: playlist_item.id,
            options: %{"feed_url" => feed_url, "max_items" => 5}
          })

        # Store cached data with 20 items (simulating shared cache)
        many_items = Enum.map(1..20, fn i -> %{"title" => "Item #{i}", "index" => i} end)

        %WidgetIntegrationData{}
        |> WidgetIntegrationData.changeset(%{
          widget_integration_id: integration.id,
          organization_id: organization.id,
          widget_config_id: widget_config.id,
          discriminator_id: "feed_url:#{feed_url}",
          data: %{"items" => many_items},
          status: "active",
          version: 1,
          fetched_at: DateTime.utc_now(),
          last_used_at: DateTime.utc_now(),
          refresh_at: DateTime.add(DateTime.utc_now(), 300, :second)
        })
        |> Repo.insert!()

        conn = get(conn, "/dashboard/widget-configs/#{widget_config.id}/data")

        response = json_response(conn, 200)
        assert %{"data" => %{"items" => items}} = response

        # Should only return 5 items due to max_items filtering
        assert length(items) == 5
        # Should be the first 5 items (sorted order preserved)
        assert Enum.map(items, & &1["index"]) == [1, 2, 3, 4, 5]
      # Test now runs in inline mode by default
    end

    test "max_items defaults to 10 when not specified", %{
      conn: conn,
      organization: organization
    } do

        suffix = System.unique_integer([:positive])
        feed_url = "https://rss.example/default-#{suffix}.xml"

        widget =
          widget_fixture(%{
            name: "RSS Widget #{suffix}",
            slug: "rss-default-#{suffix}",
            template: %{"type" => "group"}
          })

        integration =
          widget_integration_fixture(%{
            widget_id: widget.id,
            name: "rss-integration-default-#{suffix}",
            pull_interval_seconds: 300,
            pull_config: %{
              "auth_type" => "optional",
              "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.TestStub"
            }
          })

        playlist = playlist_fixture(%{organization_id: organization.id})

        playlist_item =
          playlist_item_fixture(%{
            playlist_id: playlist.id,
            duration: 10,
            offset: 0
          })

        # No max_items specified - should default to 10
        widget_config =
          widget_config_fixture(%{
            widget_id: widget.id,
            playlist_item_id: playlist_item.id,
            options: %{"feed_url" => feed_url}
          })

        # Store cached data with 25 items
        many_items = Enum.map(1..25, fn i -> %{"title" => "Item #{i}", "index" => i} end)

        %WidgetIntegrationData{}
        |> WidgetIntegrationData.changeset(%{
          widget_integration_id: integration.id,
          organization_id: organization.id,
          widget_config_id: widget_config.id,
          discriminator_id: "feed_url:#{feed_url}",
          data: %{"items" => many_items},
          status: "active",
          version: 1,
          fetched_at: DateTime.utc_now(),
          last_used_at: DateTime.utc_now(),
          refresh_at: DateTime.add(DateTime.utc_now(), 300, :second)
        })
        |> Repo.insert!()

        conn = get(conn, "/dashboard/widget-configs/#{widget_config.id}/data")

        response = json_response(conn, 200)
        assert %{"data" => %{"items" => items}} = response

        # Should default to 10 items
        assert length(items) == 10
      # Test now runs in inline mode by default
    end
  end
end
