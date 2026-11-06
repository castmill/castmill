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
      {:ok, %{status_code: status, headers: response_headers, body: body}} = response ->
        if options[:stream_to] do
          ref = make_ref()
          target = options[:stream_to]
          chunks = chunks(body || "")

          send(target, struct(HTTPoison.AsyncStatus, id: ref, code: status))
          send(target, struct(HTTPoison.AsyncHeaders, id: ref, headers: response_headers || []))

          case Enum.map(chunks, &struct(HTTPoison.AsyncChunk, id: ref, chunk: &1)) ++
                 [struct(HTTPoison.AsyncEnd, id: ref)] do
            [end_event] ->
              send(target, end_event)

            events ->
              Process.put({__MODULE__, ref}, {target, events})
          end

          {:ok, struct(HTTPoison.AsyncResponse, id: ref)}
        else
          response
        end

      response -> response
    end
  end

  def stream_next(%HTTPoison.AsyncResponse{id: ref}), do: stream_next(ref)

  def stream_next(ref) do
    case Process.get({__MODULE__, ref}) do
      {target, [event | remaining]} ->
        send(target, event)

        if remaining == [],
          do: Process.delete({__MODULE__, ref}),
          else: Process.put({__MODULE__, ref}, {target, remaining})

      _ ->
        :ok
    end
  end

  def cancel_request(ref) do
    Process.delete({__MODULE__, ref})
    send(self(), {:rss_http_cancel, ref})
    :ok
  end

  defp chunks(<<chunk::binary-size(1024), rest::binary>>, acc),
    do: chunks(rest, [chunk | acc])

  defp chunks(rest, acc) when byte_size(rest) > 0, do: Enum.reverse([rest | acc])
  defp chunks(<<>>, acc), do: Enum.reverse(acc)
end
