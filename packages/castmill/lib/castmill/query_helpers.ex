defmodule Castmill.QueryHelpers do
  import Ecto.Query, warn: false
  def where_name_like(query, nil) do
    query
  end

  def where_name_like(query, pattern) do
    from e in query,
      where: ilike(e.name, ^"%#{pattern}%")
  end
end
