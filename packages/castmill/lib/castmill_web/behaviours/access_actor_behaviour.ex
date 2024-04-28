defmodule CastmillWeb.AccessActorBehaviour do
  @callback check_access(actor_id :: String.t(), action :: atom(), params :: %{}) ::
              {:ok, boolean} | {:error, String.t()}

  defmacro __using__(_) do
    quote do
      @behaviour CastmillWeb.AccessActorBehaviour
      def check_access(actor_id, action, params) do
        {:ok, false}
      end

      defoverridable check_access: 3
    end
  end
end
