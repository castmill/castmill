defmodule Castmill.EmailLayoutTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures

  alias Castmill.{EmailBrand, EmailLayout, EmailRenderer}

  defp render(brand, blocks, opts \\ []),
    do: EmailLayout.render(brand, Keyword.merge([subject: "Subject", blocks: blocks], opts))

  test "renders the same content as HTML and text, escaped" do
    {html, text} =
      render(EmailBrand.castmill(), [
        {:heading, "Hello <you>"},
        {:text,
         ["Join ", {:strong, "A&B"}, " or read ", {:link, "the docs", "https://x.test/?a=1&b=2"}]},
        {:button, "Accept", "https://x.test/accept?token=a&b"},
        {:link, "https://x.test/accept?token=a&b"},
        {:code, "TOKEN-123"},
        {:steps, [{"First", "Do this"}, {"Second", ["Then ", {:strong, "that"}]}]},
        {:note, "Ignore if unexpected."}
      ])

    assert html =~ "Hello &lt;you&gt;"
    assert html =~ "<strong"
    assert html =~ "A&amp;B"
    assert html =~ ~s(href="https://x.test/accept?token=a&amp;b")
    refute html =~ "<you>"

    assert text =~ "Hello <you>"
    assert text =~ "Join A&B or read the docs (https://x.test/?a=1&b=2)"
    assert text =~ "Accept:\nhttps://x.test/accept?token=a&b"
    assert text =~ "TOKEN-123"
    assert text =~ "1. First: Do this\n2. Second: Then that"
    refute text =~ "<strong"
    refute text =~ "<a "
  end

  test "keeps a fixed width in Outlook" do
    {html, _text} = render(EmailBrand.castmill(), [{:text, "Hi"}])

    assert html =~ ~s(<!--[if mso]><table role="presentation" width="560")
    assert html =~ "<!--[if mso]></td></tr></table><![endif]-->"
  end

  test "supports dark mode and has a preheader" do
    {html, _text} = render(EmailBrand.castmill(), [{:text, "Hi"}], preheader: "Preview text")

    assert html =~ ~s(<meta name="color-scheme" content="light dark">)
    assert html =~ "@media (prefers-color-scheme: dark)"
    assert html =~ "Preview text"
  end

  test "Castmill emails show the Castmill logo for light and dark backgrounds" do
    {html, text} = render(EmailBrand.castmill(), [{:text, "Hi"}])

    assert html =~ "/images/email/castmill-logo-light.png"
    assert html =~ "/images/email/castmill-logo-dark.png"
    assert text =~ "support@castmill.com"
  end

  test "a network without a logo shows its name, and never Castmill" do
    brand = EmailBrand.for_network(network_fixture(%{name: "Tylöprint", logo: nil}))
    {html, text} = render(brand, [{:text, "Hi"}], reason: "Because.")

    refute html =~ "<img"
    assert html =~ "Tylöprint"

    for body <- [html, text] do
      refute body =~ "Castmill"
      refute body =~ "castmill-logo"
    end
  end

  test "network logos follow the dashboard's rules" do
    both =
      EmailBrand.for_network(
        network_fixture(%{
          logo: "https://cdn.test/dark.png",
          logo_light: "https://cdn.test/light.png"
        })
      )

    assert %{logo_url: "https://cdn.test/light.png", logo_dark_url: "https://cdn.test/dark.png"} =
             both

    {html, _} = render(both, [{:text, "Hi"}])
    assert html =~ "https://cdn.test/light.png"
    assert html =~ "https://cdn.test/dark.png"

    # A logo made for dark backgrounds only is shown on a dark backdrop.
    dark_only = EmailBrand.for_network(network_fixture(%{logo: "https://cdn.test/dark.png"}))
    assert %{logo_backdrop: :dark} = dark_only
    {html, _} = render(dark_only, [{:text, "Hi"}])
    assert html =~ ~s(bgcolor="#151925")

    # A logo made for light backgrounds only keeps a light backdrop in dark mode.
    light_only =
      EmailBrand.for_network(network_fixture(%{logo_light: "https://cdn.test/light.png"}))

    assert %{logo_backdrop: :light, logo_url: "https://cdn.test/light.png"} = light_only
    {html, _} = render(light_only, [{:text, "Hi"}])
    assert html =~ ~s(bgcolor="#ffffff")
    refute html =~ "cm-dark-only\" style"

    # Only web addresses end up in emails.
    unsafe = EmailBrand.for_network(network_fixture(%{logo: "javascript:alert(1)"}))
    assert %{logo_url: nil} = unsafe
  end

  test "invitation links get https:// when the network domain has no scheme" do
    brand = EmailBrand.for_network(network_fixture(%{name: "Tylöprint"}))

    {html, text} =
      EmailRenderer.render_organization_invite(
        "Acme",
        "Tylöprint",
        "a@b.test",
        "tok",
        "net-abc.castmill.test",
        brand
      )

    assert html =~ "https://net-abc.castmill.test/invite-organization/?token=tok"
    assert text =~ "https://net-abc.castmill.test/invite-organization/?token=tok"

    {html, _text} =
      EmailRenderer.render_team_invite("Team", "a@b.test", "tok", "https://x.test/", brand)

    assert html =~ "https://x.test/invite/?token=tok"
  end
end
