defmodule CastmillWeb.Live.Admin.AdminPagesTest do
  @moduledoc """
  Opens every page and tab of the Phoenix admin with data in place, follows
  every admin link on them and runs every row action they offer, so a page,
  link or action that crashes fails CI instead of production. Add new admin
  pages, tabs and row actions here.
  """
  use CastmillWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Castmill.AccountsFixtures
  import Castmill.ChannelsFixtures
  import Castmill.DevicesFixtures
  import Castmill.MediasFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures
  import Castmill.TeamsFixtures

  alias Castmill.Accounts
  alias Castmill.Organizations

  @network_tabs ~w(organizations invitations teams users admins devices channels playlists medias widgets integrations)
  @organization_tabs ~w(organizations teams users devices channels playlists medias widgets)

  setup %{conn: conn} do
    root = user_fixture()

    access_token_fixture(%{
      user_id: root.id,
      secret: "#{root.email}:root-password",
      is_root: true
    })

    network = network_fixture()
    organization = organization_fixture(%{network: network, name: "Acme"})
    member = user_fixture(%{network_id: network.id, name: "Bob Member"})
    {:ok, _} = Organizations.add_user(organization.id, member.id, :admin)

    {:ok, _invitation} =
      Castmill.Networks.invite_user_to_new_organization(
        network.id,
        "invitee@example.com",
        "Invited Org"
      )

    ids = %{
      network: network.id,
      organization: organization.id,
      user: member.id,
      team: team_fixture(%{organization_id: organization.id}).id,
      device: device_fixture(%{organization_id: organization.id}).id,
      channel:
        channel_fixture(%{organization_id: organization.id, timezone: "Europe/Stockholm"}).id,
      playlist: playlist_fixture(%{organization_id: organization.id}).id,
      media: media_fixture(%{organization_id: organization.id}).id,
      widget: widget_fixture().id
    }

    other = user_fixture(%{network_id: network.id, name: "Carol Other"})

    %{conn: admin_conn(conn, root), ids: ids, root: root, member: member, other: other}
  end

  # The row actions (Block, Unblock, Delete) each page offers. Every page is
  # its own test so the actions run on fresh data.
  @action_pages [
    {"/admin/networks", ~w(delete)},
    {"/admin/organizations", ~w(block delete)},
    {"/admin/teams", []},
    {"/admin/users", ~w(delete)},
    {"/admin/devices", ~w(delete)},
    {"/admin/channels", []},
    {"/admin/playlists", []},
    {"/admin/medias", []},
    {"/admin/widgets", []},
    {"/admin/networks/:network/organizations", ~w(delete)},
    {"/admin/networks/:network/invitations", ~w(delete)},
    {"/admin/networks/:network/teams", []},
    {"/admin/networks/:network/users", []},
    {"/admin/networks/:network/admins", []},
    {"/admin/networks/:network/devices", []},
    {"/admin/networks/:network/channels", []},
    {"/admin/networks/:network/playlists", []},
    {"/admin/networks/:network/medias", []},
    {"/admin/networks/:network/widgets", []},
    {"/admin/networks/:network/integrations", []},
    {"/admin/organizations/:organization/organizations", []},
    {"/admin/organizations/:organization/teams", ~w(delete)},
    {"/admin/organizations/:organization/users", ~w(delete)},
    {"/admin/organizations/:organization/devices", ~w(delete)},
    {"/admin/organizations/:organization/channels", []},
    {"/admin/organizations/:organization/playlists", []},
    {"/admin/organizations/:organization/medias", []},
    {"/admin/organizations/:organization/widgets", []}
  ]

  test "every admin page and every page linked from it renders", %{conn: conn, ids: ids} do
    resources = %{
      "networks" => ids.network,
      "organizations" => ids.organization,
      "teams" => ids.team,
      "users" => ids.user,
      "devices" => ids.device,
      "channels" => ids.channel,
      "playlists" => ids.playlist,
      "medias" => ids.media,
      "widgets" => ids.widget
    }

    paths =
      ["/admin/passkeys", "/admin/networks/new"] ++
        Enum.flat_map(resources, fn {resource, id} ->
          ["/admin/#{resource}", "/admin/#{resource}/#{id}", "/admin/#{resource}/#{id}/edit"]
        end) ++
        ["/admin/networks/#{ids.network}/show/edit"] ++
        Enum.map(@network_tabs, &"/admin/networks/#{ids.network}/#{&1}") ++
        Enum.map(~w(organizations invitations), &"/admin/networks/#{ids.network}/#{&1}/new") ++
        ["/admin/organizations/#{ids.organization}/show/edit"] ++
        Enum.map(@organization_tabs, &"/admin/organizations/#{ids.organization}/#{&1}") ++
        [
          "/admin/organizations/#{ids.organization}/unknown",
          "/admin/organizations/#{ids.organization}/unknown/new"
        ] ++
        Enum.map(
          ~w(organizations teams users devices),
          &"/admin/organizations/#{ids.organization}/#{&1}/new"
        )

    failures = crawl(conn, paths, MapSet.new(paths, &route_shape/1), [])

    assert failures == [],
           "admin pages failed to render:\n" <>
             Enum.map_join(failures, "\n", fn {path, reason} -> "  #{path}: #{reason}" end)
  end

  for {page, expected} <- @action_pages do
    test "#{page} offers #{inspect(expected)} and they work", %{conn: conn, ids: ids} do
      path =
        unquote(page)
        |> String.replace(":network", ids.network)
        |> String.replace(":organization", ids.organization)

      {:ok, view, html} = live(conn, path)
      actions = offered_actions(html)

      assert Enum.map(actions, &elem(&1, 0)) == unquote(expected)

      for {event, value} <- actions do
        render_click(view, event, value)

        if event == "block" do
          unblock =
            view
            |> render()
            |> offered_actions()
            |> Enum.find(fn {name, _value} -> name == "unblock" end)

          assert unblock, "blocking an organization should offer Unblock"
          {unblock_event, unblock_value} = unblock
          render_click(view, unblock_event, unblock_value)
        end
      end
    end
  end

  test "every search box filters without crashing", %{conn: conn, ids: ids} do
    failures =
      for {page, _actions} <- @action_pages,
          path =
            page
            |> String.replace(":network", ids.network)
            |> String.replace(":organization", ids.organization),
          {:ok, view, _html} = live(conn, path),
          has_element?(view, "form[phx-change=search]"),
          reason = search_failure(view),
          reason != nil,
          do: {path, reason}

    assert failures == [],
           "searching failed:\n" <>
             Enum.map_join(failures, "\n", fn {path, reason} -> "  #{path}: #{reason}" end)
  end

  test "the network users tab searches all of the network's users", %{
    conn: conn,
    ids: ids,
    member: member,
    other: other
  } do
    {:ok, view, _html} = live(conn, "/admin/networks/#{ids.network}/users")
    assert has_element?(view, "#rows-#{other.id}")
    assert has_element?(view, "#tab-hint a[href='/admin/networks/#{ids.network}/invitations']")
    assert has_element?(view, "#tab-hint a[href='/admin/networks/#{ids.network}/admins']")

    view |> form("form[phx-change=search]", %{search: "bob mem"}) |> render_change()
    assert has_element?(view, "#rows-#{member.id}")
    refute has_element?(view, "#rows-#{other.id}")

    view |> form("form[phx-change=search]", %{search: other.email}) |> render_submit()
    assert has_element?(view, "#rows-#{other.id}")
    refute has_element?(view, "#rows-#{member.id}")

    view |> form("form[phx-change=search]", %{search: member.id}) |> render_change()
    assert has_element?(view, "#rows-#{member.id}")
    refute has_element?(view, "#rows-#{other.id}")

    view |> form("form[phx-change=search]", %{search: other.id}) |> render_submit()
    assert has_element?(view, "#rows-#{other.id}")
    refute has_element?(view, "#rows-#{member.id}")

    view |> form("form[phx-change=search]", %{search: ""}) |> render_change()
    assert has_element?(view, "#rows-#{member.id}")
    assert has_element?(view, "#rows-#{other.id}")
  end

  test "organization tabs are filtered by the search", %{conn: conn, ids: ids, member: member} do
    {:ok, view, _html} = live(conn, "/admin/organizations/#{ids.organization}/users")

    view |> form("form[phx-change=search]", %{search: "BOB"}) |> render_change()
    assert has_element?(view, "#rows-#{member.id}")

    view |> form("form[phx-change=search]", %{search: "nobody"}) |> render_change()
    refute has_element?(view, "#rows-#{member.id}")
  end

  test "resource lists search through the URL", %{conn: conn, member: member, root: root} do
    {:ok, view, _html} = live(conn, "/admin/users")
    view |> form("form[phx-change=search]", %{search: " Bob "}) |> render_change()

    path = assert_patch(view)
    assert path =~ "search=Bob"
    assert path =~ "page=1"
    html = render(view)
    assert html =~ member.email
    refute html =~ "#{root.email}</td>"
  end

  test "sending a network invitation refreshes the invitations tab", %{conn: conn, ids: ids} do
    {:ok, view, _html} = live(conn, "/admin/networks/#{ids.network}/invitations/new")

    view
    |> form("#network-invitation-form",
      network_invitation: %{email: "newcomer@example.test", organization_name: "Newcomer Org"}
    )
    |> render_submit()

    assert_patch(view, "/admin/networks/#{ids.network}/invitations")

    for invitation <- Castmill.Networks.list_network_invitations(ids.network) do
      assert has_element?(view, "#rows-#{invitation.id}", invitation.email)
      assert has_element?(view, "#rows-#{invitation.id}", invitation.organization_name)
    end

    assert length(Castmill.Networks.list_network_invitations(ids.network)) == 2
  end

  test "organization tabs list the organization's resources", %{conn: conn, ids: ids} do
    for {tab, id} <- [
          {"users", ids.user},
          {"teams", ids.team},
          {"devices", ids.device},
          {"channels", ids.channel},
          {"playlists", ids.playlist},
          {"medias", ids.media},
          {"widgets", ids.widget}
        ] do
      {:ok, view, _html} = live(conn, "/admin/organizations/#{ids.organization}/#{tab}")
      assert has_element?(view, "#rows-#{id}"), "#{tab} tab does not list #{id}"
    end
  end

  test "organization child modal save and cancel return to the tab", %{
    conn: conn,
    ids: ids
  } do
    path = "/admin/organizations/#{ids.organization}/teams/new"
    {:ok, view, _html} = live(conn, path)

    view
    |> form("#team-form", team: %{name: "New team"})
    |> render_submit()

    assert_patch(view, "/admin/organizations/#{ids.organization}/teams")

    team = Enum.find(Castmill.Teams.list_teams(ids.organization), &(&1.name == "New team"))
    assert team
    assert has_element?(view, "#rows-#{team.id}")

    {:ok, view, _html} = live(conn, path)
    view
    |> element("#child-modal button[aria-label=close]")
    |> render_click()

    assert_patch(view, "/admin/organizations/#{ids.organization}/teams")
  end

  # Visits the paths and, breadth first, every /admin link on the pages that
  # render, once per route (see route_shape/1). Returns the pages that failed
  # with the reason.
  defp crawl(_conn, [], _seen, failures), do: Enum.reverse(failures)

  defp crawl(conn, [path | rest], seen, failures) do
    case visit(conn, path) do
      {:ok, html} ->
        links =
          html
          |> admin_links()
          |> Enum.uniq_by(&route_shape/1)
          |> Enum.reject(&MapSet.member?(seen, route_shape(&1)))

        crawl(
          conn,
          rest ++ links,
          MapSet.union(seen, MapSet.new(links, &route_shape/1)),
          failures
        )

      {:error, reason} ->
        crawl(conn, rest, seen, [{path, reason} | failures])
    end
  end

  # Types and submits a search; returns why it failed, or nil.
  defp search_failure(view) do
    view |> form("form[phx-change=search]", %{search: "zz-no-match"}) |> render_change()
    view |> form("form[phx-change=search]", %{search: ""}) |> render_submit()
    nil
  catch
    kind, reason -> Exception.format_banner(kind, reason) |> String.split("\n") |> hd()
  end

  defp visit(conn, path) do
    case live(conn, path) do
      {:ok, _view, html} -> {:ok, html}
      {:error, reason} -> {:error, inspect(reason)}
    end
  catch
    kind, reason ->
      {:error, Exception.format_banner(kind, reason) |> String.split("\n") |> hd()}
  end

  # "/admin/widgets/12?page=2" and "/admin/widgets/13?page=3" are the same route.
  defp route_shape(path) do
    path
    |> String.replace(~r/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, ":uuid")
    |> String.replace(~r{/\d+(?=/|\?|$)}, "/:id")
    |> String.replace(~r/=[^&]*/, "=")
  end

  defp admin_links(html) do
    ~r{href="(/admin[^"#]*)"}
    |> Regex.scan(html, capture: :all_but_first)
    |> List.flatten()
    |> Enum.map(&String.replace(&1, "&amp;", "&"))
    |> Enum.reject(&(&1 == "/admin/logout"))
    |> Enum.uniq()
  end

  # The first Block, Unblock and Delete push of the page (in that order, so a
  # deleted row is not blocked afterwards), decoded from the phx-click JS.
  defp offered_actions(html) do
    pushes =
      ~r/phx-click="([^"]*)"/
      |> Regex.scan(html, capture: :all_but_first)
      |> List.flatten()
      |> Enum.flat_map(fn attr ->
        case Jason.decode(unescape_html(attr)) do
          {:ok, ops} when is_list(ops) ->
            for ["push", %{"event" => event} = args] <- ops,
                event in ~w(block unblock delete),
                do: {event, Map.get(args, "value", %{})}

          _not_js ->
            []
        end
      end)

    for event <- ~w(block unblock delete),
        action = Enum.find(pushes, fn {name, _value} -> name == event end),
        do: action
  end

  defp unescape_html(text) do
    text
    |> String.replace("&quot;", "\"")
    |> String.replace("&#39;", "'")
    |> String.replace("&lt;", "<")
    |> String.replace("&gt;", ">")
    |> String.replace("&amp;", "&")
  end

  defp admin_conn(conn, root) do
    token = Accounts.generate_admin_session_token(root.id)

    conn
    |> init_test_session(%{})
    |> Plug.Conn.put_session(:admin_user_token, token)
  end
end
