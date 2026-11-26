defmodule Castmill.Repo.Migrations.FixQuotasOrganizationsPrimaryKey do
  use Ecto.Migration

  # The table was created with `resource` alone as its primary key, so only
  # one organization could have an override per resource. The key is the
  # organization and the resource, as the schema declares.
  def up do
    execute("ALTER TABLE quotas_organizations DROP CONSTRAINT quotas_organizations_pkey")
    execute("ALTER TABLE quotas_organizations ADD PRIMARY KEY (organization_id, resource)")
  end

  # The old key allows one override per resource, so rolling back keeps the
  # most recently updated override of each resource and drops the others.
  def down do
    execute("ALTER TABLE quotas_organizations DROP CONSTRAINT quotas_organizations_pkey")

    execute("""
    DELETE FROM quotas_organizations q
    USING quotas_organizations newer
    WHERE q.resource = newer.resource
      AND (newer.updated_at, newer.organization_id) > (q.updated_at, q.organization_id)
    """)

    execute("ALTER TABLE quotas_organizations ADD PRIMARY KEY (resource)")
  end
end
