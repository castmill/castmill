defmodule Castmill.Repo.Migrations.AddDefaultPlanIdToNetworks do
  use Ecto.Migration

  def change do
    alter table(:networks) do
      add :default_plan_id, references(:plans, on_delete: :nilify_all)
    end

    create index(:networks, [:default_plan_id])

    # Create default plans for existing networks
    flush()
    create_default_plans_for_existing_networks()
  end

  defp create_default_plans_for_existing_networks do
    # Define default quotas
    default_quotas = [
      %{resource: "teams", max: 10},
      %{resource: "medias", max: 1000},
      %{resource: "playlists", max: 50},
      %{resource: "devices", max: 20},
      %{resource: "channels", max: 20}
    ]

    # Get all existing networks
    networks =
      repo().query!(
        "SELECT id FROM networks",
        []
      )

    # For each network, create a default plan
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
