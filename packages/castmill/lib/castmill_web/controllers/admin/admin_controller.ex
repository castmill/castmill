defmodule CastmillWeb.Admin.AdminController do
  use CastmillWeb, :controller

  def home(conn, _params) do
    # The home page is often custom made,
    # so skip the default app layout.
    render(conn, :admin, layout: false)
  end
end
