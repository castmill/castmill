# In test/support/mocks.ex or a similar file
defmodule Castmill.Mocks do
  use Mox

  # Define the mock based on the actual behaviour/module
  defmock(HooksMock, for: Castmill.Hooks)
  defmock(MailerMock, for: Castmill.Mailer)
  defmock(AccountsMock, for: Castmill.Accounts)
end
