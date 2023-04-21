defmodule Castmill.Teams.Team do
  use Ecto.Schema
  import Ecto.Changeset

  schema "teams" do
    field :name, :string

    belongs_to :organization, Castmill.Organizations.Organization, type: Ecto.UUID

    many_to_many :users, Castmill.Accounts.User, join_through: "teams_users", on_replace: :delete
    many_to_many :resources, Castmill.Accounts.User, join_through: "teams_resources", on_replace: :delete

    timestamps()
  end

  @doc false
  def changeset(team, attrs) do
    team
    |> cast(attrs, [:name, :organization_id])
    |> validate_required([:name, :organization_id])
  end
end
