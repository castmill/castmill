defmodule CastmillWeb.ProxyController do
  use CastmillWeb, :controller
  @http_client HTTPoison

  def index(conn, %{"url" => url}) do
    case @http_client.get(url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body, headers: headers}} ->
        conn
        |> put_resp_header("content-type", get_content_type(headers))
        |> send_resp(200, body)

      {:ok, %HTTPoison.Response{status_code: status_code}} ->
        conn
        |> send_resp(status_code, "Error")

      {:error, %HTTPoison.Error{reason: reason}} ->
        conn
        |> send_resp(500, "Error: #{reason}")
    end
  end

  defp get_content_type(headers) do
    case Enum.find(headers, fn {k, _v} -> String.downcase(k) == "content-type" end) do
      nil -> "text/plain"
      {_, v} -> v
    end
  end
end
