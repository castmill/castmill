defmodule CastmillWeb.TeamController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Accounts
  alias Castmill.Teams
  alias Castmill.Plug.AuthorizeDash

  action_fallback CastmillWeb.FallbackController

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, action, %{"token" => token})
      when action in [:show_invitation, :accept_invitation] do
    validInvitation?(actor_id, token)
  end

  def check_access(actor_id, action, %{"team_id" => team_id})
      when action in [
             :invite_user,
             :update_team,
             :remove_member,
             :add_resource,
             :remove_resource,
             :remove_invitation
           ] do
    case isOrganizationAdmin?(team_id, actor_id) do
      true -> {:ok, true}
      false -> {:ok, false}
    end
  end

  def check_access(actor_id, action, %{"team_id" => team_id})
      when action in [
             :list_members,
             :list_resources,
             :list_invitations
           ] do
    case isOrganizationMember?(team_id, actor_id) do
      true -> {:ok, true}
      false -> {:ok, false}
    end
  end

  # Add default check access that refuses access to all actions
  def check_access(_actor_id, _action, _params), do: {:ok, false}

  defp validInvitation?(user_id, token) do
    user = Accounts.get_user(user_id)

    if user == nil do
      {:ok, false}
    else
      case Teams.get_invitation(token) do
        nil ->
          {:ok, false}

        invitation ->
          if invitation.email == user.email do
            {:ok, true}
          else
            {:ok, false}
          end
      end
    end
  end

  defp isOrganizationAdmin?(team_id, user_id) do
    team = Teams.get_team(team_id)

    if team == nil do
      false
    else
      role = Castmill.Organizations.get_user_role(team.organization_id, user_id)
      role == :admin
    end
  end

  defp isOrganizationMember?(team_id, user_id) do
    team = Teams.get_team(team_id)

    if team == nil do
      false
    else
      role = Castmill.Organizations.get_user_role(team.organization_id, user_id)

      if role == :admin or role == :member do
        true
      else
        false
      end
    end
  end

  plug(AuthorizeDash)

  @index_params_schema %{
    organization_id: [type: :string, required: true],
    team_id: [type: :string, required: true],
    page: [type: :integer, number: [min: 1]],
    page_size: [type: :integer, number: [min: 1, max: 100]],
    search: :string
  }

  def update_team(conn, %{"team_id" => team_id, "name" => name}) do
    team = Teams.get_team(team_id)

    case Teams.update_team(team, %{name: name}) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end

  def add_member(conn, %{"team_id" => team_id, "user_id" => user_id}) do
    case Teams.add_user_to_team(team_id, user_id, "member") do
      {:ok, _} ->
        conn
        |> put_status(:created)
        |> json(%{})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end

  def list_members(conn, params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      response = %{
        data: Teams.list_users(params),
        count: Teams.count_users(params)
      }

      conn
      |> put_status(:ok)
      |> json(response)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def invite_user(conn, %{
        "team_id" => team_id,
        "organization_id" => organization_id,
        "email" => email
      }) do
    {team_id_int, _} = Integer.parse(team_id)

    case Teams.add_invitation_to_team(organization_id, team_id_int, email) do
      {:ok, _} ->
        conn
        |> put_status(:created)
        |> json(%{})

      {:error, %Ecto.Changeset{} = changeset} ->
        # Return errors only
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} ->
            # Optionally translate or localize your error messages here
            # For now, just return the raw msg
            msg
          end)

        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: errors})

      {:error, msg} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: msg})
    end
  end

  def list_invitations(conn, params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      response = %{
        data: Teams.list_invitations(params),
        count: Teams.count_invitations(params)
      }

      conn
      |> put_status(:ok)
      |> json(response)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> json(%{errors: errors})
        |> halt()
    end
  end

  def show_invitation(conn, %{"token" => token}) do
    conn
    |> put_status(:ok)
    |> json(Teams.get_invitation(token))
  end

  def accept_invitation(conn, %{"token" => token}) do
    current_user = conn.assigns[:current_user]

    case Teams.accept_invitation(token, current_user.id) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{})

      {:error, %Ecto.Changeset{} = changeset} ->
        # Return errors only
        errors =
          Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} ->
            # Optionally translate or localize your error messages here
            # For now, just return the raw msg
            msg
          end)

        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: errors})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end

  def remove_invitation(conn, %{"team_id" => team_id, "invitation_id" => invitation_id}) do
    case Teams.remove_invitation_from_team(team_id, invitation_id) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end

  def add_resource(conn, %{
        "team_id" => team_id,
        "resource_type" => resource_type,
        "resource_id" => resource_id,
        # Array of strings
        "access" => access
      }) do
    # Check access includes the only allowed values
    case Teams.add_resource_to_team(team_id, resource_type, resource_id, access) do
      {:ok, _} ->
        conn
        |> put_status(:created)
        |> json(%{})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end

  def list_resources(conn, %{"resource_type" => resource_type} = params) do
    with {:ok, params} <- Tarams.cast(params, @index_params_schema) do
      response = %{
        data: Teams.list_resources(resource_type, params),
        count: Teams.count_resources(resource_type, params)
      }

      conn
      |> put_status(:ok)
      |> json(response)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> json(%{errors: errors})
        |> halt()
    end
  end

  def remove_resource(conn, %{
        "team_id" => team_id,
        "resource_type" => resource_type,
        "resource_id" => resource_id
      }) do
    case Teams.remove_resource_from_team(team_id, resource_type, resource_id) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end

  def remove_member(conn, %{
        "team_id" => team_id,
        "user_id" => user_id
      }) do
    case Teams.remove_user_from_team(team_id, user_id) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{})

      {:error, _} ->
        conn
        |> put_status(:bad_request)
        |> json(%{})
    end
  end
end
