defmodule Castmill.Repo.Migrations.FixQuotasOrganizationsPrimaryKey do
  use Ecto.Migration

  # The table was created with `resource` alone as its primary key, so only
  # one organization could have an override per resource. The key is the
  # organization and the resource, as the schema declares.
  def up do
    execute("ALTER TABLE quotas_organizations DROP CONSTRAINT quotas_organizations_pkey")
    execute("ALTER TABLE quotas_organizations ADD PRIMARY KEY (organization_id, resource)")
  end

  def down do
    execute("ALTER TABLE quotas_organizations DROP CONSTRAINT quotas_organizations_pkey")
    execute("ALTER TABLE quotas_organizations ADD PRIMARY KEY (resource)")
  end
end
