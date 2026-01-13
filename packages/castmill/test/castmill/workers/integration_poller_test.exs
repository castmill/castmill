defmodule Castmill.Workers.IntegrationPollerTest do
  use Castmill.DataCase, async: true

  import Ecto.Query
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Repo
  alias Castmill.Widgets.Integrations.WidgetIntegrationData
  alias Castmill.Workers.IntegrationPoller

  test "process stores refresh_at relative to fetched_at" do
    organization = organization_fixture()
    suffix = System.unique_integer([:positive])

    widget =
      widget_fixture(%{
        name: "RSS Test #{suffix}",
        slug: "rss-test-#{suffix}",
        template: %{"type" => "group"}
      })

    integration =
      widget_integration_fixture(%{
        widget_id: widget.id,
        name: "rss-test-#{suffix}",
        pull_interval_seconds: 120,
        pull_config: %{
          "auth_type" => "optional",
          "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.TestStub"
        }
      })

    discriminator = "feed_url:https://example.com/rss"

    # Create a BullMQ job structure for testing
    # NOTE: Based on BullMQ Elixir v1.2 Job structure
    job = %BullMQ.Job{
      id: "test-job-id",
      name: "integration_poll",
      data: %{
        "organization_id" => organization.id,
        "widget_id" => widget.id,
        "integration_id" => integration.id,
        "discriminator_id" => discriminator,
        "widget_options" => %{"feed_url" => "https://example.com/rss"}
      },
      opts: %{},
      queue: "integrations",
      timestamp: System.system_time(:millisecond),
      attempts_made: 0
    }

    assert :ok = IntegrationPoller.process(job)

    data =
      WidgetIntegrationData.base_query()
      |> where(
        [wid],
        wid.widget_integration_id == ^integration.id and wid.discriminator_id == ^discriminator
      )
      |> Repo.one()

    assert data.refresh_at
    assert data.fetched_at
    assert_in_delta DateTime.diff(data.refresh_at, data.fetched_at), 120, 1
  end
end
