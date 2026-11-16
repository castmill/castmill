defmodule Castmill.Networks.PasskeyDomains do
  @moduledoc """
  Passkey (WebAuthn) domains of networks.

  A passkey only works on the domain it was created for (its relying party
  ID). Networks are reachable on their primary domain (`network.domain`) and
  on additional domains such as customer custom domains, so all of a
  network's passkeys use the primary domain as relying party ID, also when the
  dashboard is opened on another of its domains. Browsers allow that through
  WebAuthn Related Origin Requests: `https://<primary domain>/.well-known/webauthn`
  lists the network's other origins (`related_origins/1`). Adding a custom
  domain later therefore keeps existing passkeys working.

  Additional domains come from the `:additional_domains_for_network` hook, a
  `{module, function}` called with the network id that returns hostnames:

      config :castmill, :additional_domains_for_network, {MyApp.Domains, :for_network}
  """

  import Ecto.Query, only: [from: 2]

  alias Castmill.Accounts
  alias Castmill.Networks
  alias Castmill.Networks.Network
  alias Castmill.Repo

  @doc """
  The relying party ID for passkeys created or used on `origin` (e.g.
  `"https://app.example.com"`): the host of the primary domain of the network
  the origin belongs to.
  """
  @spec rp_id_for_origin(String.t() | nil) :: {:ok, String.t()} | {:error, :network_not_found}
  def rp_id_for_origin(origin) when is_binary(origin) do
    with {:ok, network_id} <- Accounts.get_network_id_by_domain(origin),
         %Network{} = network <- Networks.get_network(network_id) do
      {:ok, rp_id(network)}
    else
      _ -> {:error, :network_not_found}
    end
  end

  def rp_id_for_origin(_origin), do: {:error, :network_not_found}

  @doc "The relying party ID of a network: the host of its primary domain."
  @spec rp_id(Network.t()) :: String.t()
  def rp_id(%Network{domain: domain}), do: host(domain)

  @doc """
  Whether `rp_id_hash` (the first 32 bytes of the authenticator data) is valid
  for an assertion made on `origin`: the hash of the network's relying party
  ID, or of the origin's own host for passkeys created on it before networks
  had a single relying party ID.
  """
  @spec valid_rp_id_hash?(String.t() | nil, binary()) :: boolean()
  def valid_rp_id_hash?(origin, rp_id_hash) when is_binary(origin) and is_binary(rp_id_hash) do
    origin_host = URI.parse(origin).host

    candidates =
      case rp_id_for_origin(origin) do
        {:ok, rp_id} -> [rp_id, origin_host]
        _ -> [origin_host]
      end

    candidates
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.any?(&Plug.Crypto.secure_compare(:crypto.hash(:sha256, &1), rp_id_hash))
  end

  def valid_rp_id_hash?(_origin, _rp_id_hash), do: false

  @doc """
  The origins allowed to use passkeys of the network whose primary domain host
  is `host`, for `/.well-known/webauthn`.
  """
  @spec related_origins(String.t()) :: {:ok, [String.t()]} | {:error, :network_not_found}
  def related_origins(host) when is_binary(host) do
    case network_by_host(host) do
      nil ->
        {:error, :network_not_found}

      network ->
        origins =
          network.id
          |> additional_domains()
          |> Enum.map(&related_origin/1)
          |> Enum.reject(&(&1 in [nil, "", related_origin(network.domain)]))
          |> Enum.uniq()

        {:ok, origins}
    end
  end

  @doc """
  The number of users of the network (members of its organizations or of the
  network itself) that have passkeys. Changing the network's primary domain
  changes its RP ID, so these passkeys stop working and their users need to
  recover their credentials.
  """
  @spec count_users_with_passkeys(Ecto.UUID.t()) :: non_neg_integer()
  def count_users_with_passkeys(network_id) do
    organization_members =
      from(ou in Castmill.Organizations.OrganizationsUsers,
        join: o in Castmill.Organizations.Organization,
        on: o.id == ou.organization_id,
        where: o.network_id == ^network_id,
        select: ou.user_id
      )

    network_members =
      from(nu in Castmill.Networks.NetworksUsers,
        where: nu.network_id == ^network_id,
        select: nu.user_id
      )

    from(c in Castmill.Accounts.UserCredential,
      where:
        c.user_id in subquery(organization_members) or c.user_id in subquery(network_members),
      select: count(c.user_id, :distinct)
    )
    |> Repo.one()
  end

  defp network_by_host(host) do
    host = String.downcase(host)

    if Regex.match?(~r/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/, host) do
      from(n in Network,
        where: fragment("lower(?)", n.domain) == ^host or ilike(n.domain, ^"#{host}:%"),
        order_by: [asc: n.inserted_at],
        limit: 1
      )
      |> Repo.one()
    end
  end

  defp additional_domains(network_id) do
    case Application.get_env(:castmill, :additional_domains_for_network) do
      {mod, fun} -> safe_domains(fn -> apply(mod, fun, [network_id]) end)
      {mod, fun, args} -> safe_domains(fn -> apply(mod, fun, [network_id | args]) end)
      _ -> []
    end
  end

  defp safe_domains(fun) do
    case fun.() do
      domains when is_list(domains) -> Enum.filter(domains, &is_binary/1)
      _ -> []
    end
  rescue
    e ->
      require Logger
      Logger.warning("[PasskeyDomains] additional_domains_for_network failed: #{inspect(e)}")
      []
  end

  # "https://app.example.com:4000/" -> "app.example.com"
  defp host(nil), do: nil

  defp host(domain) do
    domain
    |> String.replace(~r{^https?://}, "")
    |> String.split(["/", ":"], parts: 2)
    |> hd()
    |> String.downcase()
  end

  defp related_origin(nil), do: nil

  defp related_origin(domain) do
    domain = String.replace(domain, ~r{^https?://}, "")
    uri = URI.parse("https://" <> domain)
    host = uri.host && String.downcase(uri.host)

    if host && Regex.match?(~r/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/, host) &&
         is_nil(uri.userinfo) && is_nil(uri.query) && is_nil(uri.fragment) do
      port = if uri.port in [nil, 443], do: "", else: ":#{uri.port}"
      "https://" <> host <> port
    end
  rescue
    URI.Error -> nil
  end
end
