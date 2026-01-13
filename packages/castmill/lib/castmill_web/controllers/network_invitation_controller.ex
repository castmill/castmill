defmodule CastmillWeb.NetworkInvitationController do
  use CastmillWeb, :controller

  alias Castmill.Networks
  alias Castmill.Accounts

  action_fallback(CastmillWeb.FallbackController)

  @doc """
  Preview a network invitation without accepting it.
  This is a public endpoint (no authentication required).
  """
  def preview_invitation(conn, %{"token" => token}) do
    case Networks.get_network_invitation_by_token(token) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Invalid or expired invitation"})

      invitation ->
        # Check if user with this email exists
        user_exists = Accounts.get_user_by_email(invitation.email) != nil

        conn
        |> put_status(:ok)
        |> json(%{
          email: invitation.email,
          organization_name: invitation.organization_name,
          network_id: invitation.network_id,
          status: invitation.status,
          expires_at: invitation.expires_at,
          user_exists: user_exists,
          expired: Castmill.Networks.NetworkInvitation.expired?(invitation)
        })
    end
  end

  @doc """
  Show a network invitation (authenticated endpoint).
  Returns the full invitation details if the user has access.
  """
  def show_invitation(conn, %{"token" => token}) do
    current_user = conn.assigns[:current_user]

    case Networks.get_network_invitation_by_token(token) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Invalid or expired invitation"})

      invitation ->
        # Verify the invitation is for the current user
        if current_user && current_user.email == invitation.email do
          conn
          |> put_status(:ok)
          |> json(%{
            invitation: invitation,
            expired: Castmill.Networks.NetworkInvitation.expired?(invitation)
          })
        else
          conn
          |> put_status(:forbidden)
          |> json(%{error: "This invitation is not for your account"})
        end
    end
  end

  @doc """
  Accept a network invitation (authenticated endpoint).
  Creates a new organization and adds the user as admin.
  """
  def accept_invitation(conn, %{"token" => token}) do
    current_user = conn.assigns[:current_user]

    if is_nil(current_user) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Authentication required"})
    else
      case Networks.accept_network_invitation(token, current_user.id) do
        {:ok, organization} ->
          conn
          |> put_status(:ok)
          |> json(%{
            message: "Invitation accepted successfully",
            organization: organization
          })

        {:error, :invitation_not_found} ->
          conn
          |> put_status(:not_found)
          |> json(%{error: "Invalid or expired invitation"})

        {:error, :invitation_expired} ->
          conn
          |> put_status(:gone)
          |> json(%{error: "This invitation has expired"})

        {:error, :email_mismatch} ->
          conn
          |> put_status(:forbidden)
          |> json(%{error: "This invitation is not for your account"})

        {:error, reason} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "Failed to accept invitation: #{inspect(reason)}"})
      end
    end
  end

  @doc """
  Reject a network invitation (authenticated endpoint).
  """
  def reject_invitation(conn, %{"token" => token}) do
    current_user = conn.assigns[:current_user]

    case Networks.get_network_invitation_by_token(token) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Invalid or expired invitation"})

      invitation ->
        # Verify the invitation is for the current user
        if current_user && current_user.email == invitation.email do
          case Networks.delete_network_invitation(invitation.id) do
            {:ok, _} ->
              conn
              |> put_status(:ok)
              |> json(%{message: "Invitation rejected successfully"})

            {:error, _} ->
              conn
              |> put_status(:unprocessable_entity)
              |> json(%{error: "Failed to reject invitation"})
          end
        else
          conn
          |> put_status(:forbidden)
          |> json(%{error: "This invitation is not for your account"})
        end
    end
  end
end
