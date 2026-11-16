defmodule CastmillWeb.Live.Admin.TabSearch do
  @moduledoc """
  Filters the rows of an admin resource tab by the search box term:
  case-insensitive matches on the name, email, slug, domain or hostname, or an
  exact id.
  """

  @text_fields [:name, :email, :slug, :domain, :hostname, :organization_name]

  @spec filter([map()], String.t() | nil) :: [map()]
  def filter(rows, search) do
    case normalize(search) do
      "" -> rows
      term -> Enum.filter(rows, &matches?(&1, term))
    end
  end

  @doc "The trimmed search term (empty when there is none)."
  @spec normalize(String.t() | nil) :: String.t()
  def normalize(search) when is_binary(search), do: String.trim(search)
  def normalize(_search), do: ""

  defp matches?(row, term) do
    downcased = String.downcase(term)

    to_string(Map.get(row, :id)) == term or
      Enum.any?(@text_fields, fn field ->
        case Map.get(row, field) do
          value when is_binary(value) -> String.contains?(String.downcase(value), downcased)
          _ -> false
        end
      end)
  end
end
