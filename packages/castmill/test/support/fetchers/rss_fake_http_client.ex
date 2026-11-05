defmodule Castmill.Widgets.Integrations.Rss.FakeHttpClient do
  @moduledoc false
  # HTTPoison compatible fake used by the RSS fetcher tests. Responses are
  # stored in the calling test process, so tests using it must not be async
  # (the client is configured through the application environment).

  alias Castmill.Widgets.Integrations.Rss.Http

  def install(config \\ []) do
    previous = Application.get_env(:castmill, Http)

    Application.put_env(
      :castmill,
      Http,
      Keyword.merge([client: __MODULE__, allow_private_hosts: true], config)
    )

    ExUnit.Callbacks.on_exit(fn ->
      if previous,
        do: Application.put_env(:castmill, Http, previous),
        else: Application.delete_env(:castmill, Http)
    end)

    :ok
  end

  def stub(url, response), do: Process.put({__MODULE__, url}, response)

  def ok(body, headers \\ [{"Content-Type", "application/rss+xml"}]),
    do: {:ok, %{status_code: 200, headers: headers, body: body}}

  def get(url, headers, options) do
    send(self(), {:rss_http_get, url, headers, options})

    case Process.get({__MODULE__, url}) do
      nil -> {:error, %{reason: :nxdomain}}
      response when is_function(response, 0) -> response.()
      response -> response
    end
  end
end
