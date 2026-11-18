defmodule Castmill.EmailBrandTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Swoosh.Email

  alias Castmill.EmailBrand

  describe "for_network/1" do
    test "brands emails as the network" do
      network =
        network_fixture(%{
          name: "Tylöprint",
          email: " info@tyloprint.test ",
          copyright: "© 2026 Tylöprint AB"
        })

      assert %EmailBrand{
               name: "Tylöprint",
               sender_name: "Tylöprint",
               reply_to: "info@tyloprint.test",
               support_email: "info@tyloprint.test",
               support_url: nil,
               copyright: "© 2026 Tylöprint AB"
             } = EmailBrand.for_network(network)

      assert EmailBrand.for_network(network.id).name == "Tylöprint"
    end

    test "replaces Castmill's default copyright" do
      network = network_fixture(%{name: "Tylöprint", copyright: "© 2024 Castmill AB"})

      assert EmailBrand.for_network(network).copyright == "© #{Date.utc_today().year} Tylöprint"
    end

    test "has no Reply-To or support address without a network email" do
      brand = EmailBrand.for_network(%Castmill.Networks.Network{name: "Tylöprint", email: nil})

      assert brand.reply_to == nil
      assert brand.support_email == nil
    end

    test "keeps the copyright of a network named Castmill" do
      network = network_fixture(%{name: "Castmill", copyright: "© 2024 Castmill AB"})

      assert EmailBrand.for_network(network).copyright == "© 2024 Castmill AB"
    end

    test "uses Castmill without a network" do
      for network <- [nil, Ecto.UUID.generate(), "not-a-uuid"] do
        assert EmailBrand.for_network(network) == EmailBrand.castmill()
      end
    end
  end

  describe "for_origin/1" do
    test "finds the network serving the dashboard" do
      network = network_fixture(%{name: "Tylöprint", domain: "signage.tyloprint.test"})

      assert EmailBrand.for_origin("https://signage.tyloprint.test").name == network.name
      assert EmailBrand.for_origin("https://unknown.test") == EmailBrand.castmill()
      assert EmailBrand.for_origin(nil) == EmailBrand.castmill()
    end
  end

  describe "put_sender/2" do
    test "sends as the brand from the shared address with a Reply-To" do
      network = network_fixture(%{name: "Tylöprint", email: "info@tyloprint.test"})
      email = new() |> EmailBrand.put_sender(EmailBrand.for_network(network))

      assert email.from == {"Tylöprint", "no-reply@castmill.com"}
      assert email.reply_to == {"", "info@tyloprint.test"}
    end

    test "sends Castmill emails as configured, without a Reply-To" do
      email = new() |> EmailBrand.put_sender(EmailBrand.castmill())

      assert email.from == {"Castmill", "no-reply@castmill.com"}
      assert email.reply_to == nil
    end
  end

  test "html_escape/1 escapes the brand's texts" do
    brand = %EmailBrand{EmailBrand.castmill() | name: "A & <B>", reply_to: nil}

    assert %EmailBrand{name: "A &amp; &lt;B&gt;", reply_to: nil} = EmailBrand.html_escape(brand)
  end

  test "escapes the network name in a team invitation HTML title" do
    name = "Danger</title><script>alert(1)</script>"
    brand = %EmailBrand{EmailBrand.castmill() | name: name}

    {html_body, text_body} =
      Castmill.EmailRenderer.render_team_invite(
        "Team",
        "user@example.com",
        "token",
        "https://example.com",
        brand
      )

    assert html_body =~
             "<title>You have been invited to a Team on Danger&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>"

    refute html_body =~ "<title>You have been invited to a Team on Danger</title><script>"
    assert text_body =~ "on #{name}."
  end
end
