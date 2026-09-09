defmodule Castmill.Onboarding do
  @moduledoc """
  Context module for managing user onboarding progress.
  """

  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Accounts.OnboardingProgress

  @doc """
  Gets the onboarding progress for a user.
  Returns nil if no progress exists.
  """
  def get_progress(user_id) do
    Repo.get_by(OnboardingProgress, user_id: user_id)
  end

  @doc """
  Gets the onboarding progress for a user, creating a default one if it doesn't exist.
  """
  def get_or_create_progress(user_id) do
    case get_progress(user_id) do
      nil -> create_progress(user_id)
      progress -> {:ok, progress}
    end
  end

  @doc """
  Creates a new onboarding progress record for a user.
  """
  def create_progress(user_id) do
    %OnboardingProgress{}
    |> OnboardingProgress.changeset(%{user_id: user_id})
    |> Repo.insert()
  end

  @doc """
  Updates the onboarding progress for a user.
  """
  def update_progress(%OnboardingProgress{} = progress, attrs) do
    progress
    |> OnboardingProgress.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Marks a step as completed for a user.
  Creates the progress record if it doesn't exist.
  Automatically sets is_completed to true if all required steps are done.
  """
  def complete_step(user_id, step) do
    with {:ok, progress} <- get_or_create_progress(user_id) do
      # Add step to completed_steps if not already present
      completed_steps =
        if step in progress.completed_steps do
          progress.completed_steps
        else
          progress.completed_steps ++ [step]
        end

      # Check if all required steps are completed
      required_steps = OnboardingProgress.required_steps()
      is_completed = Enum.all?(required_steps, &(&1 in completed_steps))

      update_progress(progress, %{
        completed_steps: completed_steps,
        current_step: step,
        is_completed: is_completed
      })
    end
  end

  @doc """
  Dismisses the onboarding tour for a user.
  """
  def dismiss_tour(user_id) do
    with {:ok, progress} <- get_or_create_progress(user_id) do
      update_progress(progress, %{dismissed: true})
    end
  end

  @doc """
  Resets the onboarding progress for a user.
  """
  def reset_progress(user_id) do
    with {:ok, progress} <- get_or_create_progress(user_id) do
      update_progress(progress, %{
        completed_steps: [],
        current_step: nil,
        is_completed: false,
        dismissed: false
      })
    end
  end
end
