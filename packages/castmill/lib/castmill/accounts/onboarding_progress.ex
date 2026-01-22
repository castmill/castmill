defmodule Castmill.Accounts.OnboardingProgress do
  @moduledoc """
  Schema for tracking user onboarding progress.
  """
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key {:id, Ecto.UUID, autogenerate: true}

  @valid_steps [
    "find_guide",
    "choose_language",
    "upload_media",
    "create_playlist",
    "create_channel",
    "register_device",
    "assign_channel",
    "advanced_playlist"
  ]

  @derive {Jason.Encoder,
           only: [
             :id,
             :user_id,
             :completed_steps,
             :current_step,
             :is_completed,
             :dismissed,
             :inserted_at,
             :updated_at
           ]}
  schema "onboarding_progress" do
    field(:completed_steps, {:array, :string}, default: [])
    field(:current_step, :string)
    field(:is_completed, :boolean, default: false)
    field(:dismissed, :boolean, default: false)

    belongs_to(:user, Castmill.Accounts.User, foreign_key: :user_id, type: Ecto.UUID)

    timestamps()
  end

  @doc false
  def changeset(onboarding_progress, attrs) do
    onboarding_progress
    |> cast(attrs, [:user_id, :completed_steps, :current_step, :is_completed, :dismissed])
    |> validate_required([:user_id])
    |> validate_steps(:completed_steps)
    |> validate_step(:current_step)
    |> unique_constraint(:user_id)
  end

  @doc """
  Returns the list of valid onboarding steps.
  """
  def valid_steps, do: @valid_steps

  @doc """
  Returns the required (non-optional) steps.
  The advanced_playlist step is optional.
  """
  def required_steps do
    @valid_steps -- ["advanced_playlist"]
  end

  defp validate_steps(changeset, field) do
    validate_change(changeset, field, fn _, steps ->
      invalid_steps = Enum.reject(steps, &(&1 in @valid_steps))

      if Enum.empty?(invalid_steps) do
        []
      else
        [{field, "contains invalid steps: #{Enum.join(invalid_steps, ", ")}"}]
      end
    end)
  end

  defp validate_step(changeset, field) do
    validate_change(changeset, field, fn _, step ->
      if is_nil(step) or step in @valid_steps do
        []
      else
        [{field, "is not a valid step"}]
      end
    end)
  end
end
