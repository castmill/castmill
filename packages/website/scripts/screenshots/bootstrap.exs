# Creates the fictional demo network used for the documentation screenshots:
# the network on localhost:3000, its organizations and users, and dashboard
# tokens for them. Run it against an empty development database:
#
#     cd packages/castmill
#     mix run ../website/scripts/screenshots/bootstrap.exs
#
# It is idempotent and writes ../website/scripts/screenshots/.demo.json (git-ignored),
# which seed.mjs and capture.mjs read. Never run it against a real database.
import Ecto.Query, only: [from: 2]

alias Castmill.{Networks, Organizations, Repo}
alias Castmill.Accounts.User
alias Castmill.Networks.{Network, NetworksUsers}
alias Castmill.Organizations.{Organization, OrganizationsUsers}

domain = System.get_env("DEMO_DOMAIN", "localhost:3000")

out =
  System.get_env("DEMO_OUT") ||
    Path.expand("../website/scripts/screenshots/.demo.json", File.cwd!())

if Repo.aggregate(from(n in Network, where: n.domain != ^domain), :count) > 0 do
  Mix.raise("The database has other networks. Run the bootstrap on an empty demo database.")
end

network =
  Repo.get_by(Network, domain: domain) ||
    (fn ->
       {:ok, network} =
         Networks.create_network(%{
           name: "Castmill",
           email: "admin@example.com",
           domain: domain,
           default_locale: "en"
         })

       network
     end).()

# Open sign-up, so the login page shows the sign-up form as on a default install.
network = Repo.update!(Ecto.Changeset.change(network, invitation_only: false))

users = [
  %{key: "alex", name: "Alex Morgan", email: "alex.morgan@example.com", network_admin: true},
  %{key: "sam", name: "Sam Rivera", email: "sam.rivera@example.com"},
  %{key: "priya", name: "Priya Shah", email: "priya.shah@example.com"},
  %{key: "jordan", name: "Jordan Lee", email: "jordan.lee@example.com"},
  %{key: "chris", name: "Chris Novak", email: "chris.novak@example.com"},
  %{key: "maria", name: "Maria Lindqvist", email: "maria.lindqvist@example.com"},
  %{key: "omar", name: "Omar Haddad", email: "omar.haddad@example.com"},
  %{key: "emma", name: "Emma Clarke", email: "emma.clarke@example.com"}
]

user_ids =
  Map.new(users, fn attrs ->
    user =
      Repo.get_by(User, email: attrs.email) ||
        Repo.insert!(User.changeset(%User{}, Map.take(attrs, [:name, :email])))

    unless Repo.get_by(NetworksUsers, user_id: user.id, network_id: network.id) do
      Repo.insert!(
        NetworksUsers.changeset(%NetworksUsers{}, %{
          role: if(attrs[:network_admin], do: :admin, else: :member),
          network_id: network.id,
          user_id: user.id
        })
      )
    end

    {attrs.key, user.id}
  end)

# Organization name => {city, members as [{user key, role}]}
organizations = [
  {"Harbor Kitchen", "Gothenburg",
   [
     {"alex", :admin},
     {"sam", :manager},
     {"priya", :member},
     {"jordan", :member},
     {"chris", :guest}
   ]},
  {"Northwind Retail", "Oslo", [{"maria", :admin}, {"alex", :member}]},
  {"Riverside Library", "Copenhagen", [{"omar", :admin}]},
  {"Summit Fitness", "Helsinki", [{"emma", :admin}]},
  {"Bluebird Clinic", "Stockholm", [{"omar", :manager}, {"emma", :member}]}
]

organization_ids =
  Map.new(organizations, fn {name, city, members} ->
    organization =
      Repo.get_by(Organization, network_id: network.id, name: name) ||
        (fn ->
           {:ok, organization} =
             Organizations.create_organization(%{
               name: name,
               city: city,
               network_id: network.id,
               onboarding_completed: true
             })

           organization
         end).()

    for {key, role} <- members do
      user_id = Map.fetch!(user_ids, key)

      unless Repo.get_by(OrganizationsUsers, organization_id: organization.id, user_id: user_id) do
        Repo.insert!(
          OrganizationsUsers.changeset(%OrganizationsUsers{}, %{
            role: role,
            organization_id: organization.id,
            user_id: user_id
          })
        )
      end
    end

    {name, organization.id}
  end)

# Two passkeys for the main user, so Settings shows a realistic list. The keys are
# placeholders: they cannot be used to sign in.
for {id, device, browser, os} <- [
      {"demo-passkey-macbook", "MacBook Pro", "Safari", "macOS"},
      {"demo-passkey-iphone", "iPhone", "Safari", "iOS"}
    ] do
  Repo.query!(
    """
    INSERT INTO users_credentials
      (id, user_id, public_key_spki, device_name, browser, os, inserted_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, now(), now())
    ON CONFLICT (id) DO NOTHING
    """,
    [id, Ecto.UUID.dump!(user_ids["alex"]), "demo", device, browser, os]
  )
end

tokens =
  Map.new(user_ids, fn {key, id} ->
    {key,
     Phoenix.Token.sign(
       CastmillWeb.Endpoint,
       CastmillWeb.Secrets.get_dashboard_user_token_salt(),
       id
     )}
  end)

File.write!(
  out,
  Jason.encode!(
    # Keep what seed.mjs added (the `seed` ids), so renewing the tokens needs no new seed.
    Map.merge(
      if(File.exists?(out), do: Jason.decode!(File.read!(out)), else: %{}),
      %{
        "network_id" => network.id,
        "domain" => domain,
        "organizations" => organization_ids,
        "users" => user_ids,
        "tokens" => tokens
      }
    ),
    pretty: true
  )
)

File.chmod!(out, 0o600)
IO.puts("Demo network #{network.id} ready; wrote #{out}")
