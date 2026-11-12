defmodule Castmill.Repo.Migrations.AddTagsAndAgentsQuotasToPlans do
  use Ecto.Migration

  @quotas [{"tags", 500}, {"tag_groups", 50}, {"agents", 5}]

  def up do
    for {resource, max} <- @quotas do
      execute """
      INSERT INTO plans_quotas (plan_id, resource, max)
      SELECT id, '#{resource}', #{max}
      FROM plans
      WHERE id NOT IN (
        SELECT plan_id FROM plans_quotas WHERE resource = '#{resource}'
      )
      """

      execute """
      INSERT INTO quotas_networks (network_id, resource, max, inserted_at, updated_at)
      SELECT networks.network_id, '#{resource}', #{max}, now(), now()
      FROM (SELECT DISTINCT network_id FROM quotas_networks) AS networks
      WHERE NOT EXISTS (
        SELECT 1
        FROM quotas_networks
        WHERE network_id = networks.network_id AND resource = '#{resource}'
      )
      """
    end
  end

  def down do
    :ok
  end
end
