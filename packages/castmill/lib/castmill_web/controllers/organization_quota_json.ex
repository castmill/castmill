defmodule CastmillWeb.OrganizationQuotaJSON do
  alias Castmill.Quotas.QuotasOrganizations

  @doc """
  Renders a list of quotas.
  """
  def index(%{quotas: quotas}) do
    %{data: for(quota <- quotas, do: data(quota))}
  end

  @doc """
  Renders a single quota.
  """
  def show(%{quota: quota}) do
    %{data: data(quota)}
  end

  @doc """
  Renders quota usage information.
  """
  def usage(%{usage: usage, max: max}) do
    %{data: %{usage: usage, max: max}}
  end

  defp data(%QuotasOrganizations{} = quota) do
    %{
      resource: quota.resource,
      max: quota.max,
      organization_id: quota.organization_id
    }
  end

  defp data(%{resource: resource, max: max}) do
    %{
      resource: resource,
      max: max
    }
  end
end
