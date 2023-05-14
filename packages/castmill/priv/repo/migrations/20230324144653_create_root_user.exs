defmodule Castmill.Repo.Migrations.AddRootUser do
  use Ecto.Migration

  def change do
    user =
      %Castmill.Accounts.User{
        name: "root",
        email: "info@castmill.com",
        network_id: nil
      }
      |> Castmill.Accounts.User.changeset(%{})
      |> Castmill.Repo.insert!()

    # The access token is constructed from the user's name and a password
    token = user.email <> ":1234567890"

    %Castmill.Accounts.AccessToken{}
    |> Castmill.Accounts.AccessToken.changeset(%{
      is_root: true,
      user_id: user.id,
      secret: token
    })
    |> Castmill.Repo.insert!()
  end
end
