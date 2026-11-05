defmodule Castmill.Agents do
  @moduledoc """
  The Agents context.

  AI agents are organization members that operate Castmill through the MCP
  server (`POST /mcp`). Every agent is backed by a regular user record flagged
  with `is_agent`, which is added to the organization with a role. Because of
  that, all the authorization rules that apply to users (roles, teams,
  permission matrix, blocked users/organizations, ...) apply to agents as well.

  Agents authenticate with an agent-only credential (a random bearer secret).
  Only the SHA-256 hash of the credential is stored. Credentials can be rotated
  (a new secret is issued and the previous one stops working immediately) or
  revoked (the agent cannot authenticate until new credentials are issued).

  Agent credentials are only accepted by the MCP endpoint; they are not access
  tokens and cannot be used to log in to the dashboard or the REST APIs.
  """

  import Ecto.Query, warn: false

  alias Castmill.Repo
  alias Castmill.Accounts.User
  alias Castmill.Agents.Agent
  alias Castmill.Agents.AgentAction
  alias Castmill.Organizations.OrganizationsUsers

  @secret_prefix "cmagt_"
  @display_prefix_length 12
  @roles [:admin, :manager, :member, :editor, :publisher, :device_manager, :guest]
  @default_role :member
  @max_page_size 100

  @doc "The prefix every agent credential starts with."
  def secret_prefix, do: @secret_prefix

  @doc "Roles that can be assigned to an agent."
  def roles, do: @roles

  @doc """
  Lists the agents of an organization, including their organization role.
  """
  def list_agents(organization_id) do
    organization_id
    |> agents_query()
    |> order_by([a], asc: a.name)
    |> Repo.all()
  end

  @doc """
  Gets an agent that belongs to the given organization, or nil.
  """
  def get_agent(organization_id, agent_id) do
    with {:ok, agent_id} <- Ecto.UUID.cast(agent_id),
         {:ok, organization_id} <- Ecto.UUID.cast(organization_id) do
      organization_id
      |> agents_query()
      |> where([a], a.id == ^agent_id)
      |> Repo.one()
    else
      _ -> nil
    end
  end

  defp agents_query(organization_id) do
    from(a in Agent,
      left_join: ou in OrganizationsUsers,
      on: ou.user_id == a.user_id and ou.organization_id == a.organization_id,
      where: a.organization_id == ^organization_id,
      select_merge: %{role: ou.role, has_credentials: not is_nil(a.secret_hash)}
    )
  end

  @doc """
  Returns true if the given user id belongs to an agent.
  """
  def agent_user?(nil), do: false

  def agent_user?(user_id) do
    case Ecto.UUID.cast(user_id) do
      {:ok, user_id} ->
        Repo.exists?(from(u in User, where: u.id == ^user_id and u.is_agent == true))

      :error ->
        false
    end
  end

  @doc """
  Creates an agent in the given organization.

  Creates the backing agent user, adds it to the organization with the given
  role (defaults to `member`) and issues the first credential.

  Returns `{:ok, agent, secret}`. The secret is only available at this point;
  it cannot be retrieved later.
  """
  def create_agent(organization_id, attrs, created_by_id \\ nil) do
    attrs = stringify_keys(attrs)

    with {:ok, role} <- parse_role(Map.get(attrs, "role"), @default_role) do
      agent_id = Ecto.UUID.generate()
      {secret, hash, prefix} = generate_secret()
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      Ecto.Multi.new()
      |> Ecto.Multi.insert(
        :user,
        User.agent_changeset(%User{}, %{
          name: Map.get(attrs, "name"),
          email: "agent-#{agent_id}@agents.castmill.invalid"
        })
      )
      |> Ecto.Multi.insert(:membership, fn %{user: user} ->
        OrganizationsUsers.changeset(%OrganizationsUsers{}, %{
          organization_id: organization_id,
          user_id: user.id,
          role: role
        })
      end)
      |> Ecto.Multi.insert(:agent, fn %{user: user} ->
        %Agent{id: agent_id}
        |> Agent.create_changeset(%{
          "name" => Map.get(attrs, "name"),
          "description" => Map.get(attrs, "description"),
          "user_id" => user.id,
          "organization_id" => organization_id,
          "created_by_id" => created_by_id
        })
        |> Agent.credential_changeset(%{
          secret_hash: hash,
          secret_prefix: prefix,
          credential_rotated_at: now
        })
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{agent: agent}} ->
          {:ok, get_agent(organization_id, agent.id), secret}

        {:error, :user, changeset, _} ->
          # The agent changeset has the same name validations, report on it
          # so that errors refer to agent fields.
          {:error, agent_changeset_from(changeset, attrs)}

        {:error, _step, changeset, _} ->
          {:error, changeset}
      end
    end
  end

  defp agent_changeset_from(%Ecto.Changeset{} = user_changeset, attrs) do
    agent_changeset = Agent.changeset(%Agent{}, attrs)

    if agent_changeset.valid? do
      user_changeset
    else
      %{agent_changeset | action: :insert}
    end
  end

  @doc """
  Updates the name, description and/or role of an agent.
  """
  def update_agent(%Agent{} = agent, attrs) do
    attrs = stringify_keys(attrs)

    with {:ok, role} <- parse_role(Map.get(attrs, "role"), nil) do
      changeset = Agent.changeset(agent, attrs)

      Ecto.Multi.new()
      |> Ecto.Multi.update(:agent, changeset)
      |> Ecto.Multi.run(:user, fn repo, %{agent: updated} ->
        case repo.get(User, updated.user_id) do
          nil ->
            {:error, :not_found}

          user ->
            user
            |> Ecto.Changeset.change(name: updated.name)
            |> repo.update()
        end
      end)
      |> Ecto.Multi.run(:role, fn _repo, %{agent: updated} ->
        if role do
          Castmill.Organizations.set_user_role(updated.organization_id, updated.user_id, role)
        else
          {:ok, nil}
        end
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{agent: updated}} -> {:ok, get_agent(updated.organization_id, updated.id)}
        {:error, _step, reason, _} -> {:error, reason}
      end
    end
  end

  @doc """
  Issues new credentials for an agent. The previous credential (if any) stops
  working immediately.

  Returns `{:ok, agent, secret}`.
  """
  def rotate_credentials(%Agent{} = agent) do
    {secret, hash, prefix} = generate_secret()

    agent
    |> Agent.credential_changeset(%{
      secret_hash: hash,
      secret_prefix: prefix,
      credential_rotated_at: DateTime.utc_now() |> DateTime.truncate(:second)
    })
    |> Repo.update()
    |> case do
      {:ok, updated} -> {:ok, get_agent(updated.organization_id, updated.id), secret}
      error -> error
    end
  end

  @doc """
  Revokes the credentials of an agent. The agent cannot authenticate until new
  credentials are issued with `rotate_credentials/1`.
  """
  def revoke_credentials(%Agent{} = agent) do
    agent
    |> Ecto.Changeset.change(secret_hash: nil, secret_prefix: nil)
    |> Repo.update()
    |> case do
      {:ok, updated} -> {:ok, get_agent(updated.organization_id, updated.id)}
      error -> error
    end
  end

  @doc """
  Deletes an agent, its backing user, its organization membership and its
  action log.
  """
  def delete_agent(%Agent{} = agent) do
    Repo.transaction(fn ->
      {count, _} = Repo.delete_all(from(u in User, where: u.id == ^agent.user_id and u.is_agent))

      if count == 1 do
        agent
      else
        Repo.rollback(:not_found)
      end
    end)
  end

  @doc """
  Authenticates an agent credential.

  Returns `{:ok, agent}` with the agent user preloaded, or
  `{:error, :invalid_credentials}`.
  """
  def authenticate(secret, source_ip \\ nil)

  def authenticate(@secret_prefix <> _ = secret, source_ip) do
    hash = hash_secret(secret)

    case Repo.one(from(a in Agent, where: a.secret_hash == ^hash, preload: [:user])) do
      %Agent{user: %User{is_agent: true}} = agent ->
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        from(a in Agent, where: a.id == ^agent.id)
        |> Repo.update_all(set: [last_used_at: now, last_ip: source_ip])

        {:ok, %{agent | last_used_at: now, last_ip: source_ip}}

      _ ->
        {:error, :invalid_credentials}
    end
  end

  def authenticate(_secret, _source_ip), do: {:error, :invalid_credentials}

  @doc """
  Records an action performed by an agent.
  """
  def log_action(%Agent{} = agent, attrs) do
    %AgentAction{}
    |> AgentAction.changeset(
      Map.merge(attrs, %{agent_id: agent.id, organization_id: agent.organization_id})
    )
    |> Repo.insert()
  end

  @doc """
  Lists the actions performed by the agents of an organization, newest first.

  Supported params: `agent_id`, `status`, `tool`, `page`, `page_size`.
  Returns `%{data: [...], count: integer}`.
  """
  def list_actions(organization_id, params \\ %{}) do
    params = stringify_keys(params)
    page = to_positive_integer(Map.get(params, "page"), 1)

    page_size =
      params |> Map.get("page_size") |> to_positive_integer(25) |> min(@max_page_size)

    query =
      from(aa in AgentAction,
        join: a in Agent,
        on: a.id == aa.agent_id,
        where: aa.organization_id == ^organization_id
      )
      |> filter_actions(params)

    data =
      query
      |> order_by([aa], desc: aa.inserted_at, desc: aa.id)
      |> limit(^page_size)
      |> offset(^((page - 1) * page_size))
      |> select([aa, a], %{
        id: aa.id,
        agent_id: aa.agent_id,
        agent_name: a.name,
        tool: aa.tool,
        arguments: aa.arguments,
        method: aa.method,
        path: aa.path,
        status: aa.status,
        http_status: aa.http_status,
        error: aa.error,
        duration_ms: aa.duration_ms,
        ip: aa.ip,
        inserted_at: aa.inserted_at
      })
      |> Repo.all()

    %{data: data, count: Repo.aggregate(query, :count, :id)}
  end

  defp filter_actions(query, params) do
    Enum.reduce(params, query, fn
      {"agent_id", agent_id}, query when is_binary(agent_id) and agent_id != "" ->
        case Ecto.UUID.cast(agent_id) do
          {:ok, id} -> where(query, [aa], aa.agent_id == ^id)
          :error -> where(query, false)
        end

      {"status", status}, query when status in ["success", "error"] ->
        where(query, [aa], aa.status == ^status)

      {"tool", tool}, query when is_binary(tool) and tool != "" ->
        where(query, [aa], aa.tool == ^tool)

      _, query ->
        query
    end)
  end

  defp generate_secret do
    secret = @secret_prefix <> Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
    {secret, hash_secret(secret), String.slice(secret, 0, @display_prefix_length)}
  end

  defp hash_secret(secret) do
    :crypto.hash(:sha256, secret) |> Base.encode16(case: :lower)
  end

  defp parse_role(nil, default), do: {:ok, default}
  defp parse_role("", default), do: {:ok, default}
  defp parse_role(role, _default) when role in @roles, do: {:ok, role}

  defp parse_role(role, _default) when is_binary(role) do
    case Enum.find(@roles, &(Atom.to_string(&1) == role)) do
      nil -> {:error, :invalid_role}
      role -> {:ok, role}
    end
  end

  defp parse_role(_role, _default), do: {:error, :invalid_role}

  defp to_positive_integer(value, _default) when is_integer(value) and value > 0, do: value

  defp to_positive_integer(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} when int > 0 -> int
      _ -> default
    end
  end

  defp to_positive_integer(_value, default), do: default

  defp stringify_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} -> {to_string(k), v} end)
  end

  defp stringify_keys(_), do: %{}
end
