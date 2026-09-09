defmodule CastmillWeb.OnboardingProgressJSON do
  @doc """
  Renders onboarding progress.
  """
  def show(%{progress: progress}) do
    %{data: data(progress)}
  end

  defp data(progress) do
    %{
      id: progress.id,
      user_id: progress.user_id,
      completed_steps: progress.completed_steps,
      current_step: progress.current_step,
      is_completed: progress.is_completed,
      dismissed: progress.dismissed
    }
  end
end
