defmodule Castmill.Workers.Helpers do
  require Logger

  @chunk_size 5_242_880

  def get_file_from_uri(uri) do
    file =
      case URI.parse(uri) do
        %URI{scheme: "file"} ->
          String.trim_leading(uri, "file://")

        %URI{scheme: scheme} when scheme in ["http", "https"] ->
          temp_input_file = get_temp_file()
          download_file(uri, temp_input_file)
          temp_input_file

        %URI{scheme: "s3"} ->
          temp_input_file = get_temp_file()
          download_s3_file(uri, temp_input_file)
          temp_input_file

        %URI{scheme: nil} ->
          uri

        _ ->
          Logger.error("Unsupported input URI scheme: #{uri}")
          raise "Unsupported input URI scheme: #{uri}"
      end

    file
  end

  def get_stream_from_uri(uri) do
    case URI.parse(uri) do
      %URI{scheme: "file", path: path} = _uri ->
        {:ok, File.stream!(path, [], 8192)}

      # Assume that https and http are for S3 files
      %URI{path: path, scheme: scheme} = _uri when scheme in ["http", "https", "s3"] ->
        {:ok,
         ExAws.S3.download_file(System.get_env("AWS_S3_TMP_BUCKET"), path, :memory)
         |> ExAws.stream!()}

      _ ->
        {:error, :invalid_protocol}
    end
  end

  def static_dir do
    priv_dir = :code.priv_dir(:castmill) |> to_string()
    Path.join(priv_dir, "static")
  end

  defp download_file(url, destination) do
    # Use HTTPoison or another HTTP client to download the file
    {:ok, response} = HTTPoison.get(url, [], stream_to: self(), async: :once)

    File.open(destination, [:write, :binary], fn file ->
      receive_response(response.id, file)
    end)
  end

  defp download_s3_file(s3_uri, local_path) do
    # Parse the S3 URI
    %URI{host: bucket, path: key} = URI.parse(s3_uri)

    # Remove leading `/` from key if present
    key = String.trim_leading(key, "/")

    # Download and stream the file to the specified local path
    ExAws.S3.download_file(bucket, key, local_path)
    |> ExAws.request!()
  end

  defp get_temp_file() do
    temp_dir = System.tmp_dir!()
    file_name = UUID.uuid4() <> ".tmp"
    Path.join(temp_dir, file_name)
  end

  defp receive_response(request_id, file) do
    receive do
      %HTTPoison.AsyncStatus{id: ^request_id} ->
        :ok

      %HTTPoison.AsyncHeaders{id: ^request_id, headers: _headers} ->
        :ok

      %HTTPoison.AsyncChunk{id: ^request_id, chunk: chunk} ->
        IO.binwrite(file, chunk)
        HTTPoison.stream_next(request_id)
        receive_response(request_id, file)

      %HTTPoison.AsyncEnd{id: ^request_id} ->
        :ok
    end
  end

  def upload_to_s3(local_path, dst_path) do
    bucket = System.get_env("AWS_S3_BUCKET")

    # Get file size
    %{size: size} = File.stat!(local_path)

    File.stream!(local_path, [], @chunk_size)
    |> ExAws.S3.upload(bucket, dst_path, part_size: @chunk_size)
    |> ExAws.request!()

    uri = get_s3_uri(bucket, dst_path)
    {uri, size}
  end

  def get_s3_uri(bucket, dst_path) do
    # Generate URI dynamically based on the ExAws configuration
    s3_config = ExAws.Config.new(:s3)

    # Construct the URI
    scheme = s3_config[:scheme] || "https://"
    host = s3_config[:host] || "s3.amazonaws.com"
    port = s3_config[:port] || 443

    "#{scheme}#{host}:#{port}/#{bucket}/#{dst_path}"
  end

  def get_endpoint_url do
    config = Application.get_env(:castmill, CastmillWeb.Endpoint)
    url_config = config[:url]

    host = url_config[:host]
    port = url_config[:port]
    scheme = url_config[:scheme]

    "#{scheme}://#{host}:#{port}"
  end
end
