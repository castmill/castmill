defmodule Castmill.Repo.Migrations.AddUploadQuotaAndBigintMax do
  use Ecto.Migration

  def up do
    # Change max column from integer (int4) to bigint (int8) on all quota tables.
    # This allows storing values in bytes without overflow (int8 supports up to ~9.2 EB).
    alter table(:plans_quotas) do
      modify :max, :bigint
    end

    alter table(:quotas_networks) do
      modify :max, :bigint
    end

    alter table(:quotas_organizations) do
      modify :max, :bigint
    end

    # Add max_upload_size quota to all existing plans
    # Default to 2 GB (2147483648 bytes) per file
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
    # Remove max_upload_size quotas
    execute """
    DELETE FROM plans_quotas WHERE resource = 'max_upload_size'
    """

    # Revert column type from bigint back to integer
    alter table(:plans_quotas) do
      modify :max, :integer
    end

    alter table(:quotas_networks) do
      modify :max, :integer
    end

    alter table(:quotas_organizations) do
      modify :max, :integer
    end
  end
end
