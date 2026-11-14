defmodule CastmillWeb.WidgetScopeControllerTest do
  @moduledoc """
  Tenant isolation for widget endpoints: organizations only see and use the widgets
  available to them, and only manage the widgets they own.
  """
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.{Accounts, Organizations, Repo, Widgets}
  alias Castmill.Widgets.Widget

  setup %{conn: conn} do
    network = network_fixture()
    org_a = organization_fixture(%{network_id: network.id, name: "Agency A"})
    org_b = organization_fixture(%{network_id: network.id, name: "Agency B"})

    {:ok, user_a} =
      Accounts.create_user(%{
        email: "admin-a-#{System.unique_integer([:positive])}@test.com",
        name: "Admin A",
        network_id: network.id
      })

    {:ok, _} = Organizations.set_user_role(org_a.id, user_a.id, :admin)

    system = widget_fixture(%{is_system: true, name: "System clock"})

    network_widget =
      widget_fixture(%{is_system: false, network_id: network.id, name: "Network news"})

    org_a_widget =
      widget_fixture(%{is_system: false, organization_id: org_a.id, name: "A template"})

    org_b_widget =
      widget_fixture(%{is_system: false, organization_id: org_b.id, name: "B template"})

    unassigned = widget_fixture(%{is_system: false, name: "Orphan"})

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> assign(:current_user, user_a)

    %{
      conn: conn,
      user_a: user_a,
      org_a: org_a,
      org_b: org_b,
      system: system,
      network_widget: network_widget,
      org_a_widget: org_a_widget,
      org_b_widget: org_b_widget,
      unassigned: unassigned
    }
  end

  defp widgets_path(org, suffix \\ ""), do: "/dashboard/organizations/#{org.id}/widgets#{suffix}"

  describe "listing and reading" do
    test "lists only available widgets, with their scope", ctx do
      body =
        ctx.conn
        |> get(widgets_path(ctx.org_a), %{"page_size" => "100"})
        |> json_response(200)

      by_id = Map.new(body["data"], &{&1["id"], &1})

      assert %{"scope" => "system", "can_manage" => false} = by_id[ctx.system.id]
      assert %{"scope" => "network", "can_manage" => false} = by_id[ctx.network_widget.id]
      assert %{"scope" => "organization", "can_manage" => true} = by_id[ctx.org_a_widget.id]
      refute Map.has_key?(by_id, ctx.org_b_widget.id)
      refute Map.has_key?(by_id, ctx.unassigned.id)
      assert body["count"] == map_size(by_id)
    end

    test "another organization's widget is not found", ctx do
      conn = get(ctx.conn, widgets_path(ctx.org_a, "/#{ctx.org_b_widget.id}"))
      assert json_response(conn, 404)
    end

    test "non-members cannot list or read an organization's widgets", ctx do
      assert ctx.conn |> get(widgets_path(ctx.org_b)) |> json_response(403)

      assert ctx.conn
             |> get(widgets_path(ctx.org_b, "/#{ctx.org_b_widget.id}"))
             |> json_response(403)
    end

    test "usage only shows the organization's own playlists", ctx do
      playlist_a = playlist_fixture(%{organization_id: ctx.org_a.id, name: "A screens"})
      playlist_b = playlist_fixture(%{organization_id: ctx.org_b.id, name: "B screens"})

      {:ok, _} =
        Castmill.Resources.insert_item_into_playlist(playlist_a.id, nil, ctx.system.id, 0, 1000)

      {:ok, _} =
        Castmill.Resources.insert_item_into_playlist(playlist_b.id, nil, ctx.system.id, 0, 1000)

      body =
        ctx.conn |> get(widgets_path(ctx.org_a, "/#{ctx.system.id}/usage")) |> json_response(200)

      assert [%{"playlist_name" => "A screens"}] = body["data"]
    end
  end

  describe "managing" do
    test "system, network and other organizations' widgets cannot be deleted", ctx do
      for widget <- [ctx.system, ctx.network_widget, ctx.org_b_widget] do
        conn = delete(ctx.conn, widgets_path(ctx.org_a, "/#{widget.id}"))
        assert json_response(conn, 404)
        assert Repo.get(Widget, widget.id)
      end
    end

    test "system, network and other organizations' widgets cannot be updated", ctx do
      for widget <- [ctx.system, ctx.network_widget, ctx.org_b_widget] do
        conn = patch(ctx.conn, widgets_path(ctx.org_a, "/#{widget.id}"), %{"name" => "Hijacked"})
        assert json_response(conn, 404)
        assert Repo.get!(Widget, widget.id).name == widget.name
      end
    end

    test "own widgets can be renamed but not re-scoped", ctx do
      conn =
        patch(ctx.conn, widgets_path(ctx.org_a, "/#{ctx.org_a_widget.id}"), %{
          "name" => "Renamed",
          "is_system" => true,
          "organization_id" => ctx.org_b.id
        })

      assert %{"name" => "Renamed", "scope" => "organization"} = json_response(conn, 200)
      widget = Repo.get!(Widget, ctx.org_a_widget.id)
      assert {widget.is_system, widget.organization_id} == {false, ctx.org_a.id}
    end

    test "invalid updates are reported, not crashed on", ctx do
      conn = patch(ctx.conn, widgets_path(ctx.org_a, "/#{ctx.org_a_widget.id}"), %{"name" => ""})
      assert %{"errors" => %{"name" => _}} = json_response(conn, 422)
    end

    test "own widgets can be deleted", ctx do
      conn = delete(ctx.conn, widgets_path(ctx.org_a, "/#{ctx.org_a_widget.id}"))
      assert response(conn, 204)
      refute Repo.get(Widget, ctx.org_a_widget.id)
    end
  end

  describe "uploading" do
    defp upload(conn, org, widget_json) do
      path = Path.join(System.tmp_dir!(), "widget-#{System.unique_integer([:positive])}.json")
      File.write!(path, Jason.encode!(widget_json))
      on_exit(fn -> File.rm(path) end)

      post(conn, widgets_path(org), %{
        "widget" => %Plug.Upload{
          path: path,
          filename: "widget.json",
          content_type: "application/json"
        }
      })
    end

    test "uploads become widgets of the uploading organization, never system widgets", ctx do
      conn =
        upload(ctx.conn, ctx.org_a, %{
          "name" => "FB landscape",
          "slug" => "fb-landscape-#{System.unique_integer([:positive])}",
          "template" => %{"type" => "text"},
          "is_system" => true
        })

      assert %{"id" => id, "scope" => "organization", "can_manage" => true} =
               json_response(conn, 201)

      widget = Repo.get!(Widget, id)
      assert {widget.is_system, widget.organization_id} == {false, ctx.org_a.id}
      refute id in Enum.map(Widgets.list_available_widgets(ctx.org_b.id), & &1.id)
    end

    test "an upload cannot take an existing widget's slug", ctx do
      conn =
        upload(ctx.conn, ctx.org_a, %{
          "name" => "Impostor",
          "slug" => ctx.system.slug,
          "template" => %{}
        })

      assert %{"errors" => %{"slug" => ["has already been taken"]}} = json_response(conn, 422)
      assert Repo.get!(Widget, ctx.system.id).name == ctx.system.name
    end

    defp upload_zip(conn, org, widget_json, files) do
      path = Path.join(System.tmp_dir!(), "widget-#{System.unique_integer([:positive])}.zip")

      entries =
        [{~c"widget.json", Jason.encode!(widget_json)}] ++
          Enum.map(files, fn {name, body} -> {String.to_charlist(name), body} end)

      {:ok, _} = :zip.create(String.to_charlist(path), entries)
      on_exit(fn -> File.rm(path) end)

      post(conn, widgets_path(org), %{
        "widget" => %Plug.Upload{
          path: path,
          filename: "widget.zip",
          content_type: "application/zip"
        }
      })
    end

    test "package assets belong to the new widget and cannot be overwritten by later uploads",
         ctx do
      alias Castmill.Widgets.AssetStorage

      slug = "fb-assets-#{System.unique_integer([:positive])}"
      on_exit(fn -> AssetStorage.delete_assets(slug) end)
      icon_file = Path.join(AssetStorage.widget_assets_dir(slug), "assets/icon.svg")

      conn =
        upload_zip(
          ctx.conn,
          ctx.org_a,
          %{
            "name" => "FB assets",
            "slug" => slug,
            "template" => %{},
            "icon" => "assets/icon.svg"
          },
          [{"assets/icon.svg", "<svg>original</svg>"}]
        )

      assert %{"id" => id, "icon" => icon} = json_response(conn, 201)
      assert icon == "/widget_assets/#{slug}/assets/icon.svg"
      assert File.read!(icon_file) == "<svg>original</svg>"

      conn =
        upload_zip(
          ctx.conn,
          ctx.org_a,
          %{"name" => "Impostor", "slug" => slug, "template" => %{}},
          [{"assets/icon.svg", "<svg>impostor</svg>"}]
        )

      assert json_response(conn, 422)
      assert File.read!(icon_file) == "<svg>original</svg>"

      assert ctx.conn |> delete(widgets_path(ctx.org_a, "/#{id}")) |> response(204)
      refute File.exists?(icon_file)
    end

    test "slugs that could escape the assets directory are rejected", ctx do
      conn =
        upload(ctx.conn, ctx.org_a, %{
          "name" => "Traversal",
          "slug" => "../../x",
          "template" => %{}
        })

      assert %{"errors" => %{"slug" => ["has invalid format"]}} = json_response(conn, 422)
    end

    test "asset placeholders in the template become the stored assets' URLs", ctx do
      alias Castmill.Widgets.AssetStorage

      slug = "asset-refs-#{System.unique_integer([:positive])}"
      on_exit(fn -> AssetStorage.delete_assets(slug) end)

      widget = %{
        "name" => "Asset refs #{slug}",
        "slug" => slug,
        "icon" => "{{asset:icons.main}}",
        "small_icon" => "{{asset:icons.main}}",
        "template" => %{
          "type" => "image",
          "name" => "bg",
          "opts" => %{"url" => "{{asset:images.bg}}"}
        },
        "options_schema" => %{
          "image" => %{"type" => "string", "default" => "{{asset:images.bg}}"}
        },
        "translations" => %{"es" => %{"image" => "{{asset:images.bg}}"}},
        "is_system" => true,
        "assets" => %{
          "icons" => %{"main" => %{"path" => "assets/icons/icon.svg"}},
          "images" => %{"bg" => %{"path" => "assets/images/bg.png"}}
        }
      }

      files = [{"assets/icons/icon.svg", "<svg/>"}, {"assets/images/bg.png", "png"}]

      assert %{"id" => id, "icon" => icon, "template" => template} =
               body = ctx.conn |> upload_zip(ctx.org_a, widget, files) |> json_response(201)

      bg = "/widget_assets/#{slug}/assets/images/bg.png"
      assert icon == "/widget_assets/#{slug}/assets/icons/icon.svg"
      assert body["small_icon"] == icon
      assert template["opts"]["url"] == bg
      assert body["options_schema"]["image"]["default"] == bg
      assert body["translations"] == %{"es" => %{"image" => bg}}

      stored = Castmill.Repo.get!(Castmill.Widgets.Widget, id)
      assert stored.small_icon == icon
      assert stored.options_schema["image"]["default"] == bg
      assert stored.organization_id == ctx.org_a.id
      refute stored.is_system

      missing = Map.put(widget, "slug", slug <> "-missing")
      on_exit(fn -> AssetStorage.delete_assets(slug <> "-missing") end)

      assert %{"error" => "Unknown asset reference {{asset:images.bg}}"} =
               ctx.conn
               |> upload_zip(ctx.org_a, missing, [{"assets/icons/icon.svg", "<svg/>"}])
               |> json_response(400)

      refute Castmill.Widgets.get_widget_by_slug(slug <> "-missing")
    end

    test "extracted package assets are cleaned up when an upload is rejected", ctx do
      extracted = fn -> Path.wildcard(Path.join(System.tmp_dir!(), "widget_assets_*")) end
      before = extracted.()

      for slug <- [ctx.system.slug, "../../x"] do
        conn =
          upload_zip(
            ctx.conn,
            ctx.org_a,
            %{"name" => "Rejected", "slug" => slug, "template" => %{}},
            [{"assets/icon.svg", "<svg>rejected</svg>"}]
          )

        assert json_response(conn, 422)
      end

      assert extracted.() -- before == []
    end
  end

  test "playlists cannot use widgets that are not available to the organization", ctx do
    playlist = playlist_fixture(%{organization_id: ctx.org_a.id})

    for widget <- [ctx.org_b_widget, ctx.unassigned] do
      conn =
        post(
          ctx.conn,
          "/dashboard/organizations/#{ctx.org_a.id}/playlists/#{playlist.id}/items",
          %{
            "widget_id" => widget.id,
            "offset" => 0,
            "duration" => 1000,
            "options" => %{}
          }
        )

      assert json_response(conn, 404)
    end
  end

  describe "integrations" do
    setup ctx do
      integration_b =
        widget_integration_fixture(%{widget: ctx.org_b_widget, credential_scope: "organization"})

      %{integration_b: integration_b}
    end

    test "integrations of unavailable widgets are not found", ctx do
      assert ctx.conn
             |> get(widgets_path(ctx.org_a, "/#{ctx.org_b_widget.id}/integrations"))
             |> json_response(404)

      assert ctx.conn
             |> get(widgets_path(ctx.org_a, "/#{ctx.org_b_widget.slug}/credentials-status"))
             |> json_response(404)

      assert ctx.conn
             |> get(
               "/dashboard/organizations/#{ctx.org_a.id}/widget-integrations/#{ctx.integration_b.id}"
             )
             |> json_response(404)

      assert ctx.conn
             |> post(
               "/dashboard/organizations/#{ctx.org_a.id}/widget-integrations/#{ctx.integration_b.id}/credentials",
               %{"credentials" => %{"api_key" => "secret"}}
             )
             |> json_response(404)
    end

    test "non-members cannot read an organization's widget integrations", ctx do
      assert ctx.conn
             |> get(widgets_path(ctx.org_b, "/#{ctx.org_b_widget.id}/integrations"))
             |> json_response(403)

      assert ctx.conn
             |> get(
               "/dashboard/organizations/#{ctx.org_b.id}/widget-integrations/#{ctx.integration_b.id}"
             )
             |> json_response(403)
    end

    test "widget credentials must belong to an integration of the configured widget", ctx do
      playlist = playlist_fixture(%{organization_id: ctx.org_a.id})

      {:ok, item} =
        Castmill.Resources.insert_item_into_playlist(
          playlist.id,
          nil,
          ctx.org_a_widget.id,
          0,
          1000
        )

      widget_scoped =
        widget_integration_fixture(%{widget: ctx.org_b_widget, credential_scope: "widget"})

      conn =
        post(ctx.conn, "/dashboard/widget-configs/#{item.widget_config_id}/credentials", %{
          "integration_id" => widget_scoped.id,
          "credentials" => %{"api_key" => "secret"}
        })

      assert json_response(conn, 404)
    end

    test "widget credentials can be saved for the configured widget's integration", ctx do
      playlist = playlist_fixture(%{organization_id: ctx.org_a.id})

      {:ok, item} =
        Castmill.Resources.insert_item_into_playlist(
          playlist.id,
          nil,
          ctx.org_a_widget.id,
          0,
          1000
        )

      own = widget_integration_fixture(%{widget: ctx.org_a_widget, credential_scope: "widget"})

      conn =
        post(ctx.conn, "/dashboard/widget-configs/#{item.widget_config_id}/credentials", %{
          "integration_id" => own.id,
          "credentials" => %{"api_key" => "secret"}
        })

      assert %{"data" => %{"widget_integration_id" => integration_id}} = json_response(conn, 200)
      assert integration_id == own.id
    end
  end
end
