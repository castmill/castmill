defmodule CastmillWeb.LegacyAdapter do
  @moduledoc """
  The generated legacy adapter's entry page and service worker, as served.

  Both name the server's public URL. The page declares it in a
  `castmill-server-url` meta tag, which the adapter uses as its API URL when
  another host serves the page outside /legacy. The worker ends with it, so a
  changed URL changes the worker and players reinstall the cached adapter.
  """

  @doc """
  Returns the served contents of `index.html` or `sw.js`, or nil if the adapter
  was not built.
  """
  def file(name) when name in ["index.html", "sw.js"] do
    case File.read(Application.app_dir(:castmill, Path.join("priv/static/legacy", name))) do
      {:ok, contents} -> declare_server(name, contents, CastmillWeb.Endpoint.url())
      {:error, _} -> nil
    end
  end

  defp declare_server("index.html", html, url) do
    meta = ~s(<meta name="castmill-server-url" content="#{Plug.HTML.html_escape(url)}">)
    String.replace(html, "</head>", meta <> "</head>", global: false)
  end

  defp declare_server("sw.js", worker, url) do
    worker <> "\n// castmill-server-url: " <> String.replace(url, ~r/[\r\n]/, "") <> "\n"
  end
end
