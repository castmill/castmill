defmodule Castmill.QueryHelpers do
  import Ecto.Query, warn: false

  def where_name_like(query, nil) do
    query
  end

  def where_name_like(query, pattern) do
    from(e in query,
      where: ilike(e.name, ^"%#{pattern}%")
    )
  end

  # Applies combined filters to a query based on provided filter tuples.
  # This assumes that each filter is processed by an implementation of Filterable behavior
  # to return a dynamic expression.
  # Use this function to apply combined dynamics correctly
  def apply_combined_filters(query, filters, resource_module) do
    if filters !== nil && not Enum.empty?(filters) do
      dynamics =
        Enum.map(filters, fn {field, value} ->
          resource_module.apply_filter({field, value})
        end)

      combined_dynamic = combine_dynamics(dynamics)

      if combined_dynamic do
        from(d in query, where: ^combined_dynamic)
      else
        query
      end
    else
      query
    end
  end

  # Combine multiple dynamics with OR logic
  defp combine_dynamics(dynamics) do
    Enum.reduce(dynamics, nil, fn
      nil, acc -> acc
      dyn, nil -> dyn
      dyn, acc -> dynamic([d], ^acc or ^dyn)
    end)
  end
end
