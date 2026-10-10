defmodule Castmill.QueryHelpersSortingTest do
  use Castmill.DataCase, async: true

  alias Castmill.QueryHelpers
  alias Castmill.Organizations.OrganizationsInvitation
  alias Castmill.Teams.{Invitation, TeamsUsers}

  import Castmill.OrganizationsFixtures
  import Castmill.TeamsFixtures

  test "updated date sorting replaces the existing order and preserves pagination" do
    query = from(i in OrganizationsInvitation, order_by: i.email, limit: 1, offset: 1)

    for {direction, expected_direction} <- [{"ascending", :asc}, {"descending", :desc}] do
      sorted =
        QueryHelpers.maybe_sort_by_updated_at(query, %{
          key: "updated_at",
          direction: direction
        })

      expected =
        query
        |> exclude(:order_by)
        |> order_by([i], [{^expected_direction, i.updated_at}])

      assert Enum.map(sorted.order_bys, & &1.expr) == Enum.map(expected.order_bys, & &1.expr)
      assert sorted.limit == query.limit
      assert sorted.offset == query.offset
    end
  end

  test "other sort keys preserve the existing query" do
    query = from(i in OrganizationsInvitation, order_by: i.email)

    assert QueryHelpers.maybe_sort_by_updated_at(query, %{key: "email"}) == query
    assert QueryHelpers.maybe_sort_by_updated_at(query, %{}) == query
  end

  test "team members and invitations put recently edited records before recently created records" do
    organization = organization_fixture()
    team = team_fixture(%{organization_id: organization.id})
    edited_user = user_fixture(%{name: "Zebra"})
    created_user = user_fixture(%{name: "Alpha"})

    for {user, email, inserted_at, updated_at} <- [
          {edited_user, "zebra@example.com", ~U[2024-01-01 00:00:00Z], ~U[2024-03-01 00:00:00Z]},
          {created_user, "alpha@example.com", ~U[2024-02-01 00:00:00Z], ~U[2024-02-01 00:00:00Z]}
        ] do
      Repo.insert!(%TeamsUsers{
        team_id: team.id,
        user_id: user.id,
        role: :member,
        inserted_at: inserted_at,
        updated_at: updated_at
      })

      Repo.insert!(%Invitation{
        team_id: team.id,
        email: email,
        token: Ecto.UUID.generate(),
        inserted_at: inserted_at,
        updated_at: updated_at
      })

      Repo.insert!(%OrganizationsInvitation{
        organization_id: organization.id,
        email: email,
        role: :member,
        token: Ecto.UUID.generate(),
        inserted_at: inserted_at,
        updated_at: updated_at
      })
    end

    params = %{
      organization_id: organization.id,
      team_id: team.id,
      search: "",
      key: "updated_at",
      direction: "descending",
      page: 1,
      page_size: 1
    }

    assert [%{user_id: user_id}] = Castmill.Teams.list_users(params)
    assert user_id == edited_user.id

    for list <- [&Castmill.Teams.list_invitations/1, &Castmill.Organizations.list_invitations/1] do
      assert [%{email: "zebra@example.com"}] = list.(params)
      assert [%{email: "alpha@example.com"}] = list.(%{params | page: 2})
    end
  end
end
