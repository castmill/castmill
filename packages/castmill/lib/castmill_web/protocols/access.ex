defprotocol Castmill.Protocol.Access do

  @doc "Returns if the user can access the given resource"
  @spec canAccess(t, %Castmill.Accounts.User{}, String) :: {:ok, boolean} | {:error, String.t()}
  @fallback_to_any true
  def canAccess(resource, user, action)
end

defimpl Castmill.Protocol.Access, for: Any do
   # def canAccess(resource, _user), do: {:error, "No access for this resource #{inspect resource}"}
   def canAccess(resource, _user, _action) do
    IO.puts("No access for this resource #{inspect resource}")
    {:error, "No access for this resource #{inspect resource}"}
   end
end
