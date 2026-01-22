defmodule CastmillWeb.OnboardingProgressController do
  use CastmillWeb, :controller

  alias Castmill.Onboarding
  alias Castmill.Accounts.OnboardingProgress

  action_fallback(CastmillWeb.FallbackController)

  @doc """
  Gets the onboarding progress for a user.
  Returns a default progress object if none exists.
  """
  def show(conn, %{"user_id" => user_id}) do
    # Verify the user is requesting their own progress
    session_user = get_session(conn, :user)

    if session_user && session_user.id == user_id do
      case Onboarding.get_or_create_progress(user_id) do
        {:ok, progress} ->
          render(conn, :show, progress: progress)

        {:error, _changeset} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{error: "Failed to get onboarding progress"})
      end
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "Not authorized to access this resource"})
    end
  end

  @doc """
  Updates the onboarding progress for a user.
  """
  def update(conn, %{"user_id" => user_id} = params) do
    session_user = get_session(conn, :user)

    if session_user && session_user.id == user_id do
      with {:ok, progress} <- Onboarding.get_or_create_progress(user_id),
           {:ok, updated_progress} <- Onboarding.update_progress(progress, params) do
        render(conn, :show, progress: updated_progress)
      else
        {:error, changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{
            error: "Failed to update onboarding progress",
            details: format_errors(changeset)
          })
      end
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "Not authorized to access this resource"})
    end
  end

  @doc """
  Marks a step as completed.
  """
  def complete_step(conn, %{"user_id" => user_id, "step" => step}) do
    session_user = get_session(conn, :user)

    if session_user && session_user.id == user_id do
      if step in OnboardingProgress.valid_steps() do
        case Onboarding.complete_step(user_id, step) do
          {:ok, progress} ->
            render(conn, :show, progress: progress)

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: "Failed to complete step", details: format_errors(changeset)})
        end
      else
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid step: #{step}"})
      end
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "Not authorized to access this resource"})
    end
  end

  @doc """
  Dismisses the onboarding tour.
  """
  def dismiss(conn, %{"user_id" => user_id}) do
    session_user = get_session(conn, :user)

    if session_user && session_user.id == user_id do
      case Onboarding.dismiss_tour(user_id) do
        {:ok, progress} ->
          render(conn, :show, progress: progress)

        {:error, changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "Failed to dismiss tour", details: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "Not authorized to access this resource"})
    end
  end

  @doc """
  Resets the onboarding progress.
  """
  def reset(conn, %{"user_id" => user_id}) do
    session_user = get_session(conn, :user)

    if session_user && session_user.id == user_id do
      case Onboarding.reset_progress(user_id) do
        {:ok, progress} ->
          render(conn, :show, progress: progress)

        {:error, changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "Failed to reset progress", details: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "Not authorized to access this resource"})
    end
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
