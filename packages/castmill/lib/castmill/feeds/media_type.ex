defmodule Castmill.Feeds.MediaType do
  @moduledoc """
  Detects the type of a downloaded feed media from its bytes. Only common image
  and video formats are accepted; the `Content-Type` header must not contradict
  them (e.g. an HTML error page served with status 200 is rejected).
  """

  @type t :: %{kind: :image | :video, content_type: String.t(), extension: String.t()}

  @generic_types ~w(application/octet-stream binary/octet-stream)
  @heif_brands ~w(avif avis heic heix heim heis hevc hevx mif1 msf1)

  @spec detect(binary(), String.t() | nil) :: {:ok, t()} | {:error, :unsupported_type}
  def detect(body, header_content_type \\ nil) when is_binary(body) do
    with {:ok, type} <- sniff(body),
         true <- header_allows?(header_content_type) do
      {:ok, type}
    else
      _ -> {:error, :unsupported_type}
    end
  end

  defp sniff(<<0xFF, 0xD8, 0xFF, _::binary>>), do: image("image/jpeg", "jpg")
  defp sniff(<<0x89, "PNG", 0x0D, 0x0A, 0x1A, 0x0A, _::binary>>), do: image("image/png", "png")
  defp sniff(<<"GIF8", v, "a", _::binary>>) when v in [?7, ?9], do: image("image/gif", "gif")
  defp sniff(<<"RIFF", _::binary-size(4), "WEBP", _::binary>>), do: image("image/webp", "webp")
  defp sniff(<<0x1A, 0x45, 0xDF, 0xA3, _::binary>>), do: video("video/webm", "webm")
  defp sniff(<<_::binary-size(4), "ftypqt  ", _::binary>>), do: video("video/quicktime", "mov")

  defp sniff(<<_::binary-size(4), "ftyp", brand::binary-size(4), _::binary>>) do
    if brand in @heif_brands, do: :error, else: video("video/mp4", "mp4")
  end

  defp sniff(_body), do: :error

  defp image(content_type, extension),
    do: {:ok, %{kind: :image, content_type: content_type, extension: extension}}

  defp video(content_type, extension),
    do: {:ok, %{kind: :video, content_type: content_type, extension: extension}}

  defp header_allows?(nil), do: true

  defp header_allows?(content_type) do
    type =
      content_type
      |> String.split(";")
      |> hd()
      |> String.trim()
      |> String.downcase()

    type == "" or type in @generic_types or String.starts_with?(type, ["image/", "video/"])
  end
end
