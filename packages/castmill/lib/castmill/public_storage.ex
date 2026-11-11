defmodule Castmill.PublicStorage do
  @moduledoc """
  Stores public files (copied feed media, bundled widget assets) where
  organization media are stored (`:file_storage` is `:local` or `:s3`), so that
  their URLs are absolute and resolve like other media.

  Tests replace the implementation with `config :castmill, :public_storage`.
  """

  @callback put(String.t(), binary(), String.t()) :: {:ok, String.t()} | {:error, term()}
  @callback delete(String.t()) :: :ok | {:error, term()}

  @doc "Stores `body` under `key` and returns its public URL."
  def put(key, body, content_type), do: impl().put(key, body, content_type)

  @doc "Deletes the file stored under `key`. Missing files are not an error."
  def delete(key), do: impl().delete(key)

  defp impl, do: Application.get_env(:castmill, :public_storage, __MODULE__.Default)

  defmodule Default do
    @moduledoc false
    @behaviour Castmill.PublicStorage

    alias Castmill.Workers.Helpers

    @impl true
    def put(key, body, content_type) do
      case Application.get_env(:castmill, :file_storage) do
        :s3 ->
          bucket = System.get_env("AWS_S3_BUCKET")

          case ExAws.S3.put_object(bucket, key, body, content_type: content_type)
               |> ExAws.request() do
            {:ok, _} -> {:ok, Helpers.get_public_uri(bucket, key)}
            {:error, reason} -> {:error, reason}
          end

        _local ->
          path = local_path(key)

          with :ok <- File.mkdir_p(Path.dirname(path)),
               :ok <- File.write(path, body) do
            {:ok, "#{Helpers.get_media_base_url()}/medias/#{key}"}
          end
      end
    end

    @impl true
    def delete(key) do
      case Application.get_env(:castmill, :file_storage) do
        :s3 ->
          case ExAws.S3.delete_object(System.get_env("AWS_S3_BUCKET"), key) |> ExAws.request() do
            {:ok, _} -> :ok
            {:error, reason} -> {:error, reason}
          end

        _local ->
          case File.rm(local_path(key)) do
            :ok -> :ok
            {:error, :enoent} -> :ok
            error -> error
          end
      end
    end

    defp local_path(key), do: Path.join([Helpers.static_dir(), "medias", key])
  end
end
