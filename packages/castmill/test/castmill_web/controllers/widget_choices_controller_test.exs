defmodule CastmillWeb.WidgetChoicesControllerTest do
  use CastmillWeb.ConnCase, async: false

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Organizations
  alias Castmill.Widgets.Integrations.{Choices, ChoicesStore}

  setup %{conn: conn} do
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

    widget =
      widget_fixture(%{
        is_system: true,
        options_schema: %{
          "listing" => %{"type" => "string", "choices" => %{"list" => "photos"}},
          "photos" => %{
            "type" => "list",
            "items" => "string",
            "choices" => %{"list" => "fail", "multiple" => true, "depends_on" => ["listing"]}
          },
          "title" => "string"
        },
        meta: %{
          "integration" => %{
            "fetcher" => "Castmill.Widgets.Integrations.Fetchers.TestChoices",
            "config" => %{"auth_type" => "none", "endpoint" => "https://source.example/api"}
          }
        }
      })

    {:ok,
     conn: put_req_header(conn, "accept", "application/json"),
     organization: organization,
     widget: widget}
  end

  defp authenticate(conn, organization, role) do
    user = user_fixture(%{organization_id: organization.id})
    {:ok, _} = Organizations.add_user(organization.id, user.id, role)
    secret = "token-" <> Ecto.UUID.generate()
    access_token_fixture(%{secret: secret, user_id: user.id, is_root: false})
    put_req_header(conn, "authorization", "Bearer " <> secret)
  end

  defp choices_path(organization, widget, field),
    do: "/dashboard/organizations/#{organization.id}/widgets/#{widget}/choices/#{field}"

  test "lists choices for playlist editors", %{
    conn: conn,
    organization: organization,
    widget: widget
  } do
    conn =
      conn
      |> authenticate(organization, :editor)
      |> post(choices_path(organization, widget.id, "listing"), %{"query" => "", "values" => []})

    assert %{"items" => [first, _], "next" => "2"} = json_response(conn, 200)

    assert first == %{
             "value" => "photo-1",
             "label" => "Photo 1",
             "thumbnail_url" => "https://img.example/photo-1?w=320",
             "preview" => %{"type" => "image", "url" => "https://img.example/photo-1?w=1920"}
           }
  end

  test "resolves widgets by slug", %{conn: conn, organization: organization, widget: widget} do
    conn =
      conn
      |> authenticate(organization, :admin)
      |> post(choices_path(organization, widget.slug, "listing"), %{})

    assert %{"items" => [_, _]} = json_response(conn, 200)
  end

  test "requires permission to update playlists", %{
    conn: conn,
    organization: organization,
    widget: widget
  } do
    conn =
      conn
      |> authenticate(organization, :guest)
      |> post(choices_path(organization, widget.id, "listing"), %{})

    assert json_response(conn, 403)
  end

  test "rejects members of other organizations", %{conn: conn, widget: widget} do
    other = organization_fixture(%{network_id: network_fixture().id})
    organization = organization_fixture(%{network_id: network_fixture().id})

    conn =
      conn
      |> authenticate(other, :admin)
      |> post(choices_path(organization, widget.id, "listing"), %{})

    assert json_response(conn, 403)
  end

  test "returns error codes", %{conn: conn, organization: organization, widget: widget} do
    conn = authenticate(conn, organization, :admin)

    assert %{"error" => "widget_not_found"} =
             conn |> post(choices_path(organization, 0, "listing"), %{}) |> json_response(404)

    assert %{"error" => "widget_not_found"} =
             conn
             |> post(choices_path(organization, "missing-slug", "listing"), %{})
             |> json_response(404)

    assert %{"error" => "not_a_choice_field"} =
             conn
             |> post(choices_path(organization, widget.id, "title"), %{})
             |> json_response(404)

    assert %{"error" => "missing_dependency"} =
             conn
             |> post(choices_path(organization, widget.id, "photos"), %{})
             |> json_response(422)

    assert %{"error" => "provider_error"} =
             conn
             |> post(choices_path(organization, widget.id, "photos"), %{
               "options" => %{"listing" => "L"}
             })
             |> json_response(502)
  end

  test "hides widgets the organization cannot use", %{
    conn: conn,
    organization: organization,
    widget: widget
  } do
    other = organization_fixture(%{network_id: network_fixture().id})

    private =
      widget_fixture(%{
        is_system: false,
        organization_id: other.id,
        options_schema: widget.options_schema,
        meta: widget.meta
      })

    conn = authenticate(conn, organization, :admin)

    assert %{"error" => "widget_not_found"} =
             conn
             |> post(choices_path(organization, private.id, "listing"), %{})
             |> json_response(404)

    assert %{"error" => "widget_not_found"} =
             conn
             |> post(choices_path(organization, private.slug, "listing"), %{})
             |> json_response(404)
  end

  test "reports missing credentials", %{conn: conn, organization: organization} do
    widget =
      widget_fixture(%{
        is_system: true,
        options_schema: %{"listing" => %{"type" => "string", "choices" => %{"list" => "photos"}}},
        meta: %{
          "integration" => %{
            "fetcher" => "Castmill.Widgets.Integrations.Fetchers.TestChoices",
            "config" => %{"auth_type" => "api_key", "endpoint" => "https://source.example/api"}
          }
        }
      })

    assert %{"error" => "missing_credentials"} =
             conn
             |> authenticate(organization, :admin)
             |> post(choices_path(organization, widget.id, "listing"), %{})
             |> json_response(422)
  end

  test "rate limits each actor", %{conn: conn, organization: organization, widget: widget} do
    Application.put_env(:castmill, Choices, rate_limit: 1)
    conn = authenticate(conn, organization, :admin)

    assert conn
           |> post(choices_path(organization, widget.id, "listing"), %{})
           |> json_response(200)

    assert %{"error" => "rate_limited"} =
             conn
             |> post(choices_path(organization, widget.id, "listing"), %{})
             |> json_response(429)
  end
end
