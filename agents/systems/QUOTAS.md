# Quotas System

The Castmill Quotas system manages resource limits for organizations and networks. It supports flexible quota assignment through plans, organization-specific overrides, and network-level defaults.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Quota Resolution Order                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Organization-specific quota override (QuotasOrganizations)   │
│ 2. Organization's assigned plan quota (PlansOrganizations)      │
│ 3. Network's default plan quota (network.default_plan_id)       │
│ 4. Network's direct quota (QuotasNetworks)                      │
│ 5. Zero (final fallback)                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Core Modules

### Context Module
- **`Castmill.Quotas`** - Main context module with all quota operations

### Schema Modules
Located in `lib/castmill/quotas/`:

| Module | Table | Purpose |
|--------|-------|---------|
| `Castmill.Quotas.Plan` | `plans` | Defines named plans (e.g., "Basic", "Pro", "Free") |
| `Castmill.Quotas.PlansQuotas` | `plans_quotas` | Links plans to specific resource quotas |
| `Castmill.Quotas.PlansOrganizations` | `plans_organizations` | Assigns plans to organizations |
| `Castmill.Quotas.QuotasNetworks` | `quotas_networks` | Direct quotas for networks |
| `Castmill.Quotas.QuotasOrganizations` | `quotas_organizations` | Organization-specific quota overrides |

## Database Schema

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│      plans       │     │    plans_quotas     │     │     networks     │
├──────────────────┤     ├─────────────────────┤     ├──────────────────┤
│ id               │────<│ plan_id             │     │ id               │
│ name             │     │ resource (string)   │     │ default_plan_id  │──┐
│ network_id       │     │ max (integer)       │     │ ...              │  │
│ timestamps       │     └─────────────────────┘     └──────────────────┘  │
└──────────────────┘                                                       │
        │                                                                  │
        └──────────────────────────────────────────────────────────────────┘

┌────────────────────────┐     ┌─────────────────────────┐
│  plans_organizations   │     │  quotas_organizations   │
├────────────────────────┤     ├─────────────────────────┤
│ plan_id                │     │ organization_id         │
│ organization_id        │     │ resource (string)       │
└────────────────────────┘     │ max (integer)           │
                               └─────────────────────────┘

┌─────────────────────┐
│   quotas_networks   │
├─────────────────────┤
│ network_id          │
│ resource (string)   │
│ max (integer)       │
└─────────────────────┘
```

## Key Functions

### Reading Quotas

```elixir
# Get quota for a specific resource in an organization
Castmill.Quotas.get_quota_for_organization(organization_id, resource)

# Get quota for a specific resource in a network
Castmill.Quotas.get_quota_for_network(network_id, resource)

# Get all quotas for an organization
Castmill.Quotas.list_quotas(organization_id)

# Get all quotas for a network
Castmill.Quotas.get_all_quotas_for_network(network_id)
```

### Checking Quota Usage

```elixir
# Check if organization has enough quota
Castmill.Quotas.has_organization_enough_quota?(organization_id, resource, amount)

# Check if network has enough quota
Castmill.Quotas.has_network_enough_quota?(network_id, resource, amount)

# Get current usage for a resource
Castmill.Quotas.get_quota_used_for_organization(organization_id, schema_module)
Castmill.Quotas.get_quota_used_for_organization(organization_id, :storage)
```

### Managing Plans

```elixir
# Create a plan with quotas
Castmill.Quotas.create_plan("Pro", network_id, [
  %{resource: "devices", max: 100},
  %{resource: "storage", max: 10_737_418_240}
])

# List plans
Castmill.Quotas.list_plans()
Castmill.Quotas.list_plans(network_id)

# Delete a plan
Castmill.Quotas.delete_plan(plan_id)

# Assign plan to organization
Castmill.Quotas.assign_plan_to_organization(plan_id, organization_id)

# Set network's default plan
Castmill.Quotas.set_network_default_plan(network_id, plan_id)
```

### Managing Quotas Directly

```elixir
# Add/update network quotas
Castmill.Quotas.assign_quota_to_network(network_id, resource, max)
Castmill.Quotas.update_quota_for_network(network_id, resource, max)

# Add/update organization quota overrides
Castmill.Quotas.add_quota_to_organization(organization_id, resource, max)
Castmill.Quotas.update_quota(quotas_organization, %{max: new_max})
```

## Resource Types

Resources are stored as strings. Common resource types include:

| Resource | Schema Module | Description |
|----------|---------------|-------------|
| `"devices"` | `Castmill.Devices.Device` | Number of devices |
| `"channels"` | `Castmill.Resources.Channel` | Number of channels |
| `"playlists"` | `Castmill.Resources.Playlist` | Number of playlists |
| `"medias"` | `Castmill.Resources.Media` | Number of media items |
| `"users"` | `Castmill.Organizations.OrganizationsUsers` | Number of users |
| `:storage` | (special) | Total file storage in bytes |
| `:max_upload_size` | (special) | Max upload size per file in bytes |

> **Note:** The `max` column in all quota tables uses `bigint` (int8) to support
> storing byte values for storage and max_upload_size without overflow.

## Integration with Billing (castmill-saas)

When using the billing addon in castmill-saas, the quotas system integrates with Stripe subscriptions:

1. **Plan Mapping**: Stripe subscription plans map to Castmill plans by name
2. **Subscription Changes**: When a subscription changes, `update_organization_plan` updates the `plans_organizations` association
3. **Cancellation**: When cancelled, organization is moved to "Free" plan

```elixir
# In CastmillBilling module
defp find_or_create_plan(name) do
  case Castmill.Repo.get_by(Castmill.Quotas.Plan, name: name) do
    nil ->
      %Castmill.Quotas.Plan{}
      |> Castmill.Quotas.Plan.changeset(%{name: name})
      |> Castmill.Repo.insert()
    plan ->
      {:ok, plan}
  end
end

defp update_organization_plan(org_id, plan_id) do
  import Ecto.Query
  
  # Remove existing plan associations
  from(po in Castmill.Quotas.PlansOrganizations, where: po.organization_id == ^org_id)
  |> Castmill.Repo.delete_all()

  # Add new plan association
  %Castmill.Quotas.PlansOrganizations{}
  |> Castmill.Quotas.PlansOrganizations.changeset(%{
    organization_id: org_id,
    plan_id: plan_id
  })
  |> Castmill.Repo.insert()
end
```

## Usage Pattern in Controllers

```elixir
# Check quota before creating a resource
def create(conn, params) do
  org_id = params["organization_id"]
  
  if Castmill.Quotas.has_organization_enough_quota?(org_id, "devices", 1) do
    # Proceed with creation
  else
    conn
    |> put_status(:forbidden)
    |> json(%{error: "Quota exceeded for devices"})
  end
end
```

## Important Notes

1. **Fallback Behavior**: If an organization has a plan but the plan doesn't define a quota for a requested resource, it falls back to the network's default plan, not zero.

2. **Storage Calculation**: Storage quota is calculated by summing file sizes from `files` table via `files_medias` join.

3. **User Count**: User quotas count entries in `organizations_users` join table, not the users table directly.

4. **Plans are Network-Scoped**: Plans belong to a network via `network_id` field.

5. **One Plan Per Organization**: An organization can only have one plan assigned at a time (enforced by unique constraint).
