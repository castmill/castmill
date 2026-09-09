defmodule Castmill.Repo.Migrations.AddLayoutsQuotaToPlans do
  use Ecto.Migration

  def up do
    # Add layout quota to all existing plans
    # Default to 100 layouts per plan (reasonable default)
    execute """
    INSERT INTO plans_quotas (plan_id, resource, max)
    SELECT id, 'layouts', 100
    FROM plans
    WHERE id NOT IN (
      SELECT plan_id FROM plans_quotas WHERE resource = 'layouts'
    )
    """
  end

  def down do
    execute """
    DELETE FROM plans_quotas WHERE resource = 'layouts'
    """
  end
end
