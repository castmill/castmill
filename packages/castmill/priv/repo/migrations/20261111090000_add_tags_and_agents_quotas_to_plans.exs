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
    end
  end

  def down do
    execute "DELETE FROM plans_quotas WHERE resource IN ('tags', 'tag_groups', 'agents')"
    execute "DELETE FROM quotas_organizations WHERE resource IN ('tags', 'tag_groups', 'agents')"
    execute "DELETE FROM quotas_networks WHERE resource IN ('tags', 'tag_groups', 'agents')"
  end
end
