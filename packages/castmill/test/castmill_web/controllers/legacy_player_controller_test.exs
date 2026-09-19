defmodule CastmillWeb.LegacyPlayerControllerTest do
  use CastmillWeb.ConnCase, async: false

  @legacy_static_path Application.app_dir(:castmill, "priv/static/legacy")
  @index_html "<!doctype html><title>Legacy Player</title>"
  @asset_contents "console.log('legacy player');"
  @worker_contents "self.addEventListener('fetch', function () {});"

  setup do
    backup_path = "#{@legacy_static_path}.backup-#{System.unique_integer([:positive])}"
    existing_bundle? = File.exists?(@legacy_static_path)

    if existing_bundle? do
      File.rename!(@legacy_static_path, backup_path)
    end

    File.mkdir_p!(Path.join(@legacy_static_path, "assets"))
    File.write!(Path.join(@legacy_static_path, "index.html"), @index_html)
    File.write!(Path.join(@legacy_static_path, "assets/player.js"), @asset_contents)
    File.write!(Path.join(@legacy_static_path, "sw.js"), @worker_contents)

    on_exit(fn ->
      File.rm_rf!(@legacy_static_path)

      if existing_bundle? do
        File.rename!(backup_path, @legacy_static_path)
      end
    end)

    :ok
  end

  test "serves the legacy player entry document", %{conn: conn} do
    conn = get(conn, "/legacy")

    assert response(conn, 200) == @index_html
    assert get_resp_header(conn, "x-frame-options") == []
    assert get_resp_header(conn, "x-content-type-options") == ["nosniff"]
    assert get_resp_header(conn, "cache-control") == ["no-cache"]
    assert get(conn, "/legacy/") |> response(200) == @index_html
  end

  test "serves legacy static assets and does not fall back for missing files", %{conn: conn} do
    assert get(conn, "/legacy/assets/player.js") |> response(200) == @asset_contents
    assert get(conn, "/legacy/assets/missing.js") |> response(404)
  end

  test "serves the generated entry document with revalidation", %{conn: conn} do
    conn = get(conn, "/legacy/index.html")

    assert response(conn, 200) == @index_html
    assert get_resp_header(conn, "cache-control") == ["no-cache"]
  end

  test "serves the service worker with an explicit legacy scope", %{conn: conn} do
    conn = get(conn, "/legacy/sw.js")

    assert response(conn, 200) == @worker_contents
    assert get_resp_header(conn, "cache-control") == ["no-cache"]
    assert get_resp_header(conn, "service-worker-allowed") == ["/legacy"]
  end
end
