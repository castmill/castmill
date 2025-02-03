defmodule Castmill.QuotasFixtures do
  @moduledoc """
  This module provides test helpers for creating quotas-related entities via the Quotas context.
  """

  alias Castmill.Quotas

  def quota_organization_fixture(attrs \\ %{}) do
    attrs =
      Enum.into(attrs, %{
        organization_id: "00000000-0000-0000-0000-000000000000",
        # Use a resource type that exists in the enum. For example, :medias is defined in the QuotasOrganizations schema
        resource: :medias,
        max: 100
      })

    {:ok, quota} =
      Quotas.add_quota_to_organization(attrs.organization_id, attrs.resource, attrs.max)

    quota
  end
end
