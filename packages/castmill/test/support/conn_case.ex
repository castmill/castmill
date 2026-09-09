defmodule CastmillWeb.ConnCase do
  @moduledoc """
  This module defines the test case to be used by
  tests that require setting up a connection.

  Such tests rely on `Phoenix.ConnTest` and also
  import other functionality to make it easier
  to build common data structures and query the data layer.

  Finally, if the test case interacts with the database,
  we enable the SQL sandbox, so changes done to the database
  are reverted at the end of every test. If you are using
  PostgreSQL, you can even run database tests asynchronously
  by setting `use CastmillWeb.ConnCase, async: true`, although
  this option is not recommended for other databases.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      # The default endpoint for testing
      @endpoint CastmillWeb.Endpoint

      use CastmillWeb, :verified_routes

      # Import conveniences for testing with connections
      import Plug.Conn
      import Phoenix.ConnTest
      import CastmillWeb.ConnCase
    end
  end

  setup tags do
    Castmill.DataCase.setup_sandbox(tags)
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end

  @doc """
  Signs a Phoenix.Token for the given user id, suitable for the
  `Authorization: Bearer <token>` header expected by the dashboard
  `fetch_dashboard_user` pipeline plug.
  """
  def sign_bearer_token(user_id) do
    Phoenix.Token.sign(
      CastmillWeb.Endpoint,
      CastmillWeb.Secrets.get_dashboard_user_token_salt(),
      user_id
    )
  end

  @doc """
  Adds a Bearer token `Authorization` header for the given user,
  so the request is authenticated through the `fetch_dashboard_user`
  pipeline plug.
  """
  def put_bearer_auth(conn, user) do
    token = sign_bearer_token(user.id)
    Plug.Conn.put_req_header(conn, "authorization", "Bearer #{token}")
  end
end
