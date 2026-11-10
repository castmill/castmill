defmodule Castmill.Widgets.Integrations.Fetcher do
  @moduledoc """
  Behaviour for widget integration fetchers.

  Fetchers are responsible for retrieving data from third-party APIs and transforming it
  to match a widget's data_schema. They handle authentication, error handling, and data transformation.

  ## OAuth 2.0 Support

  Fetchers can update credentials (e.g., refresh OAuth tokens) by returning updated credentials
  in the success or error tuple. The system will automatically save the updated credentials.

  ## Examples

  ### Simple Fetcher (RSS Feed)

      defmodule MyApp.Fetchers.RSS do
        @behaviour Castmill.Widgets.Integrations.Fetcher
        
        def fetch(_credentials, options) do
          url = options["feed_url"]
          
          case HTTPoison.get(url) do
            {:ok, %{body: body}} ->
              items = parse_rss(body)
              {:ok, %{"items" => items}, %{}}
            
            {:error, reason} ->
              {:error, reason, %{}}
          end
        end
      end

  ### OAuth 2.0 Fetcher (with token refresh)

      defmodule MyApp.Fetchers.Spotify do
        @behaviour Castmill.Widgets.Integrations.Fetcher
        
        def fetch(credentials, _options) do
          # Refresh token if needed
          credentials = maybe_refresh_token(credentials)
          
          # Make API call
          case api_call(credentials) do
            {:ok, data} ->
              {:ok, transform_data(data), credentials}
            
            {:error, reason} ->
              {:error, reason, credentials}
          end
        end
      end
  """

  @doc """
  Fetches data from a third-party API.

  ## Parameters

  - `credentials`: Map containing API credentials (encrypted at rest)
  - `options`: Map containing widget configuration options

  ## Returns

  - `{:ok, data, updated_credentials}`: Success with transformed data and updated credentials
  - `{:error, reason, credentials}`: Error with reason and current/updated credentials

  The `data` map should match the widget's `data_schema`.
  The `updated_credentials` map will be saved if it differs from the input credentials.
  """
  @callback fetch(credentials :: map(), options :: map()) ::
              {:ok, data :: map(), updated_credentials :: map()}
              | {:error, reason :: term(), credentials :: map()}

  @typedoc "A selectable value for an options_schema field with `choices`."
  @type choice :: %{
          required(:value) => String.t(),
          required(:label) => String.t(),
          optional(:description) => String.t(),
          optional(:thumbnail_url) => String.t(),
          optional(:preview) => %{
            required(:type) => String.t(),
            required(:url) => String.t(),
            optional(:mime_type) => String.t()
          },
          optional(:disabled) => boolean()
        }

  @doc """
  Lists choices for a widget option (optional).

  Called for options_schema fields declaring `"choices": {"list": list, ...}`.

  ## Parameters

  - `list`: The choice list name from the schema (e.g. `"listings"`, `"images"`)
  - `params`:
    - `"options"`: the integration's `pull_config`, plus the values of the field's
      `depends_on` fields (pull_config wins) and `"display_locale"`
    - `"query"`: search text, or `""`
    - `"cursor"`: the `next` value of the previous page, or `nil`
    - `"values"`: the field's current values; the first page must include the choices
      for these values that still exist
  - `credentials`: the resolved network/organization credentials and settings

  Values must be stable identifiers from the source, never URLs. Thumbnail and preview
  URLs must use https.
  """
  @callback choices(list :: String.t(), params :: map(), credentials :: map()) ::
              {:ok, %{items: [choice()], next: String.t() | nil}} | {:error, term()}

  @optional_callbacks choices: 3
end
