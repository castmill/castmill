defprotocol Castmill.Protocol.Resource do
  @doc "Returns the resource type"
  @spec type(t) :: String.t()
  @fallback_to_any true
  def type(resource)
end

defimpl Castmill.Protocol.Resource, for: Any do
   def type(_value), do: "unknown"
end
