defmodule Castmill.Repo.Migrations.AddAutomationsQuotasToPlans do
  use Ecto.Migration

  def up do
    execute """
    INSERT INTO plans_quotas (plan_id, resource, max)
    SELECT id, 'automations', 50
    FROM plans
    WHERE id NOT IN (
      SELECT plan_id FROM plans_quotas WHERE resource = 'automations'
    )
    """

    execute """
    INSERT INTO plans_quotas (plan_id, resource, max)
    SELECT id, 'automation_rules', 500
    FROM plans
    WHERE id NOT IN (
      SELECT plan_id FROM plans_quotas WHERE resource = 'automation_rules'
    )
    """
  end

  def down do
    execute "DELETE FROM plans_quotas WHERE resource IN ('automations', 'automation_rules')"
  end
end
