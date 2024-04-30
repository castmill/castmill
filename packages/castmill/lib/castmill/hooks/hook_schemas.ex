defmodule Castmill.HookSchemas do
  @hook_schemas %{
    # Example hook with expected args
    user_signup: [:user_id, :email],
    user_signin: [:user_id],
    file_upload: [:account_id, :file_id],
    device_registered: [:device_id]
  }

  # Checks if a hook name is valid and if the given args match the expected schema
  def validate_hook(hook_name, args) do
    case Map.fetch(@hook_schemas, hook_name) do
      :error ->
        {:error, :invalid_hook}

      {:ok, expected_args} ->
        if Enum.sort(Map.keys(args)) == Enum.sort(expected_args),
          do: :ok,
          else: {:error, :invalid_args}
    end
  end

  def validate_hook(hook_name) do
    case Map.fetch(@hook_schemas, hook_name) do
      :error -> {:error, :invalid_hook}
      {:ok, _expected_args} -> :ok
    end
  end

  def hook_args(hook_name), do: Map.get(@hook_schemas, hook_name, [])
end
