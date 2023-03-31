defmodule CastmillWeb.AccessTokenJSON do
  alias Castmill.Accounts.AccessToken

  @doc """
  Renders a list of access_tokens.
  """
  def index(%{access_tokens: access_tokens}) do
    %{data: for(access_token <- access_tokens, do: data(access_token))}
  end

  @doc """
  Renders a single access_token.
  """
  def show(%{access_token: access_token}) do
    %{data: data(access_token)}
  end

  defp data(%AccessToken{} = access_token) do
    %{
      id: access_token.id,
      accessed: access_token.accessed,
      accessed_at: access_token.accessed_at,
      last_ip: access_token.last_ip
    }
  end
end
