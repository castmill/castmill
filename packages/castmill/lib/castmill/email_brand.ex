defmodule Castmill.EmailBrand do
  @moduledoc """
  How an email presents itself.

  Emails sent for a network are branded as that network: its name as the
  sender name and in the text, its contact email as Reply-To and support
  address, and its copyright. White-label networks therefore never show
  Castmill. Emails without a network are branded as Castmill.

  All emails share the configured sender address (`:mailer_from`); only the
  sender name changes, so no extra DNS setup is needed.
  """
  import Swoosh.Email, only: [from: 2, reply_to: 2]

  alias Castmill.Networks.Network

  defstruct [:name, :sender_name, :reply_to, :support_email, :support_url, :copyright]

  @type t :: %__MODULE__{
          name: String.t(),
          sender_name: String.t() | nil,
          reply_to: String.t() | nil,
          support_email: String.t() | nil,
          support_url: String.t() | nil,
          copyright: String.t()
        }

  @doc "The brand of `network` (a network, its id, or nil for Castmill)."
  @spec for_network(Network.t() | String.t() | nil) :: t()
  def for_network(%Network{} = network) do
    name = present(network.name) || "Castmill"
    email = contact_email(network.email)

    %__MODULE__{
      name: name,
      sender_name: name,
      reply_to: email,
      support_email: email,
      support_url: nil,
      copyright: copyright(network, name)
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
      copyright: "© #{year()} Castmill AB. All rights reserved."
    }
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
    |> Map.new(fn {key, value} -> {key, value && Plug.HTML.html_escape(value)} end)
    |> then(&struct(__MODULE__, &1))
  end

  defp configured_sender do
    case Application.get_env(:castmill, :mailer_from) do
      {name, address} -> {name, address}
      address when is_binary(address) -> {"Castmill", address}
    end
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
