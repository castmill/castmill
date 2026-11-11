defmodule Castmill.Widgets.ScopeTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Repo
  alias Castmill.Resources
  alias Castmill.Widgets
  alias Castmill.Widgets.{ScopeBackfill, Widget, WidgetOrganization}

  setup do
    network = network_fixture()
    other_network = network_fixture()

    org_a = organization_fixture(%{network_id: network.id, name: "Agency A"})
    org_b = organization_fixture(%{network_id: network.id, name: "Agency B"})
    org_x = organization_fixture(%{network_id: other_network.id, name: "Other network"})

    system = widget_fixture(%{is_system: true})
    network_widget = widget_fixture(%{is_system: false, network_id: network.id})
    org_a_widget = widget_fixture(%{is_system: false, organization_id: org_a.id})
    unassigned = widget_fixture(%{is_system: false})

    %{
      network: network,
      org_a: org_a,
      org_b: org_b,
      org_x: org_x,
      system: system,
      network_widget: network_widget,
      org_a_widget: org_a_widget,
      unassigned: unassigned
    }
  end

  defp available_ids(organization_id) do
    organization_id
    |> Widgets.available_query()
    |> select([w], w.id)
    |> Repo.all()
    |> MapSet.new()
  end

  defp add_to_playlist(organization, widget) do
    playlist = playlist_fixture(%{organization_id: organization.id})
    Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 10_000)
  end

  describe "available_query/1" do
    test "each organization sees system, its network's and its own widgets only", ctx do
      a = available_ids(ctx.org_a.id)
      b = available_ids(ctx.org_b.id)
      x = available_ids(ctx.org_x.id)

      for ids <- [a, b, x], do: assert(ctx.system.id in ids)

      assert ctx.network_widget.id in a
      assert ctx.network_widget.id in b
      refute ctx.network_widget.id in x

      assert ctx.org_a_widget.id in a
      refute ctx.org_a_widget.id in b
      refute ctx.org_a_widget.id in x

      for ids <- [a, b, x], do: refute(ctx.unassigned.id in ids)
    end

    test "restricted network and system widgets are only available where enabled", ctx do
      {:ok, network_widget} = Widgets.set_widget_scope(ctx.network_widget, %{restricted: true})
      {:ok, system} = Widgets.set_widget_scope(ctx.system, %{restricted: true})

      {:ok, _} = Widgets.enable_widget_for_organization(network_widget, ctx.org_a.id)
      {:ok, _} = Widgets.enable_widget_for_organization(system, ctx.org_b.id)

      assert ctx.network_widget.id in available_ids(ctx.org_a.id)
      refute ctx.network_widget.id in available_ids(ctx.org_b.id)

      assert ctx.system.id in available_ids(ctx.org_b.id)
      refute ctx.system.id in available_ids(ctx.org_a.id)
      refute ctx.system.id in available_ids(ctx.org_x.id)
    end

    test "invalid or unknown organization ids see nothing" do
      assert available_ids("not-a-uuid") == MapSet.new()
      assert available_ids(Ecto.UUID.generate()) == MapSet.new()
    end
  end

  test "get_available_widget/2 and put_access/2 describe scope and ownership", ctx do
    assert %Widget{scope: "organization", can_manage: true} =
             Widgets.get_available_widget(ctx.org_a.id, ctx.org_a_widget.id)

    assert %Widget{scope: "network", can_manage: false} =
             Widgets.get_available_widget(ctx.org_a.id, ctx.network_widget.id)

    assert %Widget{scope: "system", can_manage: false} =
             Widgets.get_available_widget(ctx.org_a.id, "#{ctx.system.id}")

    assert Widgets.get_available_widget(ctx.org_b.id, ctx.org_a_widget.id) == nil
    assert Widgets.get_available_widget(ctx.org_a.id, "abc") == nil
    assert Widgets.get_available_widget_by_slug(ctx.org_b.id, ctx.org_a_widget.slug) == nil

    assert Widgets.get_available_widget_by_slug(ctx.org_a.id, ctx.org_a_widget.slug).id ==
             ctx.org_a_widget.id
  end

  test "list_network_widgets/1 lists system, network and the network's organization widgets",
       ctx do
    org_x_widget = widget_fixture(%{is_system: false, organization_id: ctx.org_x.id})
    ids = ctx.network.id |> Widgets.list_network_widgets() |> Enum.map(& &1.id)

    assert ctx.system.id in ids
    assert ctx.network_widget.id in ids
    assert ctx.org_a_widget.id in ids
    refute org_x_widget.id in ids
    refute ctx.unassigned.id in ids
  end

  test "get_organization_widget/2 only returns widgets the organization owns", ctx do
    assert Widgets.get_organization_widget(ctx.org_a.id, ctx.org_a_widget.id).id ==
             ctx.org_a_widget.id

    assert Widgets.get_organization_widget(ctx.org_b.id, ctx.org_a_widget.id) == nil
    assert Widgets.get_organization_widget(ctx.org_a.id, ctx.system.id) == nil
    assert Widgets.get_organization_widget(ctx.org_a.id, ctx.network_widget.id) == nil
  end

  test "create_organization_widget/2 ignores scope fields in the attributes", ctx do
    {:ok, widget} =
      Widgets.create_organization_widget(ctx.org_a.id, %{
        "name" => "Sneaky",
        "slug" => "sneaky",
        "template" => %{},
        "is_system" => true,
        "network_id" => ctx.network.id,
        "restricted" => true
      })

    assert widget.organization_id == ctx.org_a.id
    assert widget.is_system == false
    assert widget.network_id == nil
    assert widget.restricted == false
  end

  test "update_organization_widget/2 only changes name and description", ctx do
    {:ok, widget} =
      Widgets.update_organization_widget(ctx.org_a_widget, %{
        "name" => "Renamed",
        "is_system" => true,
        "organization_id" => ctx.org_b.id,
        "template" => %{"type" => "text"}
      })

    assert widget.name == "Renamed"
    assert widget.is_system == false
    assert widget.organization_id == ctx.org_a.id
    assert widget.template == ctx.org_a_widget.template
  end

  describe "playlists" do
    test "items can only use widgets available to the playlist's organization", ctx do
      assert {:ok, _} = add_to_playlist(ctx.org_a, ctx.org_a_widget)
      assert {:ok, _} = add_to_playlist(ctx.org_b, ctx.network_widget)
      assert {:error, :not_found} = add_to_playlist(ctx.org_b, ctx.org_a_widget)
      assert {:error, :not_found} = add_to_playlist(ctx.org_x, ctx.network_widget)
      assert {:error, :not_found} = add_to_playlist(ctx.org_a, ctx.unassigned)
    end

    test "get_widget_usage/2 is limited to the organization's playlists", ctx do
      {:ok, _} = add_to_playlist(ctx.org_a, ctx.system)
      {:ok, _} = add_to_playlist(ctx.org_b, ctx.system)

      assert length(Widgets.get_widget_usage(ctx.system.id)) == 2
      assert [%{}] = Widgets.get_widget_usage(ctx.system.id, ctx.org_a.id)
    end

    test "deleting a widget removes its items and repairs the playlist", ctx do
      playlist = playlist_fixture(%{organization_id: ctx.org_a.id})
      {:ok, first} = Resources.insert_item_into_playlist(playlist.id, nil, ctx.system.id, 0, 1000)

      {:ok, middle} =
        Resources.insert_item_into_playlist(playlist.id, first.id, ctx.org_a_widget.id, 0, 1000)

      {:ok, last} =
        Resources.insert_item_into_playlist(playlist.id, middle.id, ctx.system.id, 0, 1000)

      {:ok, _} = Widgets.delete_widget_with_cascade(ctx.org_a_widget)

      assert Repo.get(Resources.PlaylistItem, middle.id) == nil
      assert Repo.get(Resources.PlaylistItem, first.id).next_item_id == last.id
      assert Repo.get(Resources.PlaylistItem, last.id).prev_item_id == first.id
    end
  end

  describe "scope changes" do
    test "reloads scope after locking when the caller has a stale struct", ctx do
      assert {:ok, %Widget{restricted: true}} =
               Widgets.set_widget_scope(ctx.system, %{restricted: true})

      assert {:ok, %Widget{restricted: false}} =
               Widgets.set_widget_scope(ctx.system, %{restricted: false})

      refute Repo.get!(Widget, ctx.system.id).restricted
      assert Widgets.available?(ctx.org_a.id, ctx.system.id)
    end

    test "validates all organizations using a widget in one query", ctx do
      organizations =
        [ctx.org_a, ctx.org_b, ctx.org_x] ++
          for index <- 1..10 do
            organization_fixture(%{network_id: ctx.network.id, name: "User #{index}"})
          end

      for organization <- organizations do
        assert {:ok, _} = add_to_playlist(organization, ctx.system)
      end

      assert {:ok, _} = add_to_playlist(ctx.org_a, ctx.system)

      widget = ctx.system |> Ecto.Changeset.change(restricted: true) |> Repo.update!()
      ref = make_ref()
      handler_id = {__MODULE__, ref}

      :ok =
        :telemetry.attach(
          handler_id,
          [:castmill, :repo, :query],
          fn _event, _measurements, _metadata, pid ->
            if self() == pid, do: send(pid, {:availability_query, ref})
          end,
          self()
        )

      on_exit(fn -> :telemetry.detach(handler_id) end)

      assert {:error, {:in_use, in_use}} = Widgets.ensure_users_keep_access(widget)
      assert Enum.sort(in_use) == Enum.sort(Enum.map(organizations, & &1.id))
      assert_receive {:availability_query, ^ref}
      refute_receive {:availability_query, ^ref}
    end

    test "set-based validation matches availability across platform grants and network policies",
         ctx do
      organizations = [ctx.org_a, ctx.org_b, ctx.org_x]

      cases = [
        {false, nil, []},
        {false, "selected", [ctx.org_b.id]},
        {false, "except", [ctx.org_a.id]},
        {false, "hidden", [ctx.org_a.id, ctx.org_b.id]},
        {true, nil, [ctx.org_b.id]},
        {true, "selected", [ctx.org_b.id]},
        {true, "except", [ctx.org_a.id, ctx.org_b.id]},
        {true, "hidden", [ctx.org_a.id, ctx.org_b.id]}
      ]

      for {restricted, mode, unavailable_ids} <- cases do
        widget = widget_fixture()

        for organization <- organizations do
          assert {:ok, _} = add_to_playlist(organization, widget)
        end

        for organization <- [ctx.org_a, ctx.org_x] do
          {:ok, _} = Widgets.enable_widget_for_organization(widget, organization.id)
        end

        if mode do
          Repo.insert!(%Castmill.Widgets.NetworkWidgetPolicy{
            network_id: ctx.network.id,
            widget_id: widget.id,
            mode: mode
          })

          Repo.insert!(%Castmill.Widgets.NetworkWidgetOrganization{
            widget_id: widget.id,
            organization_id: ctx.org_a.id
          })
        end

        widget = widget |> Ecto.Changeset.change(restricted: restricted) |> Repo.update!()

        for organization <- organizations do
          expected_available = organization.id not in unavailable_ids
          assert Widgets.available?(organization.id, widget.id) == expected_available
        end

        case Widgets.ensure_users_keep_access(widget) do
          :ok -> assert unavailable_ids == []
          {:error, {:in_use, ids}} -> assert Enum.sort(ids) == Enum.sort(unavailable_ids)
        end
      end
    end

    test "are refused while organizations using the widget would lose access", ctx do
      {:ok, _} = add_to_playlist(ctx.org_a, ctx.network_widget)
      {:ok, _} = add_to_playlist(ctx.org_b, ctx.network_widget)

      org_a_id = ctx.org_a.id
      org_b_id = ctx.org_b.id

      assert {:error, {:in_use, in_use}} =
               Widgets.set_widget_scope(ctx.network_widget, %{restricted: true})

      assert Enum.sort(in_use) == Enum.sort([org_a_id, org_b_id])
      refute Repo.get!(Widget, ctx.network_widget.id).restricted

      {:ok, _} = Widgets.enable_widget_for_organization(ctx.network_widget, org_a_id)
      {:ok, _} = Widgets.enable_widget_for_organization(ctx.network_widget, org_b_id)

      assert {:ok, %Widget{restricted: true}} =
               Widgets.set_widget_scope(ctx.network_widget, %{restricted: true})

      assert {:error, {:in_use, [^org_a_id]}} =
               Widgets.disable_widget_for_organization(ctx.network_widget, org_a_id)

      assert Repo.get_by(WidgetOrganization,
               widget_id: ctx.network_widget.id,
               organization_id: org_a_id
             )
    end

    test "unused grants can be removed", ctx do
      {:ok, widget} = Widgets.set_widget_scope(ctx.network_widget, %{restricted: true})
      {:ok, _} = Widgets.enable_widget_for_organization(widget, ctx.org_a.id)

      assert {:ok, :ok} = Widgets.disable_widget_for_organization(widget, ctx.org_a.id)
      refute ctx.network_widget.id in available_ids(ctx.org_a.id)
    end

    test "network widgets can only be enabled for organizations of their network", ctx do
      assert {:error, :organization_not_in_network} =
               Widgets.enable_widget_for_organization(ctx.network_widget, ctx.org_x.id)

      assert {:error, :organization_widget} =
               Widgets.enable_widget_for_organization(ctx.org_a_widget, ctx.org_b.id)

      assert {:error, :unassigned_widget} =
               Widgets.enable_widget_for_organization(ctx.unassigned, ctx.org_a.id)
    end

    test "constraints reject invalid scopes", ctx do
      assert {:error, changeset} =
               Widgets.set_widget_scope(ctx.org_a_widget, %{network_id: ctx.network.id})

      assert changeset.errors[:network_id]

      assert {:error, changeset} = Widgets.set_widget_scope(ctx.org_a_widget, %{restricted: true})
      assert changeset.errors[:restricted]

      assert {:error, changeset} =
               Widgets.set_widget_scope(ctx.network_widget, %{is_system: true})

      assert changeset.errors[:is_system]
    end
  end

  describe "ScopeBackfill" do
    # Simulates widgets that existed before scoping: non-system and without an owner.
    defp legacy_widget do
      widget = widget_fixture(%{is_system: false})
      widget
    end

    defp use_widget(organization, widget) do
      playlist = playlist_fixture(%{organization_id: organization.id})
      item = playlist_item_fixture(%{playlist_id: playlist.id, offset: 0, duration: 1000})
      widget_config_fixture(%{widget_id: widget.id, playlist_item_id: item.id, options: %{}})
    end

    test "assigns owners without widening access", ctx do
      single = legacy_widget()
      shared = legacy_widget()
      cross = legacy_widget()
      unused = legacy_widget()

      use_widget(ctx.org_a, single)
      use_widget(ctx.org_a, shared)
      use_widget(ctx.org_b, shared)
      use_widget(ctx.org_a, cross)
      use_widget(ctx.org_x, cross)

      ScopeBackfill.run(Repo)

      single = Repo.get!(Widget, single.id)

      assert {single.organization_id, single.network_id, single.is_system} ==
               {ctx.org_a.id, nil, false}

      shared = Repo.get!(Widget, shared.id)

      assert {shared.network_id, shared.restricted, shared.is_system} ==
               {ctx.network.id, true, false}

      cross = Repo.get!(Widget, cross.id)
      assert {cross.is_system, cross.restricted} == {true, true}

      unused = Repo.get!(Widget, unused.id)
      assert Widgets.scope(unused) == "unassigned"

      # Everyone keeps access to what they use, and nobody else gains it.
      a = available_ids(ctx.org_a.id)
      b = available_ids(ctx.org_b.id)
      x = available_ids(ctx.org_x.id)

      assert single.id in a and single.id not in b
      assert shared.id in a and shared.id in b and shared.id not in x
      assert cross.id in a and cross.id in x and cross.id not in b
      refute unused.id in a or unused.id in b or unused.id in x
    end
  end
end
