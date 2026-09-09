defmodule CastmillWeb.TagController do
  @moduledoc """
  Controller for managing tags and tag groups.

  Provides CRUD operations for:
  - Tags: User-defined labels for organizing resources
  - Tag Groups: Optional categories for organizing tags
  - Resource Tags: Associations between tags and resources
  """

  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Tags
  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  # ============================================================================
  # Access Control
  # ============================================================================

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, action, %{"organization_id" => organization_id})
      when action in [
             :list_tags,
             :list_tag_groups,
             :show_tag,
             :show_tag_group,
             :get_resource_tags
           ] do
    # Read access requires being a member of the organization
    {:ok,
     Organizations.has_any_role?(organization_id, actor_id, [:admin, :manager, :member, :guest])}
  end

  def check_access(actor_id, action, %{"organization_id" => organization_id})
      when action in [
             :create_tag,
             :update_tag,
             :delete_tag,
             :create_tag_group,
             :update_tag_group,
             :delete_tag_group,
             :tag_resource,
             :untag_resource,
             :set_resource_tags,
             :bulk_tag,
             :bulk_untag
           ] do
    # Write access requires admin or manager role
    {:ok, Organizations.has_any_role?(organization_id, actor_id, [:admin, :manager])}
  end

  def check_access(_actor_id, _action, _params), do: {:ok, false}

  plug(AuthorizeDash)

  # ============================================================================
  # Tag Groups
  # ============================================================================

  @doc """
  Lists all tag groups for an organization.

  GET /api/dashboard/organizations/:organization_id/tag-groups
  """
  def list_tag_groups(conn, %{"organization_id" => organization_id} = params) do
    preload_tags = Map.get(params, "preload_tags", "false") == "true"

    tag_groups = Tags.list_tag_groups(organization_id, preload_tags: preload_tags)

    conn
    |> put_status(:ok)
    |> json(%{data: tag_groups})
  end

  @doc """
  Gets a single tag group.

  GET /api/dashboard/organizations/:organization_id/tag-groups/:id
  """
  def show_tag_group(conn, %{"id" => id}) do
    case Tags.get_tag_group(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Tag group not found"})

      tag_group ->
        conn
        |> put_status(:ok)
        |> json(%{data: tag_group})
    end
  end

  @doc """
  Creates a new tag group.

  POST /api/dashboard/organizations/:organization_id/tag-groups
  """
  def create_tag_group(conn, %{"organization_id" => organization_id} = params) do
    attrs =
      params
      |> Map.take(["name", "color", "icon", "position"])
      |> Map.put("organization_id", organization_id)

    case Tags.create_tag_group(attrs) do
      {:ok, tag_group} ->
        conn
        |> put_status(:created)
        |> json(%{data: tag_group})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  @doc """
  Updates a tag group.

  PUT /api/dashboard/organizations/:organization_id/tag-groups/:id
  """
  def update_tag_group(conn, %{"id" => id} = params) do
    case Tags.get_tag_group(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Tag group not found"})

      tag_group ->
        attrs = Map.take(params, ["name", "color", "icon", "position"])

        case Tags.update_tag_group(tag_group, attrs) do
          {:ok, updated} ->
            conn
            |> put_status(:ok)
            |> json(%{data: updated})

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{errors: format_errors(changeset)})
        end
    end
  end

  @doc """
  Deletes a tag group.

  DELETE /api/dashboard/organizations/:organization_id/tag-groups/:id
  """
  def delete_tag_group(conn, %{"id" => id}) do
    case Tags.get_tag_group(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Tag group not found"})

      tag_group ->
        case Tags.delete_tag_group(tag_group) do
          {:ok, _} ->
            conn
            |> put_status(:ok)
            |> json(%{success: true})

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{errors: format_errors(changeset)})
        end
    end
  end

  # ============================================================================
  # Tags
  # ============================================================================

  @doc """
  Lists all tags for an organization.

  GET /api/dashboard/organizations/:organization_id/tags

  Query params:
    - tag_group_id: Filter by tag group
    - preload_tag_group: Include tag group data (true/false)
  """
  def list_tags(conn, %{"organization_id" => organization_id} = params) do
    opts = [
      tag_group_id: Map.get(params, "tag_group_id"),
      preload_tag_group: Map.get(params, "preload_tag_group", "false") == "true"
    ]

    tags = Tags.list_tags(organization_id, opts)

    conn
    |> put_status(:ok)
    |> json(%{data: tags})
  end

  @doc """
  Gets a single tag.

  GET /api/dashboard/organizations/:organization_id/tags/:id
  """
  def show_tag(conn, %{"id" => id}) do
    case Tags.get_tag(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Tag not found"})

      tag ->
        conn
        |> put_status(:ok)
        |> json(%{data: tag})
    end
  end

  @doc """
  Creates a new tag.

  POST /api/dashboard/organizations/:organization_id/tags
  """
  def create_tag(conn, %{"organization_id" => organization_id} = params) do
    attrs =
      params
      |> Map.take(["name", "color", "position", "tag_group_id"])
      |> Map.put("organization_id", organization_id)

    case Tags.create_tag(attrs) do
      {:ok, tag} ->
        conn
        |> put_status(:created)
        |> json(%{data: tag})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  @doc """
  Updates a tag.

  PUT /api/dashboard/organizations/:organization_id/tags/:id
  """
  def update_tag(conn, %{"id" => id} = params) do
    case Tags.get_tag(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Tag not found"})

      tag ->
        attrs = Map.take(params, ["name", "color", "position", "tag_group_id"])

        case Tags.update_tag(tag, attrs) do
          {:ok, updated} ->
            conn
            |> put_status(:ok)
            |> json(%{data: updated})

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{errors: format_errors(changeset)})
        end
    end
  end

  @doc """
  Deletes a tag.

  DELETE /api/dashboard/organizations/:organization_id/tags/:id
  """
  def delete_tag(conn, %{"id" => id}) do
    case Tags.get_tag(id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Tag not found"})

      tag ->
        case Tags.delete_tag(tag) do
          {:ok, _} ->
            conn
            |> put_status(:ok)
            |> json(%{success: true})

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{errors: format_errors(changeset)})
        end
    end
  end

  @doc """
  Returns the default color palette for tags.

  GET /api/dashboard/organizations/:organization_id/tags/colors
  """
  def color_palette(conn, _params) do
    conn
    |> put_status(:ok)
    |> json(%{data: Tags.color_palette()})
  end

  # ============================================================================
  # Resource Tags
  # ============================================================================

  @doc """
  Gets tags for a specific resource.

  GET /api/dashboard/organizations/:organization_id/:resource_type/:resource_id/tags
  """
  def get_resource_tags(conn, %{"resource_type" => resource_type, "resource_id" => resource_id}) do
    resource_type_atom = normalize_resource_type(resource_type)

    tags = Tags.get_resource_tags(resource_type_atom, to_string(resource_id))

    conn
    |> put_status(:ok)
    |> json(%{data: tags})
  end

  @doc """
  Adds a tag to a resource.

  POST /api/dashboard/organizations/:organization_id/:resource_type/:resource_id/tags
  """
  def tag_resource(conn, %{
        "resource_type" => resource_type,
        "resource_id" => resource_id,
        "tag_id" => tag_id
      }) do
    resource_type_atom = normalize_resource_type(resource_type)
    tag_id_int = if is_binary(tag_id), do: String.to_integer(tag_id), else: tag_id

    case Tags.tag_resource(tag_id_int, resource_type_atom, to_string(resource_id)) do
      {:ok, resource_tag} ->
        conn
        |> put_status(:created)
        |> json(%{data: resource_tag})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  @doc """
  Removes a tag from a resource.

  DELETE /api/dashboard/organizations/:organization_id/:resource_type/:resource_id/tags/:tag_id
  """
  def untag_resource(conn, %{
        "resource_type" => resource_type,
        "resource_id" => resource_id,
        "tag_id" => tag_id
      }) do
    resource_type_atom = normalize_resource_type(resource_type)
    {tag_id_int, _} = Integer.parse(tag_id)

    case Tags.untag_resource(tag_id_int, resource_type_atom, to_string(resource_id)) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{success: true})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Tag not found on resource"})
    end
  end

  @doc """
  Sets all tags for a resource (replaces existing tags).

  PUT /api/dashboard/organizations/:organization_id/:resource_type/:resource_id/tags

  Body: { "tag_ids": [1, 2, 3] }
  """
  def set_resource_tags(conn, %{
        "resource_type" => resource_type,
        "resource_id" => resource_id,
        "tag_ids" => tag_ids
      })
      when is_list(tag_ids) do
    resource_type_atom = normalize_resource_type(resource_type)

    tag_ids_int =
      Enum.map(tag_ids, fn id ->
        if is_binary(id), do: String.to_integer(id), else: id
      end)

    case Tags.set_resource_tags(resource_type_atom, to_string(resource_id), tag_ids_int) do
      {:ok, resource_tags} ->
        conn
        |> put_status(:ok)
        |> json(%{data: resource_tags})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: reason})
    end
  end

  # ============================================================================
  # Bulk Operations
  # ============================================================================

  @doc """
  Adds a tag to multiple resources at once.

  POST /api/dashboard/organizations/:organization_id/tags/:tag_id/bulk

  Body: { "resource_type": "media", "resource_ids": [1, 2, 3] }
  """
  def bulk_tag(conn, %{
        "tag_id" => tag_id,
        "resource_type" => resource_type,
        "resource_ids" => resource_ids
      })
      when is_list(resource_ids) do
    resource_type_atom = normalize_resource_type(resource_type)
    {tag_id_int, _} = Integer.parse(tag_id)
    resource_ids_str = Enum.map(resource_ids, &to_string/1)

    {:ok, count} = Tags.bulk_tag_resources(tag_id_int, resource_type_atom, resource_ids_str)

    conn
    |> put_status(:ok)
    |> json(%{success: true, count: count})
  end

  @doc """
  Removes a tag from multiple resources at once.

  DELETE /api/dashboard/organizations/:organization_id/tags/:tag_id/bulk

  Body: { "resource_type": "media", "resource_ids": [1, 2, 3] }
  """
  def bulk_untag(conn, %{
        "tag_id" => tag_id,
        "resource_type" => resource_type,
        "resource_ids" => resource_ids
      })
      when is_list(resource_ids) do
    resource_type_atom = normalize_resource_type(resource_type)
    {tag_id_int, _} = Integer.parse(tag_id)
    resource_ids_str = Enum.map(resource_ids, &to_string/1)

    {:ok, count} = Tags.bulk_untag_resources(tag_id_int, resource_type_atom, resource_ids_str)

    conn
    |> put_status(:ok)
    |> json(%{success: true, count: count})
  end

  # ============================================================================
  # Statistics
  # ============================================================================

  @doc """
  Returns tag usage statistics for an organization.

  GET /api/dashboard/organizations/:organization_id/tags/stats
  """
  def stats(conn, %{"organization_id" => organization_id}) do
    stats = Tags.get_tag_usage_stats(organization_id)

    conn
    |> put_status(:ok)
    |> json(%{data: stats})
  end

  # ============================================================================
  # Helpers
  # ============================================================================

  # Normalizes plural route path segments to singular resource type atoms.
  # e.g. "medias" -> :media, "devices" -> :device, "media" -> :media
  defp normalize_resource_type(resource_type) when is_binary(resource_type) do
    resource_type
    |> String.trim_trailing("s")
    |> String.to_existing_atom()
  end

  defp format_errors(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
