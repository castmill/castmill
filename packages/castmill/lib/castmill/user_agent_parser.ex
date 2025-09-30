defmodule Castmill.UserAgentParser do
  @moduledoc """
  Simple User-Agent parser to extract browser and OS information.
  """

  def parse(user_agent) when is_binary(user_agent) do
    %{
      browser: parse_browser(user_agent),
      os: parse_os(user_agent),
      device_name: generate_device_name(user_agent)
    }
  end

  def parse(_), do: %{browser: nil, os: nil, device_name: nil}

  defp parse_browser(ua) do
    cond do
      String.contains?(ua, "Edg/") -> "Edge"
      String.contains?(ua, "Chrome/") and not String.contains?(ua, "Edg/") -> "Chrome"
      String.contains?(ua, "Safari/") and not String.contains?(ua, "Chrome/") -> "Safari"
      String.contains?(ua, "Firefox/") -> "Firefox"
      String.contains?(ua, "Opera/") or String.contains?(ua, "OPR/") -> "Opera"
      true -> "Unknown Browser"
    end
  end

  defp parse_os(ua) do
    cond do
      String.contains?(ua, "Windows NT 10.0") -> "Windows 10/11"
      String.contains?(ua, "Windows NT") -> "Windows"
      String.contains?(ua, "Mac OS X") -> "macOS"
      String.contains?(ua, "iPhone") -> "iOS"
      String.contains?(ua, "iPad") -> "iPadOS"
      String.contains?(ua, "Android") -> "Android"
      String.contains?(ua, "Linux") -> "Linux"
      true -> "Unknown OS"
    end
  end

  defp generate_device_name(ua) do
    os = parse_os(ua)
    browser = parse_browser(ua)

    device =
      cond do
        String.contains?(ua, "iPhone") -> "iPhone"
        String.contains?(ua, "iPad") -> "iPad"
        String.contains?(ua, "Android") -> "Android Device"
        true -> os
      end

    "#{browser} on #{device}"
  end
end
