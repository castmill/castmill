defmodule CastmillWeb.LegalController do
  @moduledoc """
  The operator's legal documents, at `/privacy` and `/terms`.

  Each is an HTML file set in the configuration, as a path or an
  `{app, path}` inside that app's directory:

      config :castmill, :legal_documents,
        privacy: {:my_app, "priv/legal/privacy.html"},
        terms: {:my_app, "priv/legal/terms.html"}

  A document that isn't configured is not found. Networks link to their
  own documents with their privacy policy and terms URLs.
  """
  use CastmillWeb, :controller

  def privacy(conn, _params), do: serve(conn, :privacy)
  def terms(conn, _params), do: serve(conn, :terms)

  defp serve(conn, document) do
    with source when not is_nil(source) <- source(document),
         path = resolve(source),
         true <- File.regular?(path) do
      conn
      |> put_resp_content_type("text/html")
      |> put_resp_header("cache-control", "public, max-age=300")
      |> send_file(200, path)
    else
      _ -> conn |> put_status(:not_found) |> text("Not found")
    end
  end

  defp source(document) do
    case Application.get_env(:castmill, :legal_documents) do
      documents when is_list(documents) or is_map(documents) -> documents[document]
      _ -> nil
    end
  end

  defp resolve({app, path}), do: Application.app_dir(app, path)
  defp resolve(path) when is_binary(path), do: path
end
