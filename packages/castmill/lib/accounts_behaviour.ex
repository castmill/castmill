defmodule Castmill.AccountsBehaviour do
  @callback generate_user_session_token(user_id :: any()) :: String.t()

  # TODO: add more behaviour here as needed by the tests.

end
