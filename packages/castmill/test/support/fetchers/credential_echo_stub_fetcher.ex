defmodule Castmill.Widgets.Integrations.Fetchers.CredentialEchoStub do
  @moduledoc false

  # Reports which access token was used and returns rotated credentials so tests
  # can verify credential scoping and persistence of refreshed credentials.
  def fetch(credentials, _options) do
    token = Map.get(credentials, "access_token")

    {:ok, %{"token_used" => token}, Map.put(credentials, "access_token", "#{token}-rotated")}
  end
end
