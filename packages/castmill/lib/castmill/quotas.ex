defmodule Castmill.Quotas do
  @moduledoc """
  The Quotas context.
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Quotas.Plan
  alias Castmill.Quotas.PlansQuotas
  alias Castmill.Quotas.PlansOrganizations
  alias Castmill.Quotas.PlansNetworks

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
    Returns the quota for a given resource in a given organization. The quota
    is based on the organization's quotas if the organization has one,
    otherwise it's done against the organization plan.
  """
  def get_quota_for_organization(organization_id, resource) do
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

        plan_quotas.max
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
  """
  def get_quota_used_for_organization(query, organization_id) do
    query
    |> where(organization_id: ^organization_id)
    |> select(count(:id))
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
