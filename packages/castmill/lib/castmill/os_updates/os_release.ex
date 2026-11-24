defmodule Castmill.OsUpdates.OsRelease do
  @moduledoc """
  A Castmill OS release, imported from the release's `manifest.json`
  (castmill-os ADR-0010). `artifacts` maps a RAUC compatible
  (`castmill-os-<machine>`) to the update bundle for that hardware family:
  `%{"url" => ..., "sha256" => ..., "size" => ...}`.
  """
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key {:id, Ecto.UUID, autogenerate: true}

  @derive {Jason.Encoder,
           only: [:version, :prerelease, :security, :published_at, :notes_url, :artifacts]}

  schema "os_releases" do
    field(:version, :string)
    field(:prerelease, :boolean, default: false)
    field(:security, :boolean, default: false)
    field(:published_at, :utc_datetime)
    field(:notes_url, :string)
    field(:artifacts, :map)

    timestamps()
  end

  @version ~r/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
  @compatible ~r/^castmill-os-[a-z0-9-]{1,64}$/

  def changeset(release, attrs) do
    release
    |> cast(attrs, [:version, :prerelease, :security, :published_at, :notes_url, :artifacts])
    |> validate_required([:version, :published_at, :artifacts])
    |> validate_format(:version, @version)
    |> validate_length(:notes_url, max: 500)
    |> validate_change(:notes_url, &https_url/2)
    |> validate_change(:artifacts, fn :artifacts, artifacts -> validate_artifacts(artifacts) end)
    |> unique_constraint(:version)
  end

  defp https_url(field, url) do
    case URI.parse(url) do
      %URI{scheme: "https", host: host} when is_binary(host) and host != "" -> []
      _ -> [{field, "must be an https URL"}]
    end
  end

  defp validate_artifacts(artifacts) when is_map(artifacts) and map_size(artifacts) > 0 do
    Enum.flat_map(artifacts, fn
      {compatible, %{"url" => url, "sha256" => sha, "size" => size}}
      when is_binary(compatible) and is_binary(url) and is_binary(sha) and is_integer(size) and
             size > 0 ->
        cond do
          not Regex.match?(@compatible, compatible) -> [artifacts: "unknown compatible"]
          https_url(:artifacts, url) != [] -> [artifacts: "bundle URLs must be https"]
          not Regex.match?(~r/^[0-9a-f]{64}$/, sha) -> [artifacts: "invalid sha256"]
          true -> []
        end

      _ ->
        [artifacts: "each artifact needs url, sha256 and size"]
    end)
  end

  defp validate_artifacts(_), do: [artifacts: "must list at least one bundle"]
end
