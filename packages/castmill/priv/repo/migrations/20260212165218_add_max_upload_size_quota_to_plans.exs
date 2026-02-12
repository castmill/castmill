defmodule Castmill.Repo.Migrations.AddMaxUploadSizeQuotaToPlans do
  use Ecto.Migration

  def up do
    # Add max_upload_size quota to all existing plans
    # Default to 2 GB (2,147,483,648 bytes) per file
    execute """
    INSERT INTO plans_quotas (plan_id, resource, max)
    SELECT id, 'max_upload_size', 2147483648
    FROM plans
    WHERE id NOT IN (
      SELECT plan_id FROM plans_quotas WHERE resource = 'max_upload_size'
    )
    """
  end

  def down do
    execute """
    DELETE FROM plans_quotas WHERE resource = 'max_upload_size'
    """
  end
end
