defmodule Castmill.Widgets.Integrations.RefreshTest do
  # Not async: the test fetcher counts calls in a named Agent.
  use Castmill.DataCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Repo
  alias Castmill.Resources
  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.{Refresh, WidgetIntegrationData}
  alias Castmill.Widgets.Integrations.Fetchers.TestOnDemand
  alias Castmill.Workers.IntegrationPoller

  @fetcher "Castmill.Widgets.Integrations.Fetchers.TestOnDemand"

  setup do
    start_supervised!(TestOnDemand)

    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})

    widget =
      widget_fixture(%{
        options_schema: %{"query" => %{"type" => "string"}, "units" => %{"type" => "string"}}
      })

    {:ok, integration} =
      Integrations.create_integration(%{
        widget_id: widget.id,
        name: "listings",
        integration_type: "pull",
        credential_scope: "organization",
        pull_endpoint: "https://service.test/items",
        pull_interval_seconds: 300,
        refresh_mode: "on_demand",
        discriminator_type: "widget_option",
        discriminator_key: "query",
        pull_config: %{
          "fetcher_module" => @fetcher,
          "auth_type" => "none",
          "service_url" => "https://service.test",
          "units" => "metric"
        }
      })

    %{organization: organization, widget: widget, integration: integration}
  end

  defp options(query), do: %{"query" => query}

  defp store!(integration, organization, query, attrs) do
    {:ok, data} =
      Refresh.store(
        integration,
        organization.id,
        discriminator(integration, organization, query),
        %{"value" => 0}
      )

    data |> WidgetIntegrationData.changeset(attrs) |> Repo.update!()
  end

  defp discriminator(integration, organization, query),
    do: Integrations.build_discriminator_id(integration, options(query), organization.id)

  defp ago(seconds),
    do: DateTime.utc_now() |> DateTime.add(-seconds, :second) |> DateTime.truncate(:second)

  describe "fetch_options/3" do
    test "items override declared options only; integration settings always win", %{
      integration: integration
    } do
      merged =
        Refresh.fetch_options(integration, %{
          "query" => "villa",
          "units" => "imperial",
          "service_url" => "http://169.254.169.254",
          "fetcher_module" => "Elixir.System",
          max_items: 5
        })

      assert merged["query"] == "villa"
      # Declared in the options schema, so the item may override the default.
      assert merged["units"] == "imperial"
      # Not declared: integration settings cannot be redirected by items.
      assert merged["service_url"] == "https://service.test"
      assert merged["fetcher_module"] == @fetcher
      assert merged["max_items"] == 5
    end

    test "accepts list-style options schemas", %{integration: integration} do
      merged =
        Refresh.fetch_options(integration, %{"service_url" => "x"}, [%{"key" => "service_url"}])

      assert merged["service_url"] == "x"
    end
  end

  describe "fetcher_module/1" do
    test "only resolves modules in the fetchers namespace", %{integration: integration} do
      assert {:ok, TestOnDemand} = Refresh.fetcher_module(integration)

      for {name, error} <- [
            {"Elixir.System", :unauthorized_fetcher_module},
            {"Castmill.Widgets.Integrations.Fetchers.DoesNotExist#{System.unique_integer()}",
             :invalid_fetcher_module}
          ] do
        assert {:error, ^error} =
                 Refresh.fetcher_module(%{integration | pull_config: %{"fetcher_module" => name}})
      end

      assert {:error, :no_fetcher_module} =
               Refresh.fetcher_module(%{integration | pull_config: %{}})
    end
  end

  describe "state/3 and backoff" do
    test "classifies stored data", %{integration: integration} do
      now = DateTime.utc_now()
      data = fn attrs -> struct(WidgetIntegrationData, attrs) end

      assert Refresh.state(nil, integration, now) == :missing

      assert Refresh.state(
               data.(%{refresh_at: DateTime.add(now, 60), fetched_at: now}),
               integration,
               now
             ) == :fresh

      assert Refresh.state(
               data.(%{refresh_at: DateTime.add(now, -1), fetched_at: DateTime.add(now, -400)}),
               integration,
               now
             ) == :stale

      assert Refresh.state(
               data.(%{refresh_at: DateTime.add(now, -1), fetched_at: DateTime.add(now, -1_801)}),
               integration,
               now
             ) == :very_stale

      assert Refresh.state(data.(%{refresh_at: nil, fetched_at: nil}), integration, now) ==
               :very_stale

      # A failing source is only retried through the background, with backoff.
      assert Refresh.state(
               data.(%{
                 refresh_at: DateTime.add(now, -1),
                 fetched_at: DateTime.add(now, -9_999),
                 refresh_failures: 2
               }),
               integration,
               now
             ) == :stale
    end

    test "backs off exponentially up to 30 minutes", %{integration: integration} do
      assert Enum.map(1..5, &Refresh.backoff_seconds(integration, &1)) == [
               300,
               600,
               1_200,
               1_800,
               1_800
             ]

      assert Refresh.interval(%{integration | pull_interval_seconds: nil}) == 300
    end
  end

  describe "read/5" do
    test "fetches missing data now and serves it while fresh", %{
      integration: integration,
      organization: organization,
      widget: widget
    } do
      assert {:ok, %WidgetIntegrationData{data: %{"value" => 1, "query" => "villa"}} = data} =
               Refresh.read(integration, nil, organization.id, widget.id, options("villa"))

      assert [call] = TestOnDemand.calls()
      assert call["service_url"] == "https://service.test"
      assert data.refresh_failures == 0

      stored = Refresh.stored(integration, organization.id, options("villa"))
      assert stored.id == data.id

      assert {:ok, ^stored} =
               Refresh.read(integration, stored, organization.id, widget.id, options("villa"))

      assert length(TestOnDemand.calls()) == 1
    end

    test "serves stale data and refreshes it in the background", %{
      integration: integration,
      organization: organization,
      widget: widget
    } do
      stale =
        store!(integration, organization, "villa", %{refresh_at: ago(1), fetched_at: ago(400)})

      # Inline in tests, the queued refresh runs before read/5 returns.
      assert {:ok, ^stale} =
               Refresh.read(integration, stale, organization.id, widget.id, options("villa"))

      assert length(TestOnDemand.calls()) == 1

      refreshed = Refresh.stored(integration, organization.id, options("villa"))
      assert refreshed.data["value"] == 1
      assert refreshed.version > stale.version
      assert DateTime.compare(refreshed.refresh_at, DateTime.utc_now()) == :gt
    end

    test "fetches very stale data now", %{
      integration: integration,
      organization: organization,
      widget: widget
    } do
      old =
        store!(integration, organization, "villa", %{
          refresh_at: ago(1_500),
          fetched_at: ago(86_400)
        })

      assert {:ok, %WidgetIntegrationData{data: %{"value" => 1}}} =
               Refresh.read(integration, old, organization.id, widget.id, options("villa"))
    end

    test "keeps the last good data and backs off when the source fails", %{
      integration: integration,
      organization: organization,
      widget: widget
    } do
      stale =
        store!(integration, organization, "villa", %{refresh_at: ago(1), fetched_at: ago(400)})

      TestOnDemand.fail_with(:service_down)

      assert {:ok, ^stale} =
               Refresh.read(integration, stale, organization.id, widget.id, options("villa"))

      failed = Refresh.stored(integration, organization.id, options("villa"))
      assert failed.data == stale.data
      assert failed.status == "error"
      assert failed.error_message == ":service_down"
      assert failed.refresh_failures == 1
      assert_in_delta DateTime.diff(failed.refresh_at, DateTime.utc_now()), 300, 5

      # Due again: still served from the store, refreshed in the background with a longer backoff.
      due = failed |> WidgetIntegrationData.changeset(%{refresh_at: ago(1)}) |> Repo.update!()

      assert {:ok, ^due} =
               Refresh.read(integration, due, organization.id, widget.id, options("villa"))

      assert Refresh.stored(integration, organization.id, options("villa")).refresh_failures == 2

      # Recovery resets the failure count.
      TestOnDemand.fail_with(nil)

      due =
        Refresh.stored(integration, organization.id, options("villa"))
        |> WidgetIntegrationData.changeset(%{refresh_at: ago(1)})
        |> Repo.update!()

      Refresh.read(integration, due, organization.id, widget.id, options("villa"))
      recovered = Refresh.stored(integration, organization.id, options("villa"))

      assert {recovered.status, recovered.refresh_failures, recovered.error_message} ==
               {"active", 0, nil}
    end

    test "reports an error when missing data cannot be fetched", %{
      integration: integration,
      organization: organization,
      widget: widget
    } do
      TestOnDemand.fail_with(:not_found)

      assert {:error, :not_found} =
               Refresh.read(integration, nil, organization.id, widget.id, options("villa"))

      assert Refresh.stored(integration, organization.id, options("villa")) == nil
    end

    test "never serves data stored for other options", %{
      integration: integration,
      organization: organization
    } do
      store!(integration, organization, "villa", %{})
      assert Refresh.stored(integration, organization.id, options("castle")) == nil
    end
  end

  describe "synchronous fetches" do
    setup do
      previous = Application.get_env(:castmill, :async_poll_scheduling)
      Application.put_env(:castmill, :async_poll_scheduling, true)
      Application.put_env(:castmill, Refresh, missing_timeout: 200, very_stale_timeout: 200)

      on_exit(fn ->
        Application.put_env(:castmill, :async_poll_scheduling, previous)
        Application.delete_env(:castmill, Refresh)
      end)
    end

    test "run in a task and return the fetched data", %{
      integration: integration,
      organization: organization,
      widget: widget
    } do
      assert {:ok, %WidgetIntegrationData{data: %{"value" => 1}}} =
               Refresh.read(integration, nil, organization.id, widget.id, options("villa"))
    end

    test "give up after the timeout; a very stale read falls back to stored data", %{
      integration: integration,
      organization: organization,
      widget: widget
    } do
      TestOnDemand.sleep_for(600)
      assert Refresh.read(integration, nil, organization.id, widget.id, options("villa")) == nil

      old =
        store!(integration, organization, "castle", %{
          refresh_at: ago(2_000),
          fetched_at: ago(86_400)
        })

      assert {:ok, ^old} =
               Refresh.read(integration, old, organization.id, widget.id, options("castle"))

      # Let the abandoned fetches finish before the sandbox closes.
      Process.sleep(700)
    end
  end

  describe "await_stored/3" do
    test "returns data stored by another reader, or times out", %{
      integration: integration,
      organization: organization
    } do
      id = discriminator(integration, organization, "villa")
      assert Refresh.await_stored(integration, id, 0) == :timeout

      stored = store!(integration, organization, "villa", %{})

      assert {:ok, %WidgetIntegrationData{id: stored_id}} =
               Refresh.await_stored(integration, id, 1_000)

      assert stored_id == stored.id
    end
  end

  describe "fetch/3" do
    test "accepts two-element results and rejects unexpected ones", %{
      integration: integration,
      organization: organization
    } do
      TestOnDemand.respond_with({:ok, %{"value" => 42}})

      assert {:ok, %{"value" => 42}} =
               Refresh.fetch(integration, organization.id, options("villa"))

      TestOnDemand.respond_with({:error, :gone})
      assert {:error, :gone} = Refresh.fetch(integration, organization.id, options("villa"))

      TestOnDemand.respond_with(:nonsense)

      assert {:error, {:unexpected_fetch_result, :nonsense}} =
               Refresh.fetch(integration, organization.id, options("villa"))
    end

    test "records failures with readable messages", %{
      integration: integration,
      organization: organization
    } do
      store!(integration, organization, "villa", %{})
      TestOnDemand.respond_with({:error, String.duplicate("x", 600)})

      assert {:error, _} = Refresh.fetch_and_store(integration, organization.id, options("villa"))

      assert String.length(
               Refresh.stored(integration, organization.id, options("villa")).error_message
             ) == 500

      # Nothing stored yet: nothing to record.
      assert :ok = Refresh.record_failure(integration, "unknown", :boom)
    end

    test "options schemas may use atom keys or be missing", %{integration: integration} do
      assert Refresh.fetch_options(integration, %{"units" => "x"}, [%{key: :units}])["units"] ==
               "x"

      assert Refresh.fetch_options(%{integration | widget_id: nil}, %{"units" => "x"})["units"] ==
               "metric"

      assert Refresh.fetch_options(integration, nil)["units"] == "metric"
    end
  end

  describe "polling" do
    test "on-demand integrations never get repeatable jobs", %{
      integration: integration,
      organization: organization,
      widget: widget
    } do
      assert {:ok, :on_demand} =
               IntegrationPoller.schedule_poll(%{
                 organization_id: organization.id,
                 widget_id: widget.id,
                 integration_id: integration.id,
                 discriminator_id: "x",
                 widget_options: %{}
               })
    end

    test "removing an integration's schedulers is safe without BullMQ", %{
      integration: integration
    } do
      assert {:ok, 0} = IntegrationPoller.remove_schedulers(integration.id)
    end

    test "a failed on-demand refresh job is recorded, not retried", %{
      integration: integration,
      organization: organization,
      widget: widget
    } do
      store!(integration, organization, "villa", %{refresh_at: ago(1), fetched_at: ago(400)})
      TestOnDemand.fail_with(:timeout)

      job =
        BullMQ.Job.new("integrations", "refresh", %{
          "organization_id" => organization.id,
          "widget_id" => widget.id,
          "integration_id" => integration.id,
          "discriminator_id" => discriminator(integration, organization, "villa"),
          "widget_options" => options("villa")
        })

      assert :ok = IntegrationPoller.process(job)
      assert Refresh.stored(integration, organization.id, options("villa")).refresh_failures == 1
    end

    test "widget.json integrations may declare their refresh mode", %{widget: widget} do
      {:ok, integration} =
        Integrations.create_integration_from_meta(widget.id, "feed", %{
          "fetcher" => "test_on_demand",
          "refresh_mode" => "on_demand",
          "config" => %{"endpoint" => "https://service.test", "refresh_interval" => 600}
        })

      assert integration.refresh_mode == "on_demand"
      assert integration.pull_config["fetcher_module"] == @fetcher

      assert {:error, changeset} =
               Integrations.create_integration(%{
                 integration_attrs(widget)
                 | refresh_mode: "sometimes"
               })

      assert "is invalid" in errors_on(changeset).refresh_mode
    end
  end

  describe "device playlists" do
    test "load on-demand data on first use, with the integration's settings", %{
      organization: organization,
      widget: widget
    } do
      playlist = playlist_fixture(%{organization_id: organization.id})

      {:ok, _item} =
        Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 10_000, %{
          "query" => "villa",
          "service_url" => "http://169.254.169.254"
        })

      [item] = Resources.get_playlist(playlist.id).items

      assert item.config.data["value"] == 1
      assert item.config.data["query"] == "villa"
      assert [%{"service_url" => "https://service.test"}] = TestOnDemand.calls()

      # A second load within the interval uses the stored data.
      [_item] = Resources.get_playlist(playlist.id).items
      assert length(TestOnDemand.calls()) == 1
    end
  end

  defp integration_attrs(widget) do
    %{
      widget_id: widget.id,
      name: "other",
      integration_type: "pull",
      credential_scope: "organization",
      pull_endpoint: "https://service.test",
      pull_interval_seconds: 60,
      refresh_mode: "on_demand"
    }
  end
end
