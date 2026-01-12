defmodule Castmill.Widgets.Integrations.Fetchers.TestStub do
  @moduledoc false

  def fetch(_credentials, _options) do
    {:ok, %{"items" => [%{"title" => "stub"}]}, %{}}
  end
end
