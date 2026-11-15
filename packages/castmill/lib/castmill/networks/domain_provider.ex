defmodule Castmill.Networks.DomainProvider do
  @moduledoc """
  Gives networks a default dashboard domain.

  When a provider is configured, a network created or saved with an empty
  domain gets `generate_domain/0` as its domain and `register_domain/1` makes
  that domain serve the dashboard (for example DNS and hosting). Networks can
  add their own domains later (see the custom domains addon in Castmill SaaS).

      config :castmill, :network_domain_provider, MyApp.NetworkDomains

  Without a provider the domain is required, as before.
  """

  @doc "Returns a new, unused domain such as `net-a7f3b2c1.example.com`."
  @callback generate_domain() :: String.t()

  @doc "Makes `domain` serve the dashboard. Called after the network is saved."
  @callback register_domain(domain :: String.t()) :: {:ok, term()} | {:error, term()}

  @doc "The configured provider module, or nil."
  @spec configured() :: module() | nil
  def configured, do: Application.get_env(:castmill, :network_domain_provider)
end
