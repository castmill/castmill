defmodule Castmill.Repo.Migrations.AddRootUser do
  use Ecto.Migration

  def change do
    email =
      System.get_env("CASTMILL_ROOT_USER_EMAIL") ||
        raise "environment variable CASTMILL_ROOT_USER_EMAIL is missing."

    password =
      System.get_env("CASTMILL_ROOT_USER_PASSWORD") ||
        raise "environment variable CASTMILL_ROOT_USER_PASSWORD is missing."

    user =
      %Castmill.Accounts.User{
        name: "root",
        email: email,
        network_id: nil
      }
      |> Castmill.Accounts.User.changeset(%{})
      |> Castmill.Repo.insert!()

    # The access token is constructed from the user's name and a password
    token = user.email <> ":" <> password

    %Castmill.Accounts.AccessToken{}
    |> Castmill.Accounts.AccessToken.changeset(%{
      is_root: true,
      user_id: user.id,
      secret: token
    })
    |> Castmill.Repo.insert!()
  end
end
