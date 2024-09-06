defmodule Castmill.Behaviour.Filterable do
  @callback apply_filter({String.t(), any()}) :: any() | nil
end
