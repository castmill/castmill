defmodule Castmill.Repo.Migrations.SeedDefaultPlansForExistingNetworks do
  use Ecto.Migration

  def up do
    # Create default plans for networks that don't have one yet
    create_default_plans_for_networks_without_plans()
  end

  def down do
    # This is a data migration, we don't need to reverse it
    :ok
  end

  defp create_default_plans_for_networks_without_plans do
    # Define default quotas
    default_quotas = [
      %{resource: "teams", max: 5},
      %{resource: "medias", max: 100},
      %{resource: "playlists", max: 50},
      %{resource: "devices", max: 10},
      %{resource: "channels", max: 20}
    ]

    # Get all networks that don't have a default_plan_id
    networks =
      repo().query!(
        "SELECT id FROM networks WHERE default_plan_id IS NULL",
        []
      )

    # For each network without a default plan, create one
    Enum.each(networks.rows, fn [network_id] ->
      # Insert the plan
      plan_result =
        repo().query!(
          "INSERT INTO plans (name, network_id, inserted_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id",
          ["Default Plan", network_id]
        )

      plan_id = plan_result.rows |> List.first() |> List.first()

      # Insert the quotas for this plan
      Enum.each(default_quotas, fn quota ->
        repo().query!(
          "INSERT INTO plans_quotas (plan_id, resource, max)
           VALUES ($1, $2, $3)",
          [plan_id, quota.resource, quota.max]
        )
      end)

      # Set this plan as the network's default
      repo().query!(
        "UPDATE networks SET default_plan_id = $1 WHERE id = $2",
        [plan_id, network_id]
      )
    end)
  end
end
