defmodule Castmill.EmailBrand do
  @moduledoc """
  How an email presents itself.

  Emails sent for a network are branded as that network: its name as the
  sender name and in the text, its contact email as Reply-To and support
  address, and its copyright. White-label networks therefore never show
  Castmill. Emails without a network are branded as Castmill.

  All emails share the configured sender address (`:mailer_from`); only the
  sender name changes, so no extra DNS setup is needed.

  The brand also carries what `Castmill.EmailLayout` shows: the logo for
  light and dark backgrounds, the dashboard URL and the button colour.
  """
  import Swoosh.Email, only: [from: 2, reply_to: 2]

  alias Castmill.Networks.Network

  defstruct [
    :name,
    :sender_name,
    :reply_to,
    :support_email,
    :support_url,
    :copyright,
    :logo_url,
    :logo_dark_url,
    :dashboard_url,
    :accent,
    :logo_backdrop
  ]

  @type t :: %__MODULE__{
          name: String.t(),
          sender_name: String.t() | nil,
          reply_to: String.t() | nil,
          support_email: String.t() | nil,
          support_url: String.t() | nil,
          copyright: String.t(),
          logo_url: String.t() | nil,
          logo_dark_url: String.t() | nil,
          dashboard_url: String.t() | nil,
          accent: String.t() | nil,
          logo_backdrop: :dark | :light | nil
        }

  # Castmill's button colour; networks get a neutral one that suits any logo.
  @castmill_accent "#2563eb"

  @doc "The brand of `network` (a network, its id, or nil for Castmill)."
  @spec for_network(Network.t() | String.t() | nil) :: t()
  def for_network(%Network{} = network) do
    name = present(network.name) || "Castmill"
    email = contact_email(network.email)

    {logo_url, logo_dark_url, logo_backdrop} = logos(network)

    %__MODULE__{
      name: name,
      sender_name: name,
      reply_to: email,
      support_email: email,
      support_url: nil,
      copyright: copyright(network, name),
      logo_url: logo_url,
      logo_dark_url: logo_dark_url,
      logo_backdrop: logo_backdrop,
      dashboard_url: dashboard_url(network.domain),
      accent: nil
    }
  end

  def for_network(network_id) when is_binary(network_id) do
    case Ecto.UUID.cast(network_id) do
      {:ok, id} -> id |> Castmill.Networks.get_network() |> for_network()
      :error -> castmill()
    end
  end

  def for_network(nil), do: castmill()

  @doc "The brand of the network serving the dashboard at `origin`."
  @spec for_origin(String.t() | nil) :: t()
  def for_origin(origin) when is_binary(origin) and origin != "" do
    case Castmill.Accounts.get_network_id_by_domain(origin) do
      {:ok, network_id} -> for_network(network_id)
      _ -> castmill()
    end
  end

  def for_origin(_origin), do: castmill()

  @doc "The Castmill brand, for emails that do not belong to a network."
  @spec castmill() :: t()
  def castmill do
    %__MODULE__{
      name: "Castmill™",
      sender_name: nil,
      reply_to: nil,
      support_email: "support@castmill.com",
      support_url: "https://castmill.com/support",
      copyright: "© #{year()} Castmill AB. All rights reserved.",
      logo_url: static_url("/images/email/castmill-logo-light.png"),
      logo_dark_url: static_url("/images/email/castmill-logo-dark.png"),
      dashboard_url: nil,
      accent: @castmill_accent
    }
  end

  @doc "The dashboard URL of a network domain (`https://` unless it has a scheme)."
  @spec dashboard_url(String.t() | nil) :: String.t() | nil
  def dashboard_url(domain) do
    case present(domain) do
      nil -> nil
      "http://" <> _ = url -> String.trim_trailing(url, "/")
      "https://" <> _ = url -> String.trim_trailing(url, "/")
      host -> "https://" <> String.trim_trailing(host, "/")
    end
  end

  @doc "Sets the sender (brand name, shared address) and Reply-To of `email`."
  @spec put_sender(Swoosh.Email.t(), t()) :: Swoosh.Email.t()
  def put_sender(email, %__MODULE__{} = brand) do
    {default_name, address} = configured_sender()
    email = from(email, {brand.sender_name || default_name, address})

    if brand.reply_to, do: reply_to(email, brand.reply_to), else: email
  end

  @doc "The brand with its texts escaped, for HTML email templates."
  @spec html_escape(t()) :: t()
  def html_escape(%__MODULE__{} = brand) do
    brand
    |> Map.from_struct()
    |> Map.new(fn
      {key, value} when is_binary(value) -> {key, Plug.HTML.html_escape(value)}
      pair -> pair
    end)
    |> then(&struct(__MODULE__, &1))
  end

  defp configured_sender do
    case Application.get_env(:castmill, :mailer_from) do
      {name, address} -> {name, address}
      address when is_binary(address) -> {"Castmill", address}
    end
  end

  # The network's logos, as in the dashboard: `logo` is for dark backgrounds
  # and `logo_light` for light ones. With only one of them, it is shown on a
  # backdrop of its own background colour, so it stays legible in both light
  # and dark mode.
  defp logos(%Network{logo: logo, logo_light: logo_light}) do
    case {web_url(logo_light), web_url(logo)} do
      {nil, nil} -> {nil, nil, nil}
      {light, nil} -> {light, light, :light}
      {nil, dark} -> {dark, dark, :dark}
      {light, dark} -> {light, dark, nil}
    end
  end

  # Only absolute http(s) URLs end up in emails.
  defp web_url(value) do
    case present(value) do
      "https://" <> _ = url -> url
      "http://" <> _ = url -> url
      _ -> nil
    end
  end

  # A file served by the backend, as an absolute URL. Built from the
  # endpoint's configuration, so it also works where the endpoint isn't
  # running (background jobs, scripts).
  defp static_url(path) do
    url = Application.get_env(:castmill, CastmillWeb.Endpoint, [])[:url] || []
    scheme = url[:scheme] || "http"
    host = url[:host] || "localhost"

    port =
      case {scheme, url[:port]} do
        {_, nil} -> ""
        {"https", 443} -> ""
        {"http", 80} -> ""
        {_, port} -> ":#{port}"
      end

    "#{scheme}://#{host}#{port}#{path}"
  end

  # Networks that kept Castmill's default copyright show their own name.
  defp copyright(%Network{copyright: copyright}, name) do
    copyright = present(copyright)

    if copyright &&
         (not String.contains?(copyright, "Castmill") or
            String.contains?(name, "Castmill")) do
      copyright
    else
      "© #{year()} #{name}"
    end
  end

  defp contact_email(email) do
    email = present(email)
    if email && String.contains?(email, "@"), do: email
  end

  defp present(value) when is_binary(value) do
    case String.trim(value) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  defp present(_value), do: nil

  defp year, do: Date.utc_today().year
end
