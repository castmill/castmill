defmodule Castmill.Widgets.Integrations.Rss.Http do
  @moduledoc """
  Hardened HTTP client used to download syndication feeds.

  Feed URLs are supplied by users, so every request is treated as untrusted:

  - Only `http` and `https` URLs are accepted.
  - Hosts that resolve to loopback, private, link-local (including cloud
    metadata endpoints), carrier-grade NAT, multicast or otherwise reserved
    addresses are rejected to prevent server-side request forgery (SSRF).
  - Redirects are followed manually (at most five) and every hop is validated
    with the same rules.
  - Response bodies are streamed and canceled once the compressed transfer
    exceeds the configured limit; decompressed bodies are bounded too.

  ## Configuration

      config :castmill, Castmill.Widgets.Integrations.Rss.Http,
        # Allow feeds hosted on private networks (e.g. in development)
        allow_private_hosts: false,
        # Maximum (decompressed) feed size in bytes
        max_body_bytes: 5_242_880,
        # HTTP client module implementing `get(url, headers, options)` with
        # HTTPoison-compatible return values
        client: HTTPoison
  """

  import Bitwise, only: [&&&: 2, >>>: 2]

  @max_redirects 5
  @default_max_body_bytes 5 * 1024 * 1024
  @recv_timeout 15_000
  @connect_timeout 10_000

  @headers [
    {"User-Agent", "Mozilla/5.0 (compatible; CastmillFeedFetcher/1.0; +https://castmill.io)"},
    {"Accept",
     "application/rss+xml, application/atom+xml, application/rdf+xml, application/feed+json;q=0.9, " <>
       "application/xml;q=0.9, text/xml;q=0.9, application/json;q=0.8, */*;q=0.5"},
    {"Accept-Encoding", "gzip, deflate"}
  ]

  @type response :: %{body: binary(), url: String.t(), content_type: String.t()}

  @type error ::
          :invalid_url
          | :blocked_host
          | :host_not_found
          | :too_many_redirects
          | :redirect_without_location
          | :feed_too_large
          | :unauthorized
          | :forbidden
          | :not_found
          | :rate_limited
          | :server_error
          | :http_error
          | :timeout
          | :connection_refused
          | :network_error

  @doc """
  Downloads `url`, following redirects, and returns the decoded body together
  with the final URL (useful to resolve relative links) and content type.
  """
  @spec get(String.t()) :: {:ok, response()} | {:error, error()}
  def get(url) when is_binary(url), do: get(url, 0)

  defp get(_url, redirects) when redirects > @max_redirects, do: {:error, :too_many_redirects}

  defp get(url, redirects) do
    with {:ok, uri} <- validate_url(url),
         :ok <- ensure_public_host(uri.host) do
      request(url, redirects)
    end
  end

  defp request(url, redirects) do
    options = [
      follow_redirect: false,
      recv_timeout: @recv_timeout,
      timeout: @connect_timeout,
      stream_to: self(),
      async: :once
    ]

    case client().get(url, @headers, options) do
      {:ok, %{__struct__: HTTPoison.AsyncResponse, id: ref}} ->
        case collect_response(ref, %{status: nil, headers: [], chunks: [], size: 0}) do
          {:ok, response} -> handle_response(response, url, redirects)
          error -> error
        end

      {:ok, response} ->
        handle_response(response, url, redirects)

      {:error, %{reason: reason}} ->
        {:error, network_error(reason)}

      {:error, reason} ->
        {:error, network_error(reason)}
    end
  end

  defp collect_response(ref, state) do
    receive do
      %{__struct__: HTTPoison.AsyncStatus, id: ^ref, code: status} ->
        collect_response(ref, %{state | status: status})

      %{__struct__: HTTPoison.AsyncHeaders, id: ^ref, headers: headers} ->
        collect_response(ref, %{state | headers: headers})

      %{__struct__: HTTPoison.AsyncChunk, id: ^ref, chunk: chunk} ->
        size = state.size + byte_size(chunk)

        if size > max_body_bytes() do
          cancel_request(ref)
          {:error, :feed_too_large}
        else
          client().stream_next(%HTTPoison.AsyncResponse{id: ref})
          collect_response(ref, %{state | chunks: [chunk | state.chunks], size: size})
        end

      %{__struct__: HTTPoison.AsyncEnd, id: ^ref} ->
        {:ok,
         %{
           status_code: state.status,
           headers: state.headers,
           body: state.chunks |> Enum.reverse() |> IO.iodata_to_binary()
         }}

      %{__struct__: HTTPoison.Error, id: ^ref, reason: reason} ->
        {:error, network_error(reason)}
    after
      @recv_timeout ->
        cancel_request(ref)
        {:error, :timeout}
    end
  end

  defp cancel_request(ref) do
    if function_exported?(client(), :cancel_request, 1),
      do: client().cancel_request(ref),
      else: :hackney.cancel_request(ref)
  end

  defp handle_response(%{status_code: status, headers: headers, body: body}, url, _redirects)
       when status in 200..299 do
    with {:ok, body} <- decode_body(body || "", header(headers, "content-encoding")) do
      {:ok, %{body: body, url: url, content_type: header(headers, "content-type") || ""}}
    end
  end

  defp handle_response(%{status_code: status, headers: headers}, url, redirects)
       when status in [301, 302, 303, 307, 308] do
    case header(headers, "location") do
      nil -> {:error, :redirect_without_location}
      location -> get(resolve(url, location), redirects + 1)
    end
  end

  defp handle_response(%{status_code: status}, _url, _redirects),
    do: {:error, status_error(status)}

  @doc """
  Validates that `url` is an absolute http(s) URL with a host.
  """
  @spec validate_url(String.t()) :: {:ok, URI.t()} | {:error, :invalid_url}
  def validate_url(url) when is_binary(url) do
    case URI.parse(url) do
      %URI{scheme: scheme, host: host} = uri
      when scheme in ["http", "https"] and is_binary(host) and host != "" ->
        {:ok, uri}

      _ ->
        {:error, :invalid_url}
    end
  rescue
    _ -> {:error, :invalid_url}
  end

  def validate_url(_), do: {:error, :invalid_url}

  @doc """
  Resolves `host` and ensures none of its addresses are private or reserved.
  """
  @spec ensure_public_host(String.t()) :: :ok | {:error, :blocked_host | :host_not_found}
  def ensure_public_host(host) do
    if allow_private_hosts?() do
      :ok
    else
      case resolve_host(host) do
        [] ->
          {:error, :host_not_found}

        addresses ->
          if Enum.all?(addresses, &public_address?/1), do: :ok, else: {:error, :blocked_host}
      end
    end
  end

  defp resolve_host(host) do
    host = host |> String.trim_leading("[") |> String.trim_trailing("]")
    charlist = String.to_charlist(host)

    case :inet.parse_address(charlist) do
      {:ok, address} ->
        [address]

      {:error, _} ->
        Enum.flat_map([:inet, :inet6], fn family ->
          case :inet.getaddrs(charlist, family) do
            {:ok, addresses} -> addresses
            {:error, _} -> []
          end
        end)
    end
  end

  @doc """
  Returns true when `address` is a publicly routable unicast address.
  """
  @spec public_address?(:inet.ip_address()) :: boolean()
  def public_address?({a, b, c, _d}) do
    not (a == 0 or
           a == 10 or
           a == 127 or
           (a == 100 and b in 64..127) or
           (a == 169 and b == 254) or
           (a == 172 and b in 16..31) or
           (a == 192 and b == 0 and c in [0, 2]) or
           (a == 192 and b == 88 and c == 99) or
           (a == 192 and b == 168) or
           (a == 198 and b in 18..19) or
           (a == 198 and b == 51 and c == 100) or
           (a == 203 and b == 0 and c == 113) or
           a >= 224)
  end

  # IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible / NAT64 addresses embed an
  # IPv4 address that must be checked as such.
  def public_address?({0, 0, 0, 0, 0, 0xFFFF, hi, lo}), do: public_address?(ipv4(hi, lo))
  def public_address?({0x64, 0xFF9B, 0, 0, 0, 0, hi, lo}), do: public_address?(ipv4(hi, lo))
  def public_address?({0, 0, 0, 0, 0, 0, _hi, _lo}), do: false

  def public_address?({first, second, _, _, _, _, _, _}) do
    not ((first &&& 0xFE00) == 0xFC00 or
           (first &&& 0xFFC0) == 0xFE80 or
           (first &&& 0xFFC0) == 0xFEC0 or
           (first &&& 0xFF00) == 0xFF00 or
           (first == 0x2001 and second == 0x0DB8) or
           (first == 0x2001 and second < 0x0200) or
           first == 0x2002 or
           first < 0x2000)
  end

  def public_address?(_), do: false

  defp ipv4(hi, lo), do: {hi >>> 8, hi &&& 0xFF, lo >>> 8, lo &&& 0xFF}

  @doc """
  Resolves a (possibly relative) `location` against `base`.
  """
  @spec resolve(String.t(), String.t()) :: String.t()
  def resolve(base, location) do
    location = String.trim(location)

    try do
      base |> URI.merge(location) |> URI.to_string()
    rescue
      _ -> location
    end
  end

  # ==========================================================================
  # Body decoding
  # ==========================================================================

  defp decode_body(body, encoding) do
    max = max_body_bytes()

    cond do
      byte_size(body) > max -> {:error, :feed_too_large}
      gzip?(body, encoding) -> inflate(body, 31, max)
      encoding_is?(encoding, "deflate") -> inflate_deflate(body, max)
      true -> {:ok, body}
    end
  end

  # Some servers compress without announcing it, so the gzip magic number is
  # checked too.
  defp gzip?(<<0x1F, 0x8B, _::binary>>, _encoding), do: true

  defp gzip?(_body, encoding),
    do: encoding_is?(encoding, "gzip") or encoding_is?(encoding, "x-gzip")

  defp encoding_is?(nil, _), do: false
  defp encoding_is?(encoding, name), do: String.downcase(String.trim(encoding)) == name

  defp inflate_deflate(body, max) do
    # "deflate" should be zlib-wrapped, but raw deflate streams are common.
    case inflate(body, 15, max) do
      {:ok, _} = ok -> ok
      {:error, :feed_too_large} = error -> error
      {:error, _} -> inflate(body, -15, max)
    end
  end

  defp inflate(body, window_bits, max) do
    z = :zlib.open()

    try do
      :ok = :zlib.inflateInit(z, window_bits)
      inflate_loop(z, :zlib.safeInflate(z, body), [], 0, max)
    rescue
      _ -> {:error, :network_error}
    catch
      _kind, _reason -> {:error, :network_error}
    after
      :zlib.close(z)
    end
  end

  defp inflate_loop(z, {status, output}, acc, size, max) do
    size = size + IO.iodata_length(output)

    cond do
      size > max ->
        {:error, :feed_too_large}

      status == :continue ->
        inflate_loop(z, :zlib.safeInflate(z, []), [output | acc], size, max)

      true ->
        {:ok, [output | acc] |> Enum.reverse() |> IO.iodata_to_binary()}
    end
  end

  # ==========================================================================
  # Errors
  # ==========================================================================

  defp status_error(401), do: :unauthorized
  defp status_error(403), do: :forbidden
  defp status_error(404), do: :not_found
  defp status_error(410), do: :not_found
  defp status_error(429), do: :rate_limited
  defp status_error(status) when status >= 500, do: :server_error
  defp status_error(_status), do: :http_error

  defp network_error(reason) when reason in [:timeout, :connect_timeout, :recv_timeout],
    do: :timeout

  defp network_error(:nxdomain), do: :host_not_found
  defp network_error(:econnrefused), do: :connection_refused
  defp network_error(_reason), do: :network_error

  defp header(headers, name) do
    Enum.find_value(headers || [], fn {key, value} ->
      if String.downcase(to_string(key)) == name, do: to_string(value)
    end)
  end

  # ==========================================================================
  # Configuration
  # ==========================================================================

  defp config, do: Application.get_env(:castmill, __MODULE__, [])
  defp client, do: Keyword.get(config(), :client, HTTPoison)
  defp allow_private_hosts?, do: Keyword.get(config(), :allow_private_hosts, false) == true
  defp max_body_bytes, do: Keyword.get(config(), :max_body_bytes, @default_max_body_bytes)
end
