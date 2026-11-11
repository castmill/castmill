defmodule Castmill.SafeHttp.FakeClient do
  @moduledoc false
  # HTTPoison compatible fake used by `Castmill.SafeHttp` tests and its callers
  # (e.g. the RSS fetcher). Responses are stored in the calling test process,
  # so tests using it must not be async (the client is configured through the
  # application environment).

  alias Castmill.SafeHttp

  def install(config \\ []) do
    previous = Application.get_env(:castmill, SafeHttp)

    Application.put_env(
      :castmill,
      SafeHttp,
      Keyword.merge([client: __MODULE__, allow_private_hosts: true], config)
    )

    ExUnit.Callbacks.on_exit(fn ->
      if previous,
        do: Application.put_env(:castmill, SafeHttp, previous),
        else: Application.delete_env(:castmill, SafeHttp)
    end)

    :ok
  end

  def stub(url, response), do: Process.put({__MODULE__, url}, response)

  def ok(body, headers \\ [{"Content-Type", "application/rss+xml"}]),
    do: {:ok, %{status_code: 200, headers: headers, body: body}}

  def get(url, headers, options) do
    send(self(), {:safe_http_get, url, headers, options})

    case Process.get({__MODULE__, url}) do
      nil ->
        {:error, %{reason: :nxdomain}}

      response when is_function(response, 0) ->
        response.()

      {:ok, %{status_code: status, headers: response_headers, body: body}} = response ->
        if options[:stream_to] do
          ref = make_ref()
          target = options[:stream_to]
          chunks = chunks(body || "")

          # Like hackney's `async: :once`, every message after the status
          # is only sent when the caller asks for it with `stream_next/1`.
          send(target, struct(HTTPoison.AsyncStatus, id: ref, code: status))

          remaining =
            [struct(HTTPoison.AsyncHeaders, id: ref, headers: response_headers || [])] ++
              Enum.map(chunks, &struct(HTTPoison.AsyncChunk, id: ref, chunk: &1)) ++
              [struct(HTTPoison.AsyncEnd, id: ref)]

          Process.put({__MODULE__, ref}, {target, remaining})

          {:ok, struct(HTTPoison.AsyncResponse, id: ref)}
        else
          response
        end

      response ->
        response
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
    send(self(), {:safe_http_cancel, ref})
    :ok
  end

  defp chunks(body), do: chunks(body, [])

  defp chunks(<<chunk::binary-size(1024), rest::binary>>, acc),
    do: chunks(rest, [chunk | acc])

  defp chunks(rest, acc) when byte_size(rest) > 0, do: Enum.reverse([rest | acc])
  defp chunks(<<>>, acc), do: Enum.reverse(acc)
end
