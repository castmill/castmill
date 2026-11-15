defmodule Castmill.NetworkDefaultDomainTest do
  use Castmill.DataCase, async: false

  alias Castmill.Networks

  setup do
    Application.put_env(:castmill, :network_domain_provider, Castmill.FakeNetworkDomainProvider)
    Application.put_env(:castmill, :fake_domain_provider_pid, self())

    on_exit(fn ->
      Application.delete_env(:castmill, :network_domain_provider)
      Application.delete_env(:castmill, :fake_domain_provider_pid)
      Application.delete_env(:castmill, :fake_domain_provider_result)
    end)
  end

  defp attrs(extra \\ %{}) do
    Map.merge(
      %{name: "Network #{System.unique_integer([:positive])}", email: "n@example.test"},
      extra
    )
  end

  describe "with a domain provider" do
    test "a network created without a domain gets a generated, registered one" do
      assert {:ok, network} = Networks.create_network(attrs())
      assert network.domain =~ ~r/^net-\d+\.example\.test$/
      assert_received {:registered, domain}
      assert domain == network.domain
    end

    test "blank domains are generated, with string keys too" do
      assert {:ok, network} =
               Networks.create_network(%{
                 "name" => "String keys #{System.unique_integer([:positive])}",
                 "email" => "n@example.test",
                 "domain" => "  "
               })

      assert network.domain =~ ~r/^net-/
      assert_received {:registered, _domain}
    end

    test "a given domain is kept and not registered" do
      assert {:ok, network} = Networks.create_network(attrs(%{domain: "app.example.test"}))
      assert network.domain == "app.example.test"
      refute_received {:registered, _domain}
    end

    test "emptying the domain of a network generates a new one" do
      {:ok, network} = Networks.create_network(attrs(%{domain: "app.customer.test"}))

      assert {:ok, updated} = Networks.update_network(network, %{"domain" => ""})
      assert updated.domain =~ ~r/^net-/
      assert_received {:registered, domain}
      assert domain == updated.domain
    end

    test "updates without a domain keep it" do
      {:ok, network} = Networks.create_network(attrs(%{domain: "app.keep.test"}))

      assert {:ok, updated} = Networks.update_network(network, %{"copyright" => "© Acme"})
      assert updated.domain == "app.keep.test"
      refute_received {:registered, _domain}
    end

    test "a failed registration keeps the network and can be retried" do
      Application.put_env(:castmill, :fake_domain_provider_result, {:error, :cloudflare_down})

      assert {:ok, network} = Networks.create_network(attrs())
      assert_received {:registered, _domain}

      Application.put_env(:castmill, :fake_domain_provider_result, {:ok, :registered})
      assert {:ok, :registered} = Networks.register_domain(network)
    end

    test "forms do not require a domain" do
      assert Networks.default_domains?()
      assert Networks.change_network(%Networks.Network{}, attrs()).valid?
    end
  end

  describe "without a domain provider" do
    setup do
      Application.delete_env(:castmill, :network_domain_provider)
    end

    test "the domain is required" do
      refute Networks.default_domains?()
      assert {:error, changeset} = Networks.create_network(attrs())
      assert %{domain: ["can't be blank"]} = errors_on(changeset)
      refute Networks.change_network(%Networks.Network{}, attrs()).valid?
    end

    test "registering is not possible" do
      {:ok, network} = Networks.create_network(attrs(%{domain: "app.plain.test"}))
      assert {:error, :no_domain_provider} = Networks.register_domain(network)
    end
  end

  test "a domain that is already used is a changeset error" do
    {:ok, _network} = Networks.create_network(attrs(%{domain: "app.taken.test"}))

    assert {:error, changeset} = Networks.create_network(attrs(%{domain: "app.taken.test"}))
    assert %{domain: ["has already been taken"]} = errors_on(changeset)
  end
end
