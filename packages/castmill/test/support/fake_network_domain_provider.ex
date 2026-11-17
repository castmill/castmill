defmodule Castmill.FakeNetworkDomainProvider do
  @moduledoc """
  `Castmill.Networks.DomainProvider` for tests. Generates
  `net-<n>.example.test` and reports registrations to the pid in
  `:fake_domain_provider_pid`, returning `:fake_domain_provider_result`.
  """
  @behaviour Castmill.Networks.DomainProvider

  @impl true
  def generate_domain, do: "net-#{System.unique_integer([:positive])}.example.test"

  @impl true
  def register_domain(domain) do
    send(Application.fetch_env!(:castmill, :fake_domain_provider_pid), {:registered, domain})
    Application.get_env(:castmill, :fake_domain_provider_result, {:ok, :registered})
  end
end
