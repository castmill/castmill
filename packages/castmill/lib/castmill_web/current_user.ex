defmodule CastmillWeb.CurrentUser do
  @moduledoc """
  The signed-in user of a request, for recording who performed an action
  (for example as a notification's actor).
  """

  @doc "The ID of the signed-in user, or `nil` (API keys, devices, ...)."
  def id(%Plug.Conn{assigns: assigns}) do
    case Map.get(assigns, :current_user) do
      %{id: id} -> id
      _ -> nil
    end
  end
end
