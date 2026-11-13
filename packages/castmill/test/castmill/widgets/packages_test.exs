defmodule Castmill.Widgets.PackagesTest do
  # Not async: package extraction uses the shared temp directory, which other
  # upload tests inspect.
  use Castmill.DataCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Resources
  alias Castmill.Widgets
  alias Castmill.Widgets.{Integrations, NetworkAccess, PackageProcessor, Packages}

  @logo <<137, 80, 78, 71, 13, 10, 26, 10>>
  @font "wOF2-font"
  @icon ~s(<svg xmlns="http://www.w3.org/2000/svg"/>)

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    slug = "pkg-#{System.unique_integer([:positive])}"
    test = self()

    store = fn key, body, content_type ->
      send(test, {:stored, key, body, content_type})
      {:ok, "https://cdn.test/" <> key}
    end

    delete = fn key ->
      send(test, {:deleted, key})
      :ok
    end

    %{
      network: network,
      organization: organization,
      slug: slug,
      store: store,
      delete: delete
    }
  end

  defp widget_json(ctx, overrides \\ %{}) do
    Map.merge(
      %{
        "name" => "Listing #{ctx.slug}",
        "slug" => ctx.slug,
        "icon" => "assets/icons/icon.svg",
        "template" => %{
          "type" => "group",
          "name" => "root",
          "style" => %{"background-image" => "url({{asset:images.logo}})"},
          "components" => [
            %{
              "type" => "image",
              "name" => "logo",
              "opts" => %{"url" => "{{ asset:images.logo }}"}
            }
          ]
        },
        "options_schema" => %{"title" => %{"type" => "string", "default" => "Hi"}},
        "assets" => %{
          "icons" => %{"main" => %{"path" => "assets/icons/icon.svg"}},
          "images" => %{"logo" => %{"path" => "assets/images/logo.png"}},
          "fonts" => %{"body" => %{"path" => "assets/fonts/Body.woff2", "name" => "Body"}}
        },
        "integration" => %{
          "name" => "listing",
          "fetcher" => "test_choices",
          "refresh_mode" => "on_demand",
          "credential_schema" => %{"auth_type" => "none"},
          "config" => %{"auth_type" => "none", "max" => 1}
        },
        "meta" => %{"managed_by" => "package"},
        "is_system" => true,
        "organization_id" => ctx.organization.id
      },
      overrides
    )
  end

  defp zip(widget, extra_files \\ []) do
    path = Path.join(System.tmp_dir!(), "package-#{System.unique_integer([:positive])}.zip")

    files =
      [
        {~c"widget.json", Jason.encode!(widget)},
        {~c"assets/icons/icon.svg", @icon},
        {~c"assets/images/logo.png", @logo},
        {~c"assets/fonts/Body.woff2", @font}
      ] ++ extra_files

    {:ok, _} = :zip.create(String.to_charlist(path), files)
    on_exit(fn -> File.rm(path) end)
    %Plug.Upload{path: path, filename: "listing.zip", content_type: "application/zip"}
  end

  defp json(widget) do
    path = Path.join(System.tmp_dir!(), "package-#{System.unique_integer([:positive])}.json")
    File.write!(path, Jason.encode!(widget))
    on_exit(fn -> File.rm(path) end)
    %Plug.Upload{path: path, filename: "widget.json", content_type: "application/json"}
  end

  defp text_widget(ctx) do
    widget_json(ctx)
    |> Map.drop(["assets", "icon", "integration"])
    |> Map.put("template", %{"type" => "text", "name" => "t", "opts" => %{"text" => "Hi"}})
  end

  defp install(ctx, upload, opts \\ []),
    do:
      Packages.install(
        ctx.network.id,
        upload,
        Keyword.merge([store: ctx.store, delete: ctx.delete], opts)
      )

  defp stored_keys do
    receive do
      {:stored, key, _body, _type} -> [key | stored_keys()]
    after
      0 -> []
    end
  end

  defp deleted_keys do
    receive do
      {:deleted, key} -> [key | deleted_keys()]
    after
      0 -> []
    end
  end

  defp use_widget(ctx, widget, options) do
    {:ok, _} = NetworkAccess.set_access(ctx.network.id, widget.id, "all")
    playlist = playlist_fixture(%{organization_id: ctx.organization.id, name: "Lobby"})

    {:ok, _} =
      Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1000, options)

    playlist
  end

  describe "install/3" do
    test "installs a package as a hidden network widget with stored assets", ctx do
      user = user_fixture()
      upload = zip(widget_json(ctx))

      assert {:ok, %{widget: widget, created: true, version: 1, warnings: []}} =
               install(ctx, upload, uploaded_by: user.id)

      assert widget.network_id == ctx.network.id
      refute widget.is_system
      assert is_nil(widget.organization_id)
      refute Packages.managed?(widget)

      assert_received {:stored, "widget-assets/" <> logo_key, @logo, "image/png"}
      assert_received {:stored, "widget-assets/" <> _icon, @icon, "image/svg+xml"}
      assert_received {:stored, "widget-assets/" <> _font, @font, "font/woff2"}

      logo = "https://cdn.test/widget-assets/" <> logo_key
      assert logo =~ ~r"/#{ctx.slug}/[0-9a-f]{16}/images/logo.png$"
      assert widget.template["style"]["background-image"] == "url(#{logo})"
      assert hd(widget.template["components"])["opts"]["url"] == logo
      assert widget.icon =~ ~r"^https://cdn.test/widget-assets/#{ctx.slug}/.+/icons/icon.svg$"
      assert [%{"name" => "Body", "url" => "https://cdn.test/" <> _}] = widget.fonts

      assert NetworkAccess.get_widget(ctx.network.id, widget.id).access == "hidden"

      integration = Integrations.get_integration_by_widget_and_name(widget.id, "listing")

      assert integration.pull_config["fetcher_module"] ==
               "Castmill.Widgets.Integrations.Fetchers.TestChoices"

      assert integration.pull_config["max"] == 1
      assert integration.credential_schema == %{"auth_type" => "none"}
      assert integration.refresh_mode == "on_demand"
      assert is_nil(integration.pull_endpoint)

      assert [%{version: 1, filename: "listing.zip", uploaded_by_id: uploaded_by}] =
               Packages.list_versions(widget.id)

      assert uploaded_by == user.id
      assert Packages.get_version(widget.id, 1).content == File.read!(upload.path)

      urls = [widget.icon, hd(widget.fonts)["url"], logo]

      assert Enum.sort(Packages.get_version(widget.id, 1).asset_keys) ==
               urls
               |> Enum.map(&String.replace_prefix(&1, "https://cdn.test/", ""))
               |> Enum.sort()

      assert is_nil(Packages.get_version(widget.id, 2))
      widget_id = widget.id
      assert %{^widget_id => %{version: 1}} = Packages.latest_versions([widget.id])
      assert Packages.latest_versions([]) == %{}
    end

    test "installs plain widget.json packages", ctx do
      assert {:ok, %{widget: installed, created: true}} = install(ctx, json(text_widget(ctx)))
      refute_received {:stored, _, _, _}
      assert installed.fonts == []
      assert is_nil(Integrations.get_integration_by_widget_and_name(installed.id, "listing"))
    end

    test "a new version updates the widget and its integration and keeps its access", ctx do
      {:ok, %{widget: widget}} = install(ctx, zip(widget_json(ctx)))
      {:ok, _} = NetworkAccess.set_access(ctx.network.id, widget.id, "all")

      update =
        widget_json(ctx, %{
          "description" => "Rotates listings",
          "integration" => %{
            "name" => "listing",
            "fetcher" => "test_choices",
            "config" => %{"max" => 3}
          }
        })
        |> Map.delete("icon")

      assert {:ok, %{widget: updated, created: false, version: 2}} = install(ctx, zip(update))
      assert updated.id == widget.id
      assert updated.description == "Rotates listings"
      assert is_nil(updated.icon)
      assert NetworkAccess.get_widget(ctx.network.id, widget.id).access == "all"

      integration = Integrations.get_integration_by_widget_and_name(widget.id, "listing")
      assert integration.pull_config["max"] == 3
      assert integration.refresh_mode == "scheduled"
      assert Enum.map(Packages.list_versions(widget.id), & &1.version) == [2, 1]
    end

    test "keeps the last 10 versions and deletes assets only older versions used", ctx do
      {:ok, _} = install(ctx, zip(widget_json(ctx)))
      first_keys = stored_keys()
      assert length(first_keys) == 3

      upload = json(text_widget(ctx))
      for _ <- 2..10, do: assert({:ok, _} = install(ctx, upload))
      assert deleted_keys() == []

      assert {:ok, %{version: 11}} = install(ctx, upload)

      widget = Widgets.get_widget_by_slug(ctx.slug)
      assert Enum.map(Packages.list_versions(widget.id), & &1.version) == Enum.to_list(11..2//-1)
      assert Enum.sort(deleted_keys()) == Enum.sort(first_keys)
    end

    test "deletes the assets of refused uploads unless a kept version uses them", ctx do
      {:ok, %{widget: widget}} = install(ctx, zip(widget_json(ctx)))
      kept = stored_keys()
      use_widget(ctx, widget, %{})

      required =
        widget_json(ctx, %{
          "options_schema" => %{"estate" => %{"type" => "string", "required" => true}}
        })
        |> put_in(["assets", "images", "photo"], %{"path" => "assets/images/photo.png"})

      assert {:error, {:incompatible, [_]}} =
               install(ctx, zip(required, [{~c"assets/images/photo.png", "photo"}]))

      assert [photo] = stored_keys() -- kept
      assert photo =~ ~r"/images/photo.png$"
      assert deleted_keys() == [photo]

      # A new widget that can't be installed keeps nothing.
      other = %{ctx | slug: "#{ctx.slug}-other"}
      invalid = widget_json(other, %{"options_schema" => %{"x" => "nope"}})
      assert {:error, %Ecto.Changeset{}} = install(other, zip(invalid))
      assert Enum.sort(deleted_keys()) == Enum.sort(stored_keys())
    end

    test "deletes the stored assets when storing one fails", ctx do
      # Files are stored in path order, so the logo is stored last.
      store = fn key, body, type ->
        if type == "image/png", do: {:error, :unavailable}, else: ctx.store.(key, body, type)
      end

      assert {:error, "Failed to store asset assets/images/logo.png" <> _} =
               install(ctx, zip(widget_json(ctx)), store: store)

      stored = stored_keys()
      assert length(stored) == 2
      assert Enum.sort(deleted_keys()) == Enum.sort(stored)
    end

    test "refuses slugs used by other scopes and widgets the platform manages", ctx do
      other = network_fixture()
      upload = fn slug -> zip(widget_json(%{ctx | slug: slug})) end

      for attrs <- [
            %{is_system: false, network_id: other.id},
            %{is_system: false, organization_id: ctx.organization.id},
            %{is_system: true}
          ] do
        widget = widget_fixture(Map.put(attrs, :name, "Taken #{System.unique_integer()}"))
        assert {:error, :slug_taken} = install(ctx, upload.(widget.slug))
      end

      managed =
        widget_fixture(%{
          is_system: false,
          network_id: ctx.network.id,
          name: "Managed #{System.unique_integer()}",
          meta: %{"managed_by" => "castmill-saas"}
        })

      assert Packages.managed?(managed)
      assert {:error, :managed_widget} = install(ctx, upload.(managed.slug))
      assert {:error, :invalid_slug} = install(ctx, upload.("bad slug!"))
    end

    test "refuses unknown fetchers, asset references and invalid widgets", ctx do
      unknown_fetcher = widget_json(ctx, %{"integration" => %{"fetcher" => "nope"}})
      assert {:error, {:unknown_fetcher, "nope"}} = install(ctx, zip(unknown_fetcher))

      outside =
        widget_json(ctx, %{
          "integration" => %{"fetcher" => "Elixir.Castmill.Repo"}
        })

      assert {:error, {:unknown_fetcher, _}} = install(ctx, zip(outside))

      assert {:error, :invalid_integration} =
               install(ctx, zip(widget_json(ctx, %{"integration" => "rss"})))

      missing =
        widget_json(ctx, %{
          "template" => %{
            "type" => "image",
            "name" => "i",
            "opts" => %{"url" => "{{asset:images.nope}}"}
          }
        })

      assert {:error, "Unknown asset reference {{asset:images.nope}}"} =
               install(ctx, zip(missing))

      no_font =
        put_in(
          widget_json(ctx),
          ["assets", "fonts", "body", "path"],
          "assets/fonts/Missing.woff2"
        )

      assert {:error, "Unknown font asset assets/fonts/Missing.woff2"} =
               install(ctx, zip(no_font))

      assert {:error, %Ecto.Changeset{}} =
               install(ctx, zip(widget_json(ctx, %{"options_schema" => %{"x" => "nope"}})))

      assert {:error, "Widget must have a 'template' field"} =
               install(ctx, json(Map.delete(widget_json(ctx), "template")))

      assert is_nil(Widgets.get_widget_by_slug(ctx.slug))
    end

    test "reports storage failures", ctx do
      store = fn _key, _body, _type -> {:error, :unavailable} end

      assert {:error, "Failed to store asset assets/" <> _} =
               install(ctx, zip(widget_json(ctx)), store: store)
    end

    test "refuses updates that would make saved items invalid", ctx do
      {:ok, %{widget: widget}} = install(ctx, zip(widget_json(ctx)))
      playlist = use_widget(ctx, widget, %{"title" => "Hello"})

      required =
        widget_json(ctx, %{
          "options_schema" => %{
            "title" => %{"type" => "string"},
            "estate" => %{"type" => "string", "required" => true}
          }
        })

      assert {:error, {:incompatible, [item]}} = install(ctx, zip(required))

      assert item == %{
               playlist_id: playlist.id,
               playlist_name: "Lobby",
               organization_id: ctx.organization.id,
               error: "Field estate is required but missing"
             }

      assert Enum.map(Packages.list_versions(widget.id), & &1.version) == [1]

      # Saved items lack the new option, so it can't be required (even with a default).
      with_default = put_in(required, ["options_schema", "estate", "default"], "1")
      assert {:error, {:incompatible, [_]}} = install(ctx, zip(with_default))

      optional = put_in(required, ["options_schema", "estate"], %{"type" => "string"})
      assert {:ok, %{version: 2}} = install(ctx, zip(optional))
    end

    test "refuses updates that would shorten saved editable texts", ctx do
      editable = fn max ->
        widget_json(ctx, %{
          "template" => %{
            "type" => "text",
            "name" => "price",
            "opts" => %{"text" => "1"},
            "editable" => %{"key" => "price", "label" => "Price", "max_length" => max}
          }
        })
      end

      {:ok, %{widget: widget}} = install(ctx, zip(editable.(20)))
      use_widget(ctx, widget, %{"overrides" => %{"price" => %{"text" => "On request"}}})

      assert {:error, {:incompatible, [%{error: error}]}} = install(ctx, zip(editable.(5)))
      assert error =~ "price"
    end
  end

  describe "delete_network_widget/2" do
    test "deletes uploaded widgets that no playlist uses", ctx do
      {:ok, %{widget: widget}} = install(ctx, zip(widget_json(ctx)))
      other = network_fixture()

      assert {:error, :not_found} = Packages.delete_network_widget(other.id, widget.id)
      assert {:error, :not_found} = Packages.delete_network_widget(ctx.network.id, "x")

      playlist = use_widget(ctx, widget, %{})
      organization_id = ctx.organization.id

      assert {:error, {:in_use, [^organization_id]}} =
               Packages.delete_network_widget(ctx.network.id, widget.id)

      Castmill.Repo.delete!(playlist)
      stored = stored_keys()
      assert deleted_keys() == []

      assert {:ok, _} =
               Packages.delete_network_widget(ctx.network.id, to_string(widget.id),
                 delete: ctx.delete
               )

      assert is_nil(Widgets.get_widget_by_slug(ctx.slug))
      assert Packages.list_versions(widget.id) == []
      assert Enum.sort(deleted_keys()) == Enum.sort(stored)
    end

    test "logs the assets it can't delete", ctx do
      {:ok, %{widget: widget}} = install(ctx, zip(widget_json(ctx)))
      failing = fn _key -> {:error, :unavailable} end

      log =
        ExUnit.CaptureLog.capture_log(fn ->
          assert {:ok, _} =
                   Packages.delete_network_widget(ctx.network.id, widget.id, delete: failing)
        end)

      assert log =~ "Could not delete asset widget-assets/#{ctx.slug}/"
      assert is_nil(Widgets.get_widget_by_slug(ctx.slug))
    end

    test "never deletes widgets the platform manages", ctx do
      managed =
        widget_fixture(%{
          is_system: false,
          network_id: ctx.network.id,
          name: "Managed #{System.unique_integer()}",
          meta: %{"managed_by" => "castmill-saas"}
        })

      assert {:error, :managed_widget} =
               Packages.delete_network_widget(ctx.network.id, managed.id)
    end
  end

  describe "PackageProcessor" do
    test "ignores package files outside assets/" do
      path = Path.join(System.tmp_dir!(), "slip-#{System.unique_integer([:positive])}.zip")

      {:ok, _} =
        :zip.create(String.to_charlist(path), [
          {~c"widget.json", ~s({"name": "x", "template": {}})},
          {~c"assets/../../escaped.png", @logo},
          {~c"assets/images/ok.png", @logo}
        ])

      on_exit(fn -> File.rm(path) end)

      assert {:ok, _data, %{files: files} = assets} = PackageProcessor.process_zip_package(path)
      assert Map.keys(files) == ["assets/images/ok.png"]
      PackageProcessor.cleanup_assets(assets)
    end

    test "resolves asset references anywhere but in the declaration" do
      data = %{
        "assets" => %{"images" => %{"bg" => %{"path" => "assets/bg.png"}}, "fonts" => []},
        "template" => %{"a" => ["x {{asset:images.bg}} y", 1, nil]},
        "icon" => "{{asset:images.bg}}"
      }

      url_for = fn "assets/bg.png" -> "/u/bg.png" end

      assert {:ok, resolved} = PackageProcessor.resolve_asset_references(data, url_for)
      assert resolved["template"] == %{"a" => ["x /u/bg.png y", 1, nil]}
      assert resolved["icon"] == "/u/bg.png"
      assert resolved["assets"] == data["assets"]

      assert {:ok, %{"t" => "plain"}} =
               PackageProcessor.resolve_asset_references(%{"t" => "plain"}, url_for)

      assert {:error, "Unknown asset reference {{asset:fonts.bg}}"} =
               PackageProcessor.resolve_asset_references(
                 %{"assets" => "nope", "t" => "{{asset:fonts.bg}}"},
                 url_for
               )
    end
  end
end
