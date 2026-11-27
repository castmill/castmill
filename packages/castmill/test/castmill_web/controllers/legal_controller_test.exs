defmodule CastmillWeb.LegalControllerTest do
  use CastmillWeb.ConnCase, async: false

  setup do
    previous = Application.get_env(:castmill, :legal_documents)
    dir = Path.join(System.tmp_dir!(), "legal-#{System.unique_integer([:positive])}")
    File.mkdir_p!(dir)
    File.write!(Path.join(dir, "privacy.html"), "<h1>Privacy</h1>")

    on_exit(fn ->
      File.rm_rf(dir)

      if previous,
        do: Application.put_env(:castmill, :legal_documents, previous),
        else: Application.delete_env(:castmill, :legal_documents)
    end)

    %{dir: dir}
  end

  test "serves the configured documents", %{conn: conn, dir: dir} do
    Application.put_env(:castmill, :legal_documents,
      privacy: Path.join(dir, "privacy.html"),
      terms: Path.join(dir, "missing.html")
    )

    conn = get(conn, "/privacy")
    assert html_response(conn, 200) == "<h1>Privacy</h1>"

    # A configured file that doesn't exist is not found.
    assert build_conn() |> get("/terms") |> response(404)
  end

  test "documents that aren't configured are not found", %{conn: conn} do
    Application.delete_env(:castmill, :legal_documents)

    assert conn |> get("/privacy") |> response(404)
    assert build_conn() |> get("/terms") |> response(404)
  end
end
