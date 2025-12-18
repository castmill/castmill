defmodule CastmillWeb.Live.Admin.NetworkIntegrationForm do
  @moduledoc """
  LiveView component for configuring network-level widget integration credentials.

  This form allows network administrators to configure Client ID/Secret and other
  credentials that are shared across all organizations in the network.
  """
  use CastmillWeb, :live_component

  alias Castmill.Widgets.Integrations

  @impl true
  def render(assigns) do
    ~H"""
    <div class="container">
      <div class="title">
        <h1>Configure <%= @integration.name %></h1>
        <p class="text-sm text-gray-500 mt-1">
          For widget: <%= @integration.widget.name %>
        </p>
      </div>

      <.simple_form
        for={@form}
        id="network-integration-form"
        phx-target={@myself}
        phx-change="validate"
        phx-submit="save"
      >
        <div :for={field <- @credential_fields} class="mb-4">
          <.input
            field={@form[field.key]}
            type={field.type}
            label={field.label}
            placeholder={field.placeholder}
          />
        </div>

        <div class="flex items-center gap-2 py-4">
          <input
            type="checkbox"
            id="is_enabled"
            name="credentials[is_enabled]"
            checked={@is_enabled}
            class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
          <label for="is_enabled" class="text-sm font-medium text-gray-700">
            Enable this integration for organizations
          </label>
        </div>

        <:actions>
          <.button phx-disable-with="Saving...">Save Credentials</.button>
          <.button :if={@has_existing} type="button" phx-click="delete" phx-target={@myself} class="bg-red-600 hover:bg-red-700">
            Delete Credentials
          </.button>
        </:actions>
      </.simple_form>

      <div :if={@has_existing} class="mt-4 p-3 bg-green-50 rounded-md border border-green-200">
        <p class="text-sm text-green-800">
          <span class="font-semibold">✓ Configured</span>
          - Credentials are stored and encrypted for this network.
        </p>
      </div>
    </div>
    """
  end

  @impl true
  def update(assigns, socket) do
    integration = assigns.integration
    network_id = assigns.network_id

    # Get credential schema from integration
    credential_schema = integration.credential_schema || default_oauth_schema()
    credential_fields = parse_credential_schema(credential_schema)

    # Check if credentials already exist
    existing_credential = Integrations.get_network_credentials(network_id, integration.id)
    has_existing = existing_credential != nil

    # Get existing values (masked) if available
    initial_values = get_initial_values(existing_credential, credential_fields)
    is_enabled = if existing_credential, do: existing_credential.is_enabled, else: true

    # Build a simple form for credentials
    form_data = Enum.into(credential_fields, %{}, fn field ->
      {field.key, initial_values[field.key] || ""}
    end)

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:integration, integration)
     |> assign(:credential_fields, credential_fields)
     |> assign(:has_existing, has_existing)
     |> assign(:is_enabled, is_enabled)
     |> assign_form(form_data)}
  end

  @impl true
  def handle_event("validate", %{"credentials" => params}, socket) do
    # Just update form with new values (no server-side validation yet)
    form_data = extract_credential_values(params, socket.assigns.credential_fields)
    # HTML checkboxes send "on" when checked, nothing when unchecked
    is_enabled = Map.has_key?(params, "is_enabled")

    {:noreply,
     socket
     |> assign(:is_enabled, is_enabled)
     |> assign_form(form_data)}
  end

  def handle_event("save", %{"credentials" => params}, socket) do
    network_id = socket.assigns.network_id
    integration_id = socket.assigns.integration.id
    credential_fields = socket.assigns.credential_fields
    # HTML checkboxes send "on" when checked, nothing when unchecked
    is_enabled = Map.has_key?(params, "is_enabled")

    # Extract only the credential fields (not is_enabled)
    credentials = extract_credential_values(params, credential_fields)

    # Validate required fields
    case validate_credentials(credentials, credential_fields) do
      :ok ->
        save_credentials(socket, network_id, integration_id, credentials, is_enabled)

      {:error, errors} ->
        {:noreply,
         socket
         |> put_flash(:error, "Please fill in all required fields: #{Enum.join(errors, ", ")}")}
    end
  end

  def handle_event("delete", _params, socket) do
    network_id = socket.assigns.network_id
    integration_id = socket.assigns.integration.id

    case Integrations.delete_network_credentials(network_id, integration_id) do
      {:ok, _} ->
        notify_parent({:deleted, integration_id})

        {:noreply,
         socket
         |> put_flash(:info, "Credentials deleted successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, _reason} ->
        {:noreply,
         socket
         |> put_flash(:error, "Failed to delete credentials")}
    end
  end

  defp save_credentials(socket, network_id, integration_id, credentials, is_enabled) do
    # Convert credential keys to strings
    credentials_map = Enum.into(credentials, %{}, fn {k, v} -> {to_string(k), v} end)

    case Integrations.upsert_network_credentials(network_id, integration_id, credentials_map) do
      {:ok, credential} ->
        # Update enabled status if different
        if credential.is_enabled != is_enabled do
          Integrations.set_network_credentials_enabled(network_id, integration_id, is_enabled)
        end

        notify_parent({:saved, integration_id})

        {:noreply,
         socket
         |> put_flash(:info, "Credentials saved successfully")
         |> push_patch(to: socket.assigns.patch)}

      {:error, %Ecto.Changeset{} = changeset} ->
        error_messages =
          changeset.errors
          |> Enum.map(fn {field, {msg, _}} -> "#{field}: #{msg}" end)
          |> Enum.join(", ")

        {:noreply,
         socket
         |> put_flash(:error, "Failed to save: #{error_messages}")}

      {:error, reason} ->
        {:noreply,
         socket
         |> put_flash(:error, "Failed to save credentials: #{inspect(reason)}")}
    end
  end

  defp validate_credentials(credentials, credential_fields) do
    errors =
      credential_fields
      |> Enum.filter(fn field -> field.required end)
      |> Enum.filter(fn field ->
        value = Map.get(credentials, field.key)
        is_nil(value) or value == ""
      end)
      |> Enum.map(fn field -> field.label end)

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  defp extract_credential_values(params, credential_fields) do
    Enum.into(credential_fields, %{}, fn field ->
      key = to_string(field.key)
      {field.key, Map.get(params, key, "")}
    end)
  end

  defp get_initial_values(nil, _fields), do: %{}
  defp get_initial_values(_credential, fields) do
    # For existing credentials, show masked values
    # We don't show actual values for security reasons
    Enum.into(fields, %{}, fn field ->
      if field.type == :password do
        {field.key, ""}  # Don't show password values
      else
        {field.key, "••••••••"}  # Placeholder for existing values
      end
    end)
  end

  defp parse_credential_schema(nil), do: default_oauth_fields()

  defp parse_credential_schema(schema) when is_map(schema) do
    fields = Map.get(schema, "fields", %{})

    # Handle both list format and map format for fields
    parsed_fields =
      case fields do
        fields when is_list(fields) ->
          # List format: [%{"name" => "client_id", "label" => "...", ...}]
          Enum.map(fields, fn field ->
            %{
              key: String.to_atom(field["name"]),
              label: field["label"] || field["name"],
              type: parse_field_type(field["type"] || field["input_type"]),
              required: field["required"] != false,
              placeholder: field["placeholder"] || ""
            }
          end)

        fields when is_map(fields) ->
          # Map format: %{"client_id" => %{"label" => "...", ...}, ...}
          Enum.map(fields, fn {key, field} ->
            %{
              key: String.to_atom(key),
              label: field["label"] || key,
              type: parse_field_type(field["type"] || field["input_type"]),
              required: field["required"] != false,
              placeholder: field["placeholder"] || field["description"] || ""
            }
          end)

        _ ->
          default_oauth_fields()
      end

    # Sort to ensure consistent ordering (client_id before client_secret)
    Enum.sort_by(parsed_fields, &to_string(&1.key))
  end

  defp parse_field_type("password"), do: :password
  defp parse_field_type("secret"), do: :password
  defp parse_field_type("text"), do: :text
  defp parse_field_type(_), do: :text

  defp default_oauth_schema do
    %{
      "fields" => [
        %{"name" => "client_id", "label" => "Client ID", "type" => "text", "required" => true},
        %{"name" => "client_secret", "label" => "Client Secret", "type" => "password", "required" => true}
      ]
    }
  end

  defp default_oauth_fields do
    [
      %{key: :client_id, label: "Client ID", type: :text, required: true, placeholder: "Enter Client ID"},
      %{key: :client_secret, label: "Client Secret", type: :password, required: true, placeholder: "Enter Client Secret"}
    ]
  end

  defp assign_form(socket, form_data) do
    # Convert to a form struct for the template
    # Form data must use string keys
    form =
      form_data
      |> Enum.map(fn {k, v} -> {to_string(k), v} end)
      |> Enum.into(%{})
      |> to_form(as: :credentials)

    assign(socket, :form, form)
  end

  defp notify_parent(msg), do: send(self(), {__MODULE__, msg})
end
