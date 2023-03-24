defmodule Castmill.Repo do
  use Ecto.Repo,
    otp_app: :castmill,
    adapter: Ecto.Adapters.Postgres
end
