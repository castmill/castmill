defmodule Castmill.OsUpdates do
  @moduledoc """
  OS updates for Castmill OS devices (castmill-os ADR-0010).

  * **Releases** are imported from the GitHub releases of Castmill OS: each
    release carries a `manifest.json` with one update bundle per hardware
    family (RAUC compatible).
  * **Organization policy** (`organizations.os_update`): `manual` (default:
    only devices with an override update), `latest` (newest release;
    pre-releases only with `prereleases: true`) or `version` (stay on one).
  * **Device override** (`devices.os_update`): `follow` (the organization) or
    `version`, optionally with `now` to activate without waiting for the
    device's maintenance window.
  * **Target** pushed to the device on its channel as `os_update`; the device
    reports its progress with `os_update:report` (`devices.os_status`).

  The device itself verifies the bundle signature, refuses downgrades that
  don't come from an override, and rolls back a release that fails its health
  check.
  """
  import Ecto.Query, warn: false

  alias Castmill.Repo
  alias Castmill.Devices.Device
  alias Castmill.Organizations.Organization
  alias Castmill.OsUpdates.OsRelease
  alias Castmill.SafeHttp

  require Logger

  @policy_modes ~w(manual latest version)
  @override_modes ~w(follow version)
  @states ~w(idle installing installed activating running rolled_back failed unsupported)

  # ---- releases --------------------------------------------------------------

  @doc "Releases, newest first."
  def list_releases(opts \\ []) do
    query =
      from(r in OsRelease,
        order_by: [desc: r.published_at],
        limit: ^Keyword.get(opts, :limit, 50)
      )

    query =
      if Keyword.get(opts, :prereleases, true),
        do: query,
        else: where(query, [r], r.prerelease == false)

    Repo.all(query)
  end

  def get_release(version) when is_binary(version), do: Repo.get_by(OsRelease, version: version)
  def get_release(_), do: nil

  @doc """
  Stores a release from its `manifest.json` (a decoded map). Importing the
  same version again updates it.
  """
  def import_manifest(%{} = manifest) do
    attrs = %{
      version: manifest["version"],
      prerelease: manifest["prerelease"] == true,
      security: manifest["security"] == true,
      published_at: manifest["published_at"],
      notes_url: manifest["notes_url"],
      artifacts: manifest["artifacts"]
    }

    %OsRelease{}
    |> OsRelease.changeset(attrs)
    |> Repo.insert(
      on_conflict:
        {:replace, [:prerelease, :security, :published_at, :notes_url, :artifacts, :updated_at]},
      conflict_target: :version,
      returning: true
    )
  end

  def import_manifest(_), do: {:error, :invalid_manifest}

  @doc """
  Imports the manifests of the latest GitHub releases of `repo`
  (`owner/name`). Returns the versions that are new. `fetch` is
  `SafeHttp.get/2` (replaced in tests).
  """
  def import_from_github(repo \\ github_repo(), fetch \\ &SafeHttp.get/2) do
    url = "https://api.github.com/repos/#{repo}/releases?per_page=20"

    with {:ok, %{body: body}} <- fetch.(url, accept: "application/vnd.github+json"),
         {:ok, releases} when is_list(releases) <- Jason.decode(body) do
      known = MapSet.new(Repo.all(from(r in OsRelease, select: r.version)))

      new =
        releases
        |> Enum.reject(&(&1["draft"] == true))
        |> Enum.flat_map(&manifest_url/1)
        |> Enum.flat_map(fn manifest_url ->
          with {:ok, %{body: body}} <- fetch.(manifest_url, accept: "application/json"),
               {:ok, manifest} <- Jason.decode(body),
               {:ok, release} <- import_manifest(manifest) do
            if MapSet.member?(known, release.version), do: [], else: [release.version]
          else
            error ->
              Logger.warning(
                "OS release manifest #{manifest_url} not imported: #{inspect(error)}"
              )

              []
          end
        end)

      if new != [] do
        Logger.info("Imported Castmill OS releases: #{Enum.join(new, ", ")}")
        push_all_targets()
      end

      {:ok, new}
    else
      {:ok, _not_a_list} -> {:error, :unexpected_response}
      error -> error
    end
  end

  defp manifest_url(%{"assets" => assets}) when is_list(assets) do
    for %{"name" => "manifest.json", "browser_download_url" => url} <- assets, do: url
  end

  defp manifest_url(_), do: []

  defp github_repo do
    Application.get_env(:castmill, __MODULE__, [])[:github_repo] || "castmill/castmill-os"
  end

  # ---- policy and overrides --------------------------------------------------

  @doc "The organization's policy, with defaults."
  def get_policy(%Organization{os_update: policy}), do: normalize_policy(policy)

  def get_policy(organization_id) do
    case Repo.get(Organization, organization_id) do
      nil -> normalize_policy(nil)
      org -> get_policy(org)
    end
  end

  defp normalize_policy(policy) do
    policy = policy || %{}

    %{
      "mode" => if(policy["mode"] in @policy_modes, do: policy["mode"], else: "manual"),
      "version" => policy["version"],
      "prereleases" => policy["prereleases"] == true
    }
  end

  @doc "Sets the organization's policy and sends the new targets to its devices."
  def set_policy(organization_id, %{} = attrs) do
    policy = %{
      "mode" => attrs["mode"],
      "version" => attrs["version"],
      "prereleases" => attrs["prereleases"] == true
    }

    with :ok <- validate_mode(policy["mode"], @policy_modes),
         :ok <- validate_version_choice(policy),
         %Organization{} = org <- Repo.get(Organization, organization_id) || {:error, :not_found},
         {:ok, _org} <- org |> Ecto.Changeset.change(os_update: policy) |> Repo.update() do
      push_organization_targets(organization_id)
      {:ok, normalize_policy(policy)}
    end
  end

  @doc "Sets a device's override and sends it its new target."
  def set_device_override(device_id, %{} = attrs) do
    override = %{
      "mode" => attrs["mode"],
      "version" => attrs["version"],
      "now" => attrs["now"] == true
    }

    with :ok <- validate_mode(override["mode"], @override_modes),
         :ok <- validate_version_choice(override),
         %Device{} = device <- Repo.get(Device, device_id) || {:error, :not_found},
         {:ok, device} <- device |> Ecto.Changeset.change(os_update: override) |> Repo.update() do
      push_target(device)
      broadcast_device(device.id, %{os_update: device.os_update})
      {:ok, device}
    end
  end

  defp validate_mode(mode, modes), do: if(mode in modes, do: :ok, else: {:error, :invalid_mode})

  defp validate_version_choice(%{"mode" => "version", "version" => version}) do
    if get_release(version), do: :ok, else: {:error, :unknown_version}
  end

  defp validate_version_choice(_), do: :ok

  # ---- targets ---------------------------------------------------------------

  @doc """
  The OS version a device should run, as sent on its channel: a map with
  `version`, `url`, `sha256`, `size`, `security`, `activate` and `override`,
  `%{version: nil}` for "no update", or `nil` when the device isn't a Castmill
  OS device (it has never reported a status).
  """
  def target_for(%Device{os_status: %{"compatible" => compatible}} = device)
      when is_binary(compatible) do
    override = device.os_update || %{}

    {release, override?} =
      case override do
        %{"mode" => "version", "version" => version} ->
          {get_release(version), true}

        _ ->
          {policy_release(get_policy(device.organization_id)), false}
      end

    case release && release.artifacts[compatible] do
      %{"url" => url, "sha256" => sha256, "size" => size} ->
        %{
          version: release.version,
          url: url,
          sha256: sha256,
          size: size,
          security: release.security,
          activate: if(override? and override["now"] == true, do: "now", else: "window"),
          override: override?
        }

      _ ->
        %{version: nil}
    end
  end

  def target_for(_device), do: nil

  defp policy_release(%{"mode" => "version", "version" => version}), do: get_release(version)

  defp policy_release(%{"mode" => "latest", "prereleases" => prereleases}),
    do: List.first(list_releases(limit: 1, prereleases: prereleases))

  defp policy_release(_), do: nil

  @doc "Pushes the current target to a connected device (no-op for other devices)."
  def push_target(%Device{} = device) do
    case target_for(device) do
      nil ->
        :ok

      target ->
        Phoenix.PubSub.broadcast(Castmill.PubSub, "devices:#{device.id}", %{
          event: "os_update",
          payload: target
        })
    end
  end

  def push_target(device_id) when is_binary(device_id) do
    case Repo.get(Device, device_id) do
      nil -> :ok
      device -> push_target(device)
    end
  end

  defp push_organization_targets(organization_id) do
    from(d in Device, where: d.organization_id == ^organization_id and not is_nil(d.os_status))
    |> Repo.all()
    |> Enum.each(&push_target/1)
  end

  defp push_all_targets do
    from(d in Device, where: not is_nil(d.os_status))
    |> Repo.all()
    |> Enum.each(&push_target/1)
  end

  # ---- status reports --------------------------------------------------------

  @doc """
  Stores an `os_update:report` from a device. Returns `{:ok, device,
  compatible_changed?}`; when the device's hardware family is new, the caller
  pushes it its target.
  """
  def record_status(device_id, %{} = report) do
    with {:ok, status} <- cast_report(report),
         %Device{} = device <- Repo.get(Device, device_id) || {:error, :not_found} do
      previous = (device.os_status || %{})["compatible"]
      status = Map.put(status, "received_at", DateTime.utc_now() |> DateTime.truncate(:second))

      with {:ok, device} <- device |> Ecto.Changeset.change(os_status: status) |> Repo.update() do
        broadcast_device(device.id, %{os_status: device.os_status})
        {:ok, device, previous != status["compatible"]}
      end
    end
  end

  defp cast_report(report) do
    string = fn key, max ->
      case report[key] do
        nil -> {:ok, nil}
        v when is_binary(v) and byte_size(v) <= max -> {:ok, v}
        _ -> {:error, {:invalid, key}}
      end
    end

    with {:ok, compatible} <- string.("compatible", 100),
         true <- is_binary(compatible) || {:error, {:invalid, "compatible"}},
         {:ok, current} <- string.("current_version", 64),
         {:ok, target} <- string.("target_version", 64),
         {:ok, version} <- string.("version", 64),
         {:ok, last_error} <- string.("last_error", 1024),
         {:ok, updated} <- string.("updated", 64),
         true <- report["state"] in @states || {:error, {:invalid, "state"}},
         progress = report["progress"],
         true <-
           (is_nil(progress) or (is_integer(progress) and progress in 0..100)) ||
             {:error, {:invalid, "progress"}} do
      {:ok,
       %{
         "compatible" => compatible,
         "current_version" => current,
         "target_version" => target,
         "state" => report["state"],
         "version" => version,
         "progress" => progress,
         "last_error" => last_error,
         "updated" => updated
       }
       |> Map.reject(fn {_k, v} -> is_nil(v) end)}
    end
  end

  defp broadcast_device(device_id, message) do
    Phoenix.PubSub.broadcast(Castmill.PubSub, "device_updates:#{device_id}", message)
  end
end
