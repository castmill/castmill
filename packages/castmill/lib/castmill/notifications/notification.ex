defmodule Castmill.Notifications.Notification do
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "notifications" do
    field :title, :string
    field :description, :string
    field :link, :string
    field :type, :string
    field :read, :boolean, default: false
    field :metadata, :map, default: %{}
    # Optional: restrict notification to specific roles within an organization/team
    field :roles, {:array, :string}, default: []

    belongs_to :user, Castmill.Accounts.User
    belongs_to :organization, Castmill.Organizations.Organization
    belongs_to :team, Castmill.Teams.Team

    timestamps()
  end

  @doc false
  def changeset(notification, attrs) do
    notification
    |> cast(attrs, [:title, :description, :link, :type, :read, :user_id, :organization_id, :team_id, :metadata, :roles])
    |> validate_required([:title, :type])
    |> validate_recipient()
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:team_id)
  end

  # Validate that at least one recipient is specified
  defp validate_recipient(changeset) do
    user_id = get_field(changeset, :user_id)
    org_id = get_field(changeset, :organization_id)
    team_id = get_field(changeset, :team_id)

    if is_nil(user_id) && is_nil(org_id) && is_nil(team_id) do
      add_error(changeset, :base, "must have at least one recipient (user, organization, or team)")
    else
      changeset
    end
  end
end
