defmodule Castmill.Repo.Migrations.ChangeQuotaMaxToBigintAndRevertToBytes do
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

    # Convert storage quotas back from MB to bytes
    execute """
    UPDATE plans_quotas
    SET max = max * 1024 * 1024
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    execute """
    UPDATE quotas_networks
    SET max = max * 1024 * 1024
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    execute """
    UPDATE quotas_organizations
    SET max = max * 1024 * 1024
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    # Convert max_upload_size quotas from MB to bytes
    execute """
    UPDATE plans_quotas
    SET max = max * 1024 * 1024
    WHERE resource = 'max_upload_size' AND max IS NOT NULL
    """

    execute """
    UPDATE quotas_networks
    SET max = max * 1024 * 1024
    WHERE resource = 'max_upload_size' AND max IS NOT NULL
    """

    execute """
    UPDATE quotas_organizations
    SET max = max * 1024 * 1024
    WHERE resource = 'max_upload_size' AND max IS NOT NULL
    """
  end

  def down do
    # Convert storage quotas from bytes back to MB
    execute """
    UPDATE plans_quotas
    SET max = max / 1024 / 1024
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    execute """
    UPDATE quotas_networks
    SET max = max / 1024 / 1024
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    execute """
    UPDATE quotas_organizations
    SET max = max / 1024 / 1024
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    # Convert max_upload_size quotas from bytes back to MB
    execute """
    UPDATE plans_quotas
    SET max = max / 1024 / 1024
    WHERE resource = 'max_upload_size' AND max IS NOT NULL
    """

    execute """
    UPDATE quotas_networks
    SET max = max / 1024 / 1024
    WHERE resource = 'max_upload_size' AND max IS NOT NULL
    """

    execute """
    UPDATE quotas_organizations
    SET max = max / 1024 / 1024
    WHERE resource = 'max_upload_size' AND max IS NOT NULL
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
