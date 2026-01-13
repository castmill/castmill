defmodule Castmill.Quotas do
  @moduledoc """
  The Quotas context.
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Quotas.Plan
  alias Castmill.Quotas.PlansQuotas
  alias Castmill.Quotas.PlansOrganizations

  alias Castmill.Quotas.QuotasNetworks
  alias Castmill.Quotas.QuotasOrganizations

  @doc """
    Create a plan based on a list of resource types and their max values.
  """
  def create_plan(name, network_id, quotas) do
    plan = Repo.insert!(%Plan{name: name, network_id: network_id})

    Enum.each(quotas, fn quota ->
      Repo.insert!(%PlansQuotas{plan_id: plan.id, resource: quota.resource, max: quota.max})
    end)

    plan
  end

  @doc """
    Returns the list of plans
  """
  def list_plans() do
    Repo.all(Plan)
  end

  def list_plans(network_id) do
    Repo.all(from(plans in Plan, where: plans.network_id == ^network_id))
  end

  @doc """
    Delete a given plan
  """
  def delete_plan(id) do
    Plan
    |> where(id: ^id)
    |> Repo.delete_all()
  end

  @doc """
    Assign a given quota to a given network
  """
  def assign_quota_to_network(network_id, resource, max) do
    Repo.insert!(%QuotasNetworks{network_id: network_id, resource: resource, max: max})
  end

  @doc """
    Update a given quota for a given network
  """
  def update_quota_for_network(network_id, resource, max) do
    Repo.update_all(
      from(quotas in QuotasNetworks,
        where: quotas.network_id == ^network_id,
        where: quotas.resource == ^resource
      ),
      set: [max: max]
    )
  end

  @doc """
    Assign a given plan to a given organization
  """
  def assign_plan_to_organization(plan_id, organization_id) do
    Repo.insert!(%PlansOrganizations{plan_id: plan_id, organization_id: organization_id})
  end

  @doc """
    Set the default plan for a network.
    This plan will be used as fallback for all organizations in the network
    that don't have a specific plan assigned.
  """
  def set_network_default_plan(network_id, plan_id) do
    network = Repo.get!(Castmill.Networks.Network, network_id)

    network
    |> Castmill.Networks.Network.changeset(%{default_plan_id: plan_id})
    |> Repo.update()
  end

  @doc """
    Returns the quota for a given resource in a given organization. The quota
    is resolved in the following order:
    1. Organization-specific quota override
    2. Organization's assigned plan quota (if the plan has this resource)
    3. Network's default plan quota (using network.default_plan_id)
    4. Network's direct quota
    5. Returns zero as final fallback
    
    Note: If an organization has an assigned plan but that plan doesn't define
    a quota for the requested resource, it falls back to step 3 (network's default plan)
    rather than returning 0. This ensures backward compatibility when new resource
    types are added to the system.
  """
  def get_quota_for_organization(organization_id, resource) do
    # 1. Check for organization-specific quota override
    organization_quota =
      Repo.one(
        from(quotas in QuotasOrganizations,
          where: quotas.organization_id == ^organization_id,
          where: quotas.resource == ^resource
        )
      )

    if organization_quota do
      organization_quota.max
    else
      # 2. Check for organization's assigned plan
      po =
        Repo.one(
          from(plans_organizations in PlansOrganizations,
            where: plans_organizations.organization_id == ^organization_id
          )
        )

      if po do
        plan_id = po.plan_id

        plan_quotas =
          Repo.one(
            from(plans_quotas in PlansQuotas,
              where: plans_quotas.plan_id == ^plan_id,
              where: plans_quotas.resource == ^resource
            )
          )

        if plan_quotas do
          plan_quotas.max
        else
          # Plan exists but doesn't have this resource quota
          # Fall back to network's default plan
          get_quota_from_network_default_plan(organization_id, resource)
        end
      else
        # 3. Fall back to network's default plan
        get_quota_from_network_default_plan(organization_id, resource)
      end
    end
  end

  # Get quota from the network's default plan.
  # Uses the network's default_plan_id field to find the default plan.
  defp get_quota_from_network_default_plan(organization_id, resource) do
    # Get the organization with its network preloaded
    org =
      Repo.one(
        from(o in Castmill.Organizations.Organization,
          where: o.id == ^organization_id,
          join: n in assoc(o, :network),
          preload: [network: n]
        )
      )

    if org && org.network && org.network.default_plan_id do
      # Get the quota from the default plan
      plan_quota =
        Repo.one(
          from(plans_quotas in PlansQuotas,
            where: plans_quotas.plan_id == ^org.network.default_plan_id,
            where: plans_quotas.resource == ^resource
          )
        )

      if plan_quota do
        plan_quota.max
      else
        # Fall back to network's direct quotas
        get_quota_for_network(org.network.id, resource)
      end
    else
      # Fall back to network's direct quotas if no default plan
      if org && org.network_id do
        get_quota_for_network(org.network_id, resource)
      else
        0
      end
    end
  end

  @doc """
    Returns the quota for a given resource in a given network. The quota
    is based on the network's quotas if the network has one,
    otherwise it's done against the network plan.
  """
  def get_quota_for_network(network_id, resource) do
    network_quotas =
      Repo.one(
        from(quotas in QuotasNetworks,
          where: quotas.network_id == ^network_id,
          where: quotas.resource == ^resource
        )
      )

    if network_quotas do
      network_quotas.max
    else
      0
    end
  end

  @doc """
    Returns the list of quotas for a given network.
  """
  def get_all_quotas_for_network(network_id) do
    Repo.all(from(quotas in QuotasNetworks, where: quotas.network_id == ^network_id))
  end

  @doc """
    Check if organization has enough quota for a given resource.
    The check is done against against the organization quotas if the organization has one,
    otherwise it's done against the organization plan.

    Returns true if the organization has enough quota, false otherwise.
  """
  def has_organization_enough_quota?(organization_id, resource, amount) do
    max_quota = get_quota_for_organization(organization_id, resource)
    max_quota >= amount
  end

  @doc """
    Check if network has enough quota for a given resource.
    The check is done against against the network's quotas if the network has one,
    otherwise it's done against the network plan.

    Returns true if the network has enough quota, false otherwise.
  """
  def has_network_enough_quota?(network_id, resource, amount) do
    max_quota = get_quota_for_network(network_id, resource)
    max_quota >= amount
  end

  @doc """
    Check the amount of quota used for a given resource in a given organization.
    i.e. how many resources of a given type are used in a given organization.

    For storage, returns the total file size in bytes.
    For other resources, returns the count.
  """
  def get_quota_used_for_organization(organization_id, :storage) do
    # Sum the size of all files associated with media in the organization
    from(m in Castmill.Resources.Media,
      join: fm in Castmill.Files.FilesMedias,
      on: fm.media_id == m.id,
      join: f in Castmill.Files.File,
      on: f.id == fm.file_id,
      where: m.organization_id == ^organization_id,
      select: sum(f.size)
    )
    |> Repo.one()
    |> case do
      nil -> 0
      size -> size
    end
  end

  def get_quota_used_for_organization(organization_id, Castmill.Organizations.OrganizationsUsers) do
    # Count users in the organization (via the join table)
    from(ou in Castmill.Organizations.OrganizationsUsers,
      where: ou.organization_id == ^organization_id,
      select: count(ou.user_id)
    )
    |> Repo.one()
  end

  def get_quota_used_for_organization(organization_id, schema_module) do
    from(r in schema_module,
      where: r.organization_id == ^organization_id,
      select: count(r.id)
    )
    |> Repo.one()
  end

  @doc """
    Add a quota for a network
  """
  def add_quota_to_network(network_id, resource, max) do
    Repo.insert!(%QuotasNetworks{network_id: network_id, resource: resource, max: max})
  end

  @doc """
    Returns the list of quotas for an organization.
  """
  def list_quotas(organization_id) do
    Repo.all(
      from(quotas in QuotasOrganizations, where: quotas.organization_id == ^organization_id)
    )
  end

  @doc """
    Add a quota for an organization.
  """
  def add_quota_to_organization(organization_id, resource, max) do
    Repo.insert!(%QuotasOrganizations{
      organization_id: organization_id,
      resource: resource,
      max: max
    })
  end

  @doc """
    Update a quota for an organization.
  """
  def update_quota(%QuotasOrganizations{} = quotas_organization, attrs) do
    quotas_organization
    |> QuotasOrganizations.changeset(attrs)
    |> Repo.update()
  end
end
