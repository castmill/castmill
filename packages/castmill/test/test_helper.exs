ExUnit.start()
Ecto.Adapters.SQL.Sandbox.mode(Castmill.Repo, :manual)
Mox.defmock(Castmill.AccountsMock, for: Castmill.AccountsBehaviour)
