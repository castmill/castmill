defmodule Castmill.Repo.Migrations.ConvertStorageQuotaToMegabytes do
  use Ecto.Migration

  def up do
    # Convert storage quotas from bytes to megabytes across all quota tables
    # This prevents int4 overflow when storage quotas exceed 2GB
    # Using CEIL to round up and prevent data loss

    # Convert plans_quotas storage values from bytes to MB
    execute """
    UPDATE plans_quotas
    SET max = CEIL(max::numeric / 1024 / 1024)::integer
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    # Convert quotas_networks storage values from bytes to MB
    execute """
    UPDATE quotas_networks
    SET max = CEIL(max::numeric / 1024 / 1024)::integer
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    # Convert quotas_organizations storage values from bytes to MB
    execute """
    UPDATE quotas_organizations
    SET max = CEIL(max::numeric / 1024 / 1024)::integer
    WHERE resource = 'storage' AND max IS NOT NULL
    """
  end

  def down do
    # Convert storage quotas back from megabytes to bytes

    # Convert plans_quotas storage values from MB to bytes
    execute """
    UPDATE plans_quotas
    SET max = max * 1024 * 1024
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    # Convert quotas_networks storage values from MB to bytes
    execute """
    UPDATE quotas_networks
    SET max = max * 1024 * 1024
    WHERE resource = 'storage' AND max IS NOT NULL
    """

    # Convert quotas_organizations storage values from MB to bytes
    execute """
    UPDATE quotas_organizations
    SET max = max * 1024 * 1024
    WHERE resource = 'storage' AND max IS NOT NULL
    """
  end
end
