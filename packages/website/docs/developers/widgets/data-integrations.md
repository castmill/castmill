---
sidebar_position: 7
title: Data integrations
description: Feed widgets with external data through data feeds, pull integrations with server-side fetchers, or push webhooks.
---

A template reads external data through `data.` bindings. Castmill delivers that data to the player together with the widget, caches it on the device, and updates it when it changes. You have three ways to provide it:

| Source | How data arrives | Server code needed | Use it for |
| --- | --- | --- | --- |
| Data feed | You, or an automation, write JSON to a feed through the API | No | Content from scripts, automation tools (Make, Zapier) and back-office systems |
| Pull integration | Castmill calls a fetcher on a schedule or when the data is read | Only for new fetchers | RSS feeds, public APIs, services with API keys or OAuth |
| Push integration | A third party posts JSON to a webhook | No | Not recommended yet; see [Push webhooks](#push-webhooks) |

## Reading a data feed

A [data feed](../../dashboard/feeds.md) is a JSON store owned by the organization. A widget reads one by declaring an option with the built-in `feeds` choice list. No integration or fetcher is needed:

```json
{
  "options_schema": {
    "feed": {
      "type": "string",
      "required": true,
      "choices": { "list": "feeds", "search": true }
    }
  }
}
```

When a user picks a feed for the playlist item, the player receives the feed content as the widget data:

| Binding | Feed mode | Contents |
| --- | --- | --- |
| `data.entries` | List | Entries, newest first. Each entry has its own fields plus `id` and `received_at`. |
| `data.document` | Document | The current JSON document. |
| `data.updated_at` | Both | Time of the last write. |

For example, to show the three latest entries of a list feed in a `paginated-list`:

```json
{
  "type": "paginated-list",
  "name": "posts",
  "style": { "width": "100%", "height": "100%" },
  "opts": {
    "items": { "list": { "key": "data.entries", "limit": 3 } },
    "pageSize": 3,
    "pageDuration": 10
  },
  "component": {
    "type": "text",
    "name": "post-title",
    "opts": { "text": { "key": "$.title" } },
    "style": { "flex": "0 0 auto", "font-size": "4em" }
  }
}
```

The feed's **Connect** tab in the dashboard shows the endpoint and token to write to it. See [Data feeds](../../dashboard/feeds.md) and the [REST API](../rest-api.md).

## Pull integrations

A pull integration runs a fetcher on the Castmill server. The fetcher calls the external service, transforms the response into the shape your template expects, and Castmill stores the result. Players never contact the external service and never see its credentials.

Declare the integration in `widget.json`:

```json
{
  "integration": {
    "type": "PULL",
    "fetcher": "rss",
    "config": {
      "feed_url": "https://hnrss.org/frontpage",
      "refresh_interval": 300
    }
  },
  "options_schema": {
    "feed_url": { "type": "url", "required": true, "default": "https://hnrss.org/frontpage" },
    "max_items": { "type": "number", "default": 10, "min": 1, "max": 50 }
  }
}
```

Castmill creates the integration the first time a user adds the widget to a playlist.

### Integration fields

| Field | Description |
| --- | --- |
| `type` | `PULL`, `PUSH` or `BOTH`. Default `PULL`. |
| `fetcher` | Fetcher that produces the data. `rss` is built in. Other names map to a module in the `Castmill.Widgets.Integrations.Fetchers` namespace, for example `open_meteo` maps to `Castmill.Widgets.Integrations.Fetchers.OpenMeteo`. |
| `config` | Settings passed to the fetcher. See below. |
| `name` | Integration name, unique per widget. Default `default`. |
| `description` | Description shown to administrators. |
| `credential_scope` | `organization` (default): one set of credentials for all items in the organization. `widget`: each playlist item has its own credentials. |
| `refresh_mode` | `scheduled` (default): Castmill polls every `refresh_interval` seconds. `on_demand`: Castmill refreshes only when the data is read and older than `refresh_interval`. Use `on_demand` for paid APIs or for many rarely shown configurations. |

Keys in `config`:

| Key | Description |
| --- | --- |
| `refresh_interval` | Seconds between refreshes. Default `300`. |
| `discriminator_type` | How fetched data is shared. `organization` (default): one copy for the whole organization. `widget_option`: one copy per value of the option named in `discriminator_key`. `widget_config`: one copy per playlist item. The `rss` fetcher always uses `widget_option` with `feed_url`. |
| `discriminator_key` | Option key used with `widget_option`. |
| `endpoint` | Service URL, available to the fetcher. |
| Any other key | Passed to the fetcher unchanged. |

:::caution
With the default `organization` discriminator, all playlist items of the widget in an organization share the same data. If the fetched data depends on an option, such as a location or a calendar, set `discriminator_type` to `widget_option` or `widget_config`.
:::

The fetcher receives the `config` keys merged with the playlist item's options. An item option can override a `config` key only if the widget declares that key in `options_schema`, as `feed_url` above. If the fetched data contains an `items` array, Castmill trims it to the item's `max_items` option (default 10) when it serves the data.

While a refresh is running, players keep showing the last stored data. If no data exists yet, the template renders with the [data schema defaults](./schemas.mdx#data-schema).

### The RSS fetcher

The `rss` fetcher reads RSS and Atom feeds and produces:

| Key | Contents |
| --- | --- |
| `feedTitle`, `feedDescription`, `feedLink`, `feedImage`, `feedLanguage`, `feedFormat` | Feed metadata |
| `lastUpdated` | Time of the fetch |
| `items` | Entries with `id`, `title`, `description`, `link`, `image`, `imageUrl`, `author`, `categories`, `source`, `pubDate` and `pubDateFormatted` |

### Writing a fetcher

A new data source needs a fetcher module in the Castmill server. A fetcher implements the `Castmill.Widgets.Integrations.Fetcher` behaviour and must live in the `Castmill.Widgets.Integrations.Fetchers` namespace:

```elixir
defmodule Castmill.Widgets.Integrations.Fetchers.ParkingSpaces do
  @behaviour Castmill.Widgets.Integrations.Fetcher

  @impl true
  def fetch(credentials, options) do
    url = "#{options["endpoint"]}/garages/#{options["garage_id"]}"
    headers = [{"X-Api-Key", credentials["api_key"]}]

    case HTTPoison.get(url, headers, recv_timeout: 10_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, json} ->
            data = %{
              "name" => json["name"],
              "free" => json["free_spaces"],
              "total" => json["capacity"]
            }

            {:ok, data, credentials}

          {:error, _} ->
            {:error, :json_parse_error, credentials}
        end

      {:ok, %HTTPoison.Response{status_code: status}} ->
        {:error, {:http_error, status}, credentials}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, {:network_error, reason}, credentials}
    end
  end
end
```

`fetch/2` receives the decrypted credentials and the merged options, and returns either `{:ok, data, credentials}` or `{:error, reason, credentials}`. The `data` map becomes the template's `data`. If you return modified credentials, for example after refreshing an OAuth token, Castmill stores them encrypted.

The widget then references the fetcher by name, with `"fetcher": "parking_spaces"`, and sets `"discriminator_type": "widget_option"` with `"discriminator_key": "garage_id"` in `config`, because the data depends on the selected garage.

### Choice lists

To let users pick values from your service, such as calendars or photo albums, instead of typing identifiers, implement the optional `choices/3` callback and declare [choices](./schemas.mdx#choices) in the options schema:

```elixir
@impl true
def choices("garages", params, credentials) do
  query = params["query"] || ""

  {:ok,
   %{
     items: [
       %{value: "g-101", label: "Central Station", description: "420 spaces"},
       %{value: "g-102", label: "Harbour", description: "180 spaces"}
     ]
     |> Enum.filter(&String.contains?(String.downcase(&1.label), String.downcase(query))),
     next: nil
   }}
end
```

The `params` map contains `"options"` (the values of the fields listed in `depends_on`, the integration's `config` and `"display_locale"`), `"query"` (search text), `"cursor"` (the `next` value of the previous page, for pagination) and `"values"` (the currently selected values, which the first page must include if they still exist). Each choice has a `value` and a `label`, and optionally a `description`, a `thumbnail_url` (HTTPS only), a `preview` and `disabled`. Return stable identifiers as values, never URLs.

Castmill rejects the upload of a widget that declares fetcher-backed choices if its fetcher does not implement `choices/3`.

## Credentials

Organization administrators enter integration credentials in the dashboard; see [Widgets](../../dashboard/widgets.md). Castmill encrypts them with the organization's key and passes them to the fetcher. Network administrators can also store network-wide credentials, such as a commercial API key, which Castmill merges with the organization's credentials.

For integrations created from an uploaded `widget.json`, the credential form depends on the fetcher: none for `rss`, and optional for custom fetchers. To define specific credential fields or an OAuth flow, the integration's `credential_schema` must be set on the server.

### Generic OAuth 2.0

A `credential_schema` with `auth_type` `oauth2` enables the authorization code flow for any OAuth 2.0 provider without provider-specific code:

```json
{
  "credential_schema": {
    "auth_type": "oauth2",
    "oauth2": {
      "authorization_url": "https://provider.example.com/oauth/authorize",
      "token_url": "https://provider.example.com/oauth/token",
      "scopes": ["calendar.read"],
      "pkce": true,
      "token_placement": "header",
      "client_auth": "basic"
    },
    "fields": {
      "client_id": { "type": "string", "required": true },
      "client_secret": { "type": "string", "required": true, "sensitive": true }
    }
  }
}
```

| Field | Description |
| --- | --- |
| `authorization_url`, `token_url` | Provider endpoints. |
| `scopes` | Requested scopes. |
| `pkce` | Use PKCE. |
| `token_placement` | Where the access token is sent: `header`, `query` or `body`. |
| `client_auth` | How the client authenticates to the token endpoint: `basic` or `post`. |
| `refresh_margin_seconds` | Refresh the token this many seconds before it expires. Default `300`. |

Register `https://<your-castmill-host>/auth/widget-integrations/callback` as the redirect URI with the provider. Castmill starts the flow at `/auth/widget-integrations/<integration_id>/authorize`, signs the state parameter, and refreshes tokens automatically.

## Push webhooks

An integration of type `PUSH` or `BOTH` accepts data at:

```text
POST /webhooks/widgets/<integration_id>/<widget_config_id>
```

with a JSON body of the form `{"data": {...}}`. The `data` object replaces the stored data of that playlist item.

:::caution
Webhook signature verification is not implemented yet, so the endpoint does not authenticate callers. Use [data feeds](#reading-a-data-feed), which require a token, to push data from external systems.
:::
