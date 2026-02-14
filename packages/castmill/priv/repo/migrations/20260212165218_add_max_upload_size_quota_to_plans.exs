defmodule Castmill.Repo.Migrations.AddMaxUploadSizeQuotaToPlans do
  use Ecto.Migration

  def up do
    # Add max_upload_size quota to all existing plans
    # Default to 2048 MB (2 GB) per file
    # Note: max_upload_size is stored in megabytes (MB), not bytes
    execute """
    INSERT INTO plans_quotas (plan_id, resource, max)
    SELECT id, 'max_upload_size', 2048
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
