defmodule Utils.RemoteIpTest do
  use ExUnit.Case, async: false

  setup do
    previous = Application.get_env(:castmill, :trusted_proxies, [])
    on_exit(fn -> Application.put_env(:castmill, :trusted_proxies, previous) end)
    :ok
  end

  test "ignores forwarded headers when no trusted proxies are configured" do
    Application.put_env(:castmill, :trusted_proxies, [])

    conn =
      %Plug.Conn{remote_ip: {203, 0, 113, 10}}
      |> Plug.Conn.put_req_header("x-forwarded-for", "198.51.100.1")

    assert Utils.RemoteIp.client_ip(conn) == {203, 0, 113, 10}
  end

  test "ignores forwarded headers when remote_ip is not a trusted proxy" do
    Application.put_env(:castmill, :trusted_proxies, ["10.0.0.0/8", "127.0.0.1"])

    conn =
      %Plug.Conn{remote_ip: {203, 0, 113, 10}}
      |> Plug.Conn.put_req_header("x-forwarded-for", "198.51.100.1")

    assert Utils.RemoteIp.client_ip(conn) == {203, 0, 113, 10}
  end

  test "peels multiple trusted proxies right-to-left and stops at first untrusted IP" do
    Application.put_env(
      :castmill,
      :trusted_proxies,
      Utils.RemoteIp.parse_trusted_proxies!("10.0.0.0/8, 172.16.0.0/12, fd00::/8")
    )

    conn = %Plug.Conn{
      remote_ip: {10, 0, 1, 2},
      req_headers: [
        {"x-forwarded-for", "203.0.113.88, 198.51.100.42"},
        {"x-forwarded-for", "172.20.0.5"}
      ]
    }

    assert Utils.RemoteIp.client_ip(conn) == {198, 51, 100, 42}
  end

  test "normalizes IPv4-mapped IPv6 remote_ip and supports ports and IPv6 addresses" do
    Application.put_env(:castmill, :trusted_proxies, ["10.0.0.0/8", "::1", "fd00::/8"])

    mapped_proxy = {0, 0, 0, 0, 0, 0xFFFF, 0x0A00, 0x0005}

    conn =
      %Plug.Conn{remote_ip: mapped_proxy}
      |> Plug.Conn.put_req_header("x-forwarded-for", "198.51.100.7:54321")

    assert Utils.RemoteIp.client_ip(conn) == {198, 51, 100, 7}

    ipv6_conn =
      %Plug.Conn{remote_ip: {0, 0, 0, 0, 0, 0, 0, 1}}
      |> Plug.Conn.put_req_header("x-forwarded-for", "[2001:db8::9]:8443, fd00::1")

    assert Utils.RemoteIp.client_ip(ipv6_conn) == {0x2001, 0x0DB8, 0, 0, 0, 0, 0, 9}
  end

  test "stops at last verified IP on malformed or all-trusted hops and is idempotent as a plug" do
    Application.put_env(:castmill, :trusted_proxies, [{{10, 0, 0, 0}, 8}, {127, 0, 0, 1}])

    malformed =
      %Plug.Conn{remote_ip: {127, 0, 0, 1}}
      |> Plug.Conn.put_req_header("x-forwarded-for", "198.51.100.7, invalid, 10.0.0.2")

    assert Utils.RemoteIp.client_ip(malformed) == {10, 0, 0, 2}

    all_trusted =
      %Plug.Conn{remote_ip: {127, 0, 0, 1}}
      |> Plug.Conn.put_req_header("x-forwarded-for", "10.0.0.9")
      |> Utils.RemoteIp.call(Utils.RemoteIp.init([]))

    assert all_trusted.remote_ip == {10, 0, 0, 9}

    # Calling client_ip again after the plug must not re-parse X-Forwarded-For.
    tampered = Plug.Conn.put_req_header(all_trusted, "x-forwarded-for", "198.51.100.99")
    assert Utils.RemoteIp.client_ip(tampered) == {10, 0, 0, 9}
  end

  test "validates trusted proxy configuration and rejects invalid entries" do
    assert length(Utils.RemoteIp.parse_trusted_proxies!("::ffff:10.0.0.0/104, 192.168.1.1")) == 2

    for bad <- ["not-an-ip", "10.0.0.0/33", "2001:db8::/129", "::ffff:10.0.0.0/64", 123] do
      assert_raise ArgumentError, fn -> Utils.RemoteIp.parse_trusted_proxies!(bad) end
    end
  end
end
