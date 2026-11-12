# Credits: https://websymphony.net/blog/how-to-get-remote-ip-from-x-forwarded-for-in-phoenix/
defmodule Utils.RemoteIp do
  @moduledoc """
  Resolves client IP addresses. `client_ip/1` and the `Plug` callbacks only
  trust `X-Forwarded-For` hops appended by explicitly configured
  `:trusted_proxies` (IP addresses or CIDRs).
  """

  import Bitwise

  @behaviour Plug

  @type cidr :: {:cidr, :inet | :inet6, non_neg_integer(), non_neg_integer()}

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(%Plug.Conn{} = conn, _opts) do
    %{conn | remote_ip: client_ip(conn)}
    |> Plug.Conn.put_private(:remote_ip_resolved, true)
  end

  @spec client_ip(Plug.Conn.t()) :: :inet.ip_address()
  def client_ip(%Plug.Conn{} = conn) do
    remote = normalize_ip(conn.remote_ip)

    if conn.private[:remote_ip_resolved] do
      remote
    else
      trusted = configured_trusted_proxies()

      if trusted != [] and trusted_proxy?(remote, trusted) do
        conn
        |> forwarded_hops()
        |> Enum.reverse()
        |> resolve_hop(remote, trusted)
      else
        remote
      end
    end
  end

  @spec get(Plug.Conn.t()) :: binary()
  def get(conn) do
    forwarded_for =
      conn
      |> Plug.Conn.get_req_header("x-forwarded-for")
      |> List.first()

    if forwarded_for do
      forwarded_for
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> List.first()
    else
      conn.remote_ip
      |> :inet_parse.ntoa()
      |> to_string()
    end
  end

  @spec parse_trusted_proxies!(String.t() | list()) :: [cidr()]
  def parse_trusted_proxies!(value) when is_binary(value) do
    value
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> parse_trusted_proxies!()
  end

  def parse_trusted_proxies!(entries) when is_list(entries) do
    Enum.map(entries, &parse_cidr!/1)
  end

  def parse_trusted_proxies!(other) do
    raise ArgumentError, "invalid trusted_proxies configuration: #{inspect(other)}"
  end

  @spec parse_ip(String.t()) :: {:ok, :inet.ip_address()} | :error
  def parse_ip(value) when is_binary(value) do
    trimmed = value |> String.trim() |> String.trim("\"")

    cond do
      trimmed == "" ->
        :error

      String.starts_with?(trimmed, "[") ->
        parse_bracketed_ipv6(trimmed)

      true ->
        case :inet.parse_strict_address(String.to_charlist(trimmed)) do
          {:ok, ip} -> {:ok, normalize_ip(ip)}
          {:error, _} -> parse_ipv4_with_port(trimmed)
        end
    end
  end

  def parse_ip(_), do: :error

  defp configured_trusted_proxies do
    :castmill
    |> Application.get_env(:trusted_proxies, [])
    |> parse_trusted_proxies!()
  end

  defp forwarded_hops(conn) do
    conn
    |> Plug.Conn.get_req_header("x-forwarded-for")
    |> Enum.flat_map(&String.split(&1, ","))
    |> Enum.map(&String.trim/1)
  end

  defp resolve_hop([], current, _trusted), do: current

  defp resolve_hop([hop | rest], current, trusted) do
    case parse_ip(hop) do
      {:ok, ip} ->
        if trusted_proxy?(ip, trusted),
          do: resolve_hop(rest, ip, trusted),
          else: ip

      :error ->
        current
    end
  end

  defp trusted_proxy?(ip, cidrs) do
    {family, addr_int} =
      case normalize_ip(ip) do
        {_, _, _, _} = v4 -> {:inet, ip_to_integer(v4)}
        {_, _, _, _, _, _, _, _} = v6 -> {:inet6, ip_to_integer(v6)}
      end

    Enum.any?(cidrs, fn {:cidr, cidr_family, network, mask} ->
      cidr_family == family and (addr_int &&& mask) == network
    end)
  end

  defp parse_cidr!({:cidr, family, network, mask} = cidr)
       when family in [:inet, :inet6] and is_integer(network) and is_integer(mask),
       do: cidr

  defp parse_cidr!({raw_ip, prefix} = entry) when is_tuple(raw_ip) and is_integer(prefix) do
    case raw_ip do
      {0, 0, 0, 0, 0, 0xFFFF, _, _} when prefix in 96..128 ->
        build_cidr!(normalize_ip(raw_ip), prefix - 96, entry)

      {0, 0, 0, 0, 0, 0xFFFF, _, _} ->
        raise ArgumentError, "invalid trusted proxy entry: #{inspect(entry)}"

      ip ->
        build_cidr!(ip, prefix, entry)
    end
  end

  defp parse_cidr!(raw_ip) when is_tuple(raw_ip) do
    ip = normalize_ip(raw_ip)
    max_bits = if tuple_size(ip) == 4, do: 32, else: 128
    build_cidr!(ip, max_bits, raw_ip)
  end

  defp parse_cidr!(entry) when is_binary(entry) do
    case String.split(String.trim(entry), "/", parts: 2) do
      [ip_str] ->
        case :inet.parse_strict_address(String.to_charlist(ip_str)) do
          {:ok, raw_ip} ->
            ip = normalize_ip(raw_ip)
            max_bits = if tuple_size(ip) == 4, do: 32, else: 128
            build_cidr!(ip, max_bits, entry)

          {:error, _} ->
            raise ArgumentError, "invalid trusted proxy entry: #{inspect(entry)}"
        end

      [ip_str, prefix_str] ->
        with {prefix, ""} <- Integer.parse(prefix_str),
             {:ok, raw_ip} <- :inet.parse_strict_address(String.to_charlist(ip_str)) do
          parse_cidr_tuple!(raw_ip, prefix, entry)
        else
          _ -> raise ArgumentError, "invalid trusted proxy entry: #{inspect(entry)}"
        end
    end
  end

  defp parse_cidr!(other) do
    raise ArgumentError, "invalid trusted proxy entry: #{inspect(other)}"
  end

  defp parse_cidr_tuple!({0, 0, 0, 0, 0, 0xFFFF, _, _} = raw_ip, prefix, entry) do
    if prefix in 96..128 do
      build_cidr!(normalize_ip(raw_ip), prefix - 96, entry)
    else
      raise ArgumentError, "invalid trusted proxy entry: #{inspect(entry)}"
    end
  end

  defp parse_cidr_tuple!(raw_ip, prefix, entry), do: build_cidr!(raw_ip, prefix, entry)

  defp build_cidr!({a, b, c, d} = ip, prefix, label)
       when a in 0..255 and b in 0..255 and c in 0..255 and d in 0..255 do
    if prefix in 0..32 do
      mask = cidr_mask(32, prefix)
      {:cidr, :inet, ip_to_integer(ip) &&& mask, mask}
    else
      raise ArgumentError, "invalid trusted proxy entry: #{inspect(label)}"
    end
  end

  defp build_cidr!({s1, s2, s3, s4, s5, s6, s7, s8} = ip, prefix, label)
       when s1 in 0..0xFFFF and s2 in 0..0xFFFF and s3 in 0..0xFFFF and s4 in 0..0xFFFF and
              s5 in 0..0xFFFF and s6 in 0..0xFFFF and s7 in 0..0xFFFF and s8 in 0..0xFFFF do
    if prefix in 0..128 do
      mask = cidr_mask(128, prefix)
      {:cidr, :inet6, ip_to_integer(ip) &&& mask, mask}
    else
      raise ArgumentError, "invalid trusted proxy entry: #{inspect(label)}"
    end
  end

  defp build_cidr!(_ip, _prefix, label) do
    raise ArgumentError, "invalid trusted proxy entry: #{inspect(label)}"
  end

  defp cidr_mask(max_bits, prefix) do
    bxor((1 <<< max_bits) - 1, (1 <<< (max_bits - prefix)) - 1)
  end

  defp ip_to_integer({a, b, c, d}) do
    a <<< 24 ||| b <<< 16 ||| c <<< 8 ||| d
  end

  defp ip_to_integer({s1, s2, s3, s4, s5, s6, s7, s8}) do
    s1 <<< 112 ||| s2 <<< 96 ||| s3 <<< 80 ||| s4 <<< 64 ||| s5 <<< 48 |||
      s6 <<< 32 ||| s7 <<< 16 ||| s8
  end

  defp normalize_ip({0, 0, 0, 0, 0, 0xFFFF, hi, lo}) do
    {hi >>> 8, hi &&& 0xFF, lo >>> 8, lo &&& 0xFF}
  end

  defp normalize_ip(ip), do: ip

  defp parse_bracketed_ipv6(value) do
    case String.split(String.trim_leading(value, "["), "]", parts: 2) do
      [host, ""] ->
        parse_strict_ipv6(host)

      [host, ":" <> port] ->
        if valid_port?(port), do: parse_strict_ipv6(host), else: :error

      _ ->
        :error
    end
  end

  defp parse_strict_ipv6(host) do
    case :inet.parse_strict_address(String.to_charlist(host)) do
      {:ok, {_, _, _, _, _, _, _, _} = ip} -> {:ok, normalize_ip(ip)}
      _ -> :error
    end
  end

  defp parse_ipv4_with_port(value) do
    case String.split(value, ":") do
      [host, port] ->
        with true <- valid_port?(port),
             {:ok, {_, _, _, _} = ip} <- :inet.parse_strict_address(String.to_charlist(host)) do
          {:ok, ip}
        else
          _ -> :error
        end

      _ ->
        :error
    end
  end

  defp valid_port?(port) do
    case Integer.parse(port) do
      {n, ""} when n in 1..65_535 -> true
      _ -> false
    end
  end
end
