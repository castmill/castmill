defmodule Castmill.Widgets.Integrations.ChoicesTest do
  use Castmill.DataCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Repo
  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.{Choices, ChoicesStore, WidgetIntegration}

  @provider "Castmill.Widgets.Integrations.Fetchers.TestChoices"

  setup do
    ChoicesStore.clear()
    previous = Application.get_env(:castmill, Choices)

    on_exit(fn ->
      if previous,
        do: Application.put_env(:castmill, Choices, previous),
        else: Application.delete_env(:castmill, Choices)

      ChoicesStore.clear()
    end)

    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    {:ok, organization: organization}
  end

  defp put_config(config), do: Application.put_env(:castmill, Choices, config)

  defp choices_widget(list, opts \\ []) do
    fetcher_config =
      Map.merge(
        %{
          "auth_type" => "none",
          "base_url" => "https://source.example",
          "endpoint" => "https://source.example/api"
        },
        Keyword.get(opts, :config, %{})
      )

    widget_fixture(%{
      options_schema: %{
        "office" => "string",
        "listing" => %{
          "type" => "string",
          "choices" => %{"list" => list, "display" => "cards", "search" => true}
        },
        "photos" => %{
          "type" => "list",
          "items" => %{"type" => "string"},
          "choices" => %{
            "list" => list,
            "display" => "grid",
            "multiple" => true,
            "ordered" => true,
            "depends_on" => ["listing"]
          }
        }
      },
      meta: %{"integration" => %{"fetcher" => @provider, "config" => fetcher_config}}
    })
  end

  describe "list/5" do
    test "pages and searches provider choices", %{organization: organization} do
      widget = choices_widget("photos")

      assert {:ok, %{items: [first, second], next: "2"}} =
               Choices.list(organization.id, widget, "listing", %{})

      assert first == %{
               value: "photo-1",
               label: "Photo 1",
               thumbnail_url: "https://img.example/photo-1?w=320",
               preview: %{type: "image", url: "https://img.example/photo-1?w=1920"}
             }

      assert second.value == "photo-2"

      assert {:ok, %{items: [%{value: "photo-5"}], next: nil}} =
               Choices.list(organization.id, widget, "listing", %{"cursor" => "4"})

      assert {:ok, %{items: [%{value: "photo-3"}], next: nil}} =
               Choices.list(organization.id, widget, "listing", %{"query" => "  Photo 3 "})
    end

    test "rejects fields without choices", %{organization: organization} do
      widget = choices_widget("photos")

      assert {:error, :not_a_choice_field} = Choices.list(organization.id, widget, "office", %{})
      assert {:error, :not_a_choice_field} = Choices.list(organization.id, widget, "nope", %{})
    end

    test "requires dependency values", %{organization: organization} do
      widget = choices_widget("photos")

      for options <- [nil, %{}, %{"listing" => ""}, %{"listing" => []}] do
        assert {:error, :missing_dependency} =
                 Choices.list(organization.id, widget, "photos", %{"options" => options})
      end
    end

    test "forwards only dependencies, lets pull_config win and passes credentials", %{
      organization: organization
    } do
      widget = choices_widget("echo", config: %{"auth_type" => "optional"})
      {:ok, integration} = Integrations.ensure_integration_for_widget(widget)

      {:ok, _} =
        Integrations.upsert_organization_credentials(organization.id, integration.id, %{
          "office_id" => "7"
        })

      assert {:ok, %{items: [item], next: nil}} =
               Choices.list(organization.id, widget, "photos", %{
                 "options" => %{
                   "listing" => "L1",
                   "office" => "not forwarded",
                   "base_url" => "https://attacker.example"
                 },
                 "query" => 42,
                 "cursor" => 7,
                 "values" => ["a", "", 3, "b"]
               })

      assert Jason.decode!(item.label) == %{"office_id" => "7"}
      params = Jason.decode!(item.description)

      assert params["query"] == ""
      assert params["cursor"] == nil
      assert params["values"] == ["a", "b"]
      assert params["options"]["listing"] == "L1"
      assert params["options"]["base_url"] == "https://source.example"
      assert params["options"]["display_locale"]
      refute Map.has_key?(params["options"], "office")
    end

    test "accepts a single string value", %{organization: organization} do
      widget = choices_widget("echo")

      assert {:ok, %{items: [item]}} =
               Choices.list(organization.id, widget, "listing", %{"values" => "x"})

      assert Jason.decode!(item.description)["values"] == ["x"]
    end

    test "caches results per params", %{organization: organization} do
      widget = choices_widget("echo")

      {:ok, %{items: [first]}} = Choices.list(organization.id, widget, "listing", %{})
      {:ok, %{items: [cached]}} = Choices.list(organization.id, widget, "listing", %{})

      {:ok, %{items: [other]}} =
        Choices.list(organization.id, widget, "listing", %{"query" => "x"})

      assert first.value == cached.value
      refute first.value == other.value
    end

    test "does not cache when the cache ttl is disabled", %{organization: organization} do
      put_config(cache_ttl: 0)
      widget = choices_widget("echo")

      {:ok, %{items: [first]}} = Choices.list(organization.id, widget, "listing", %{})
      {:ok, %{items: [second]}} = Choices.list(organization.id, widget, "listing", %{})

      refute first.value == second.value
    end

    test "times out slow providers", %{organization: organization} do
      put_config(timeout: 50)
      widget = choices_widget("slow")

      assert {:error, :provider_error} = Choices.list(organization.id, widget, "listing", %{})
    end

    test "maps provider failures to provider_error", %{organization: organization} do
      for list <- ["fail", "raise", "exit", "invalid", "no-items"] do
        widget = choices_widget(list)

        assert {:error, :provider_error} = Choices.list(organization.id, widget, "listing", %{}),
               "list #{list}"
      end
    end

    test "sanitizes provider items", %{organization: organization} do
      widget = choices_widget("messy")

      assert {:ok, %{items: items, next: nil}} =
               Choices.list(organization.id, widget, "listing", %{})

      assert items == [
               %{value: "42", label: "42"},
               %{value: "a", label: "A"},
               %{
                 value: "b",
                 label: "B",
                 thumbnail_url: "https://cdn.example/b.jpg",
                 preview: %{
                   type: "font",
                   url: "https://cdn.example/b.woff2",
                   mime_type: "font/woff2"
                 },
                 disabled: true
               }
             ]
    end

    test "allows http urls only when configured", %{organization: organization} do
      put_config(allow_http: true)
      widget = choices_widget("messy")

      assert {:ok, %{items: [_, %{value: "a"} = item, _]}} =
               Choices.list(organization.id, widget, "listing", %{})

      assert item.thumbnail_url == "http://insecure.example/a.jpg"
      refute Map.has_key?(item, :preview)
    end

    test "rate limits per actor", %{organization: organization} do
      put_config(rate_limit: 2)
      widget = choices_widget("photos")
      actor = Ecto.UUID.generate()

      assert {:ok, _} = Choices.list(organization.id, widget, "listing", %{}, actor_id: actor)
      assert {:ok, _} = Choices.list(organization.id, widget, "listing", %{}, actor_id: actor)

      assert {:error, :rate_limited} =
               Choices.list(organization.id, widget, "listing", %{}, actor_id: actor)

      assert {:ok, _} =
               Choices.list(organization.id, widget, "listing", %{},
                 actor_id: Ecto.UUID.generate()
               )
    end

    test "requires credentials unless auth is optional", %{organization: organization} do
      widget = choices_widget("photos", config: %{"auth_type" => "api_key"})

      assert {:error, :no_credentials} = Choices.list(organization.id, widget, "listing", %{})
    end

    test "requires an active pull integration with a choices provider", %{
      organization: organization
    } do
      widget = choices_widget("photos")
      {:ok, integration} = Integrations.ensure_integration_for_widget(widget)

      integration
      |> WidgetIntegration.changeset(%{is_active: false})
      |> Repo.update!()

      assert {:error, :no_provider} = Choices.list(organization.id, widget, "listing", %{})

      integration
      |> WidgetIntegration.changeset(%{
        is_active: true,
        pull_config: %{
          "auth_type" => "none",
          "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.TestStub"
        }
      })
      |> Repo.update!()

      assert {:error, :no_provider} = Choices.list(organization.id, widget, "listing", %{})
    end

    test "creates the widget's integration when missing", %{organization: organization} do
      widget = choices_widget("photos")

      assert [] = Integrations.list_integrations(widget_id: widget.id)
      assert {:ok, %{items: [_, _]}} = Choices.list(organization.id, widget, "listing", %{})
      assert [_] = Integrations.list_integrations(widget_id: widget.id)
    end
  end

  describe "provider_module/1 and provider_for_meta?/1" do
    test "only resolves loaded fetchers that implement choices/3" do
      assert {:ok, Castmill.Widgets.Integrations.Fetchers.TestChoices} =
               Choices.provider_module(@provider)

      assert {:ok, _} = Choices.provider_module("Elixir." <> @provider)
      assert :error = Choices.provider_module("Castmill.Widgets.Integrations.Fetchers.TestStub")
      assert :error = Choices.provider_module("Castmill.Widgets.Integrations.Fetchers.Missing")
      assert :error = Choices.provider_module("Castmill.Repo")
      assert :error = Choices.provider_module("Castmill.Widgets.Integrations.Fetchers.A-B")
      assert :error = Choices.provider_module(nil)
    end

    test "reads the fetcher from widget meta" do
      assert Choices.provider_for_meta?(%{"integration" => %{"fetcher" => @provider}})
      assert Choices.provider_for_meta?(%{integration: %{fetcher: @provider}})
      refute Choices.provider_for_meta?(%{"integration" => %{"fetcher" => "rss"}})
      refute Choices.provider_for_meta?(%{"integration" => "nope"})
      refute Choices.provider_for_meta?(%{})
      refute Choices.provider_for_meta?(nil)
    end
  end

  describe "safe_url/1" do
    test "accepts https urls with a host" do
      assert Choices.safe_url("https://cdn.example/a.jpg") == "https://cdn.example/a.jpg"
      refute Choices.safe_url("http://cdn.example/a.jpg")
      refute Choices.safe_url("https:///a.jpg")
      refute Choices.safe_url("data:image/png;base64,AAAA")
      refute Choices.safe_url("https://cdn.example/" <> String.duplicate("a", 3_000))
      refute Choices.safe_url(nil)
    end
  end

  describe "ChoicesStore" do
    test "expires cached values and prunes old entries" do
      ChoicesStore.put(:key, :value, 60_000)
      ChoicesStore.put(:ignored, :value, 0)
      assert {:ok, :value} = ChoicesStore.get(:key)
      assert :miss = ChoicesStore.get(:ignored)

      ChoicesStore.prune(System.system_time(:millisecond) + 120_000)
      assert :miss = ChoicesStore.get(:key)
    end

    test "resets rate windows" do
      actor = Ecto.UUID.generate()
      assert :ok = ChoicesStore.allow(actor, 1, 60_000)
      assert {:error, :rate_limited} = ChoicesStore.allow(actor, 1, 60_000)

      ChoicesStore.prune(System.system_time(:millisecond) + 120_000)
      assert :ok = ChoicesStore.allow(actor, 1, 60_000)
    end

    test "degrades to cache misses and allowed requests when not running" do
      :ok = Supervisor.terminate_child(Castmill.Supervisor, ChoicesStore)
      on_exit(fn -> Supervisor.restart_child(Castmill.Supervisor, ChoicesStore) end)

      assert :miss = ChoicesStore.get(:key)
      assert :ok = ChoicesStore.put(:key, :value, 1_000)
      assert :ok = ChoicesStore.allow(Ecto.UUID.generate(), 0)
      assert :ok = ChoicesStore.clear()

      {:ok, _} = Supervisor.restart_child(Castmill.Supervisor, ChoicesStore)
    end

    test "runs its periodic prune" do
      ChoicesStore.put(:periodic, :value, 1)
      Process.sleep(5)
      send(ChoicesStore, :prune)
      :sys.get_state(ChoicesStore)
      assert :miss = ChoicesStore.get(:periodic)
    end
  end
end
