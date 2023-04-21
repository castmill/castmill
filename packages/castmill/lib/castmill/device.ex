defmodule Castmill.Device do
  use Ecto.Schema
  import Ecto.Changeset

  schema "devices" do
    field :info, :map
    field :last_ip, :string
    field :last_online, :date
    field :loc_lat, :float
    field :loc_long, :float
    field :meta, :map
    field :name, :string
    field :settings, :map
    field :timezone, :string
    field :token, :string
    field :user_agent, :string
    field :version, :string
    field :volume, :integer

    belongs_to :organization, Castmill.Organizations.Organization
    belongs_to :resource, Castmill.Resources.Resource, foreign_key: :resource_id

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [:name, :last_ip, :token, :meta, :last_online, :user_agent, :timezone, :loc_lat, :loc_long, :version, :settings, :volume, :info, :resource_id])
    |> validate_required([:name, :last_ip, :token, :last_online, :user_agent, :timezone, :version, :settings, :volume, :info])
  end
end
