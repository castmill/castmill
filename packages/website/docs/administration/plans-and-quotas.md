---
sidebar_position: 5
title: Plans and quotas
description: How Castmill limits resources per organization, the default plan, and how to change limits.
---

# Plans and quotas

Quotas limit how many resources an organization can create, how much storage it can use and how large a single upload can be. Users see their consumption on the [Usage](../dashboard/usage-and-quotas.md) page, and the dashboard explains which limit was reached when a create action fails.

## How a limit is resolved

For each resource, Castmill uses the first value it finds:

1. An override for the organization.
2. The plan assigned to the organization.
3. The network's default plan.
4. A quota set on the network.
5. Otherwise `0`, which means the resource cannot be created.

A plan that does not mention a resource falls back to the network's default plan for that resource.

## The default plan

Every new network gets a **Default Plan**, which becomes the network's default:

| Resource | Default limit |
| --- | --- |
| `medias` | 1,000 |
| `playlists` | 50 |
| `layouts` | 100 |
| `channels` | 20 |
| `devices` | 20 |
| `teams` | 10 |
| `users` | 50 people (AI agents not included) |
| `agents` | 5 |
| `feeds` | 20 |
| `automations` | 50 |
| `automation_rules` | 500 |
| `tags` | 500 |
| `tag_groups` | 50 |
| `storage` | 1,024 MB |
| `max_upload_size` | 2,048 MB per file |

`storage` includes uploaded media with all generated versions, and media copied from [feeds](../dashboard/feeds.md). Other quota resources are `organizations` (per network) and `channels_entries`.

## Changing limits

There is no plan editor in the dashboard or the admin tool yet. Manage plans from a remote console on the server:

```bash
docker compose exec backend bin/castmill remote
```

Then use the `Castmill.Quotas` module:

```elixir
# Create a plan. Storage and upload sizes are in MB.
plan = Castmill.Quotas.create_plan("Pro", network_id, [
  %{resource: :devices, max: 200},
  %{resource: :storage, max: 51_200}
])

# Assign it to an organization. An organization has at most one plan.
Castmill.Quotas.assign_plan_to_organization(plan.id, organization_id)

# Make it the default for organizations without a plan.
Castmill.Quotas.set_network_default_plan(network_id, plan.id)

# Give one organization a different limit for one resource.
Castmill.Quotas.add_quota_to_organization(organization_id, :devices, 500)
```

You find network and organization IDs in the [admin tool](./admin-tool.md).

A billing [addon](../developers/addons.md) can manage plans automatically, for example by assigning plans when customers change their subscription.

## Reducing a limit

Lowering a limit never deletes anything. If an organization already has more resources than the new limit allows, it keeps them, but it cannot create new ones until it is under the limit again.
