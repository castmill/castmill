defmodule Castmill.Behaviour.Filterable do
  @callback apply_filter({String.t(), any()}) :: dynamic | nil
end
