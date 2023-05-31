defmodule CastmillWeb.UserJSON do
  alias Castmill.Accounts.User

  @doc """
  Renders a list of users.
  """
  def index(%{users: users}) do
    %{data: for(user <- users, do: data(user))}
  end

  def index(%{users_access: users_access}) do
    %{data: for([user, access] <- users_access, do: data(user, access))}
  end

  @doc """
  Renders a single user.
  """
  def show(%{user: user}) do
    %{data: data(user)}
  end

  defp data(%User{} = user) do
    %{
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      email: user.email
    }
  end

  defp data(%User{} = user, access) do
    %{
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      email: user.email,
      access: access
    }
  end
end
