defmodule Castmill.NetworksTest do
  use Castmill.DataCase

  alias Castmill.Networks

  describe "networks" do
    alias Castmill.Networks.Network

    import Castmill.NetworksFixtures

    @invalid_attrs %{copyright: nil, default_language: nil, domain: nil, email: nil, logo: nil, name: nil}

    test "list_networks/0 returns all networks" do
      network = network_fixture()
      assert Networks.list_networks() == [network]
    end

    test "get_network!/1 returns the network with given id" do
      network = network_fixture()
      assert Networks.get_network!(network.id) == network
    end

    test "create_network/1 with valid data creates a network" do
      valid_attrs = %{copyright: "some copyright", default_language: "some default_language", domain: "some domain", email: "some email", logo: "some logo", name: "some name"}

      assert {:ok, %Network{} = network} = Networks.create_network(valid_attrs)
      assert network.copyright == "some copyright"
      assert network.default_language == "some default_language"
      assert network.domain == "some domain"
      assert network.email == "some email"
      assert network.logo == "some logo"
      assert network.name == "some name"
    end

    test "create_network/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Networks.create_network(@invalid_attrs)
    end

    test "update_network/2 with valid data updates the network" do
      network = network_fixture()
      update_attrs = %{copyright: "some updated copyright", default_language: "some updated default_language", domain: "some updated domain", email: "some updated email", logo: "some updated logo", name: "some updated name"}

      assert {:ok, %Network{} = network} = Networks.update_network(network, update_attrs)
      assert network.copyright == "some updated copyright"
      assert network.default_language == "some updated default_language"
      assert network.domain == "some updated domain"
      assert network.email == "some updated email"
      assert network.logo == "some updated logo"
      assert network.name == "some updated name"
    end

    test "update_network/2 with invalid data returns error changeset" do
      network = network_fixture()
      assert {:error, %Ecto.Changeset{}} = Networks.update_network(network, @invalid_attrs)
      assert network == Networks.get_network!(network.id)
    end

    test "delete_network/1 deletes the network" do
      network = network_fixture()
      assert {:ok, %Network{}} = Networks.delete_network(network)
      assert_raise Ecto.NoResultsError, fn -> Networks.get_network!(network.id) end
    end

    test "change_network/1 returns a network changeset" do
      network = network_fixture()
      assert %Ecto.Changeset{} = Networks.change_network(network)
    end
  end
end
