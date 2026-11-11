defmodule Castmill.Repo.Migrations.AddFeedsQuota do
  use Ecto.Migration

  # Without a quota row, organizations could not create feeds (missing quotas count as 0).
  def up do
    execute """
    INSERT INTO plans_quotas (plan_id, resource, max)
    SELECT id, 'feeds', 20
    FROM plans
    WHERE id NOT IN (SELECT plan_id FROM plans_quotas WHERE resource = 'feeds')
    """

    execute """
    INSERT INTO quotas_networks (network_id, resource, max, inserted_at, updated_at)
    SELECT DISTINCT network_id, 'feeds', 20, now(), now()
    FROM quotas_networks
    WHERE network_id NOT IN (SELECT network_id FROM quotas_networks WHERE resource = 'feeds')
    """
  end

  def down do
    execute "DELETE FROM quotas_networks WHERE resource = 'feeds'"
    execute "DELETE FROM plans_quotas WHERE resource = 'feeds'"
  end
end
