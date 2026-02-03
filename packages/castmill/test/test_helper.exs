ExUnit.start()
Ecto.Adapters.SQL.Sandbox.mode(Castmill.Repo, :manual)
Mox.defmock(Castmill.AccountsMock, for: Castmill.AccountsBehaviour)
Mox.defmock(Castmill.Workers.SystemCmdMock, for: Castmill.Workers.SystemCmdBehaviour)
