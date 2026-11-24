defmodule Castmill.OsUpdatesTest do
  use Castmill.DataCase, async: true

  alias Castmill.OsUpdates

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  @x86 "castmill-os-genericx86-64"
  @sha String.duplicate("a", 64)

  defp manifest(version, opts \\ []) do
    %{
      "version" => version,
      "prerelease" => Keyword.get(opts, :prerelease, false),
      "security" => Keyword.get(opts, :security, false),
      "published_at" => Keyword.get(opts, :published_at, "2026-12-01T10:00:00Z"),
      "notes_url" => "https://github.com/castmill/castmill-os/releases/tag/v#{version}",
      "artifacts" => %{
        @x86 => %{
          "url" =>
            "https://github.com/castmill/castmill-os/releases/download/v#{version}/x86.raucb",
          "sha256" => @sha,
          "size" => 1000
        }
      }
    }
  end

  defp device(org) do
    {:ok, registration} = device_registration_fixture()

    {:ok, {device, _token}} =
      Castmill.Devices.register_device(org.id, registration.pincode, %{name: "Lobby"})

    device
  end

  defp castmill_os_device(org) do
    d = device(org)

    {:ok, d, true} =
      OsUpdates.record_status(d.id, %{
        "compatible" => @x86,
        "state" => "idle",
        "current_version" => "0.2.0"
      })

    d
  end

  setup do
    %{org: organization_fixture(%{network_id: network_fixture().id})}
  end

  describe "releases" do
    test "imports a manifest and updates it on re-import" do
      assert {:ok, release} = OsUpdates.import_manifest(manifest("0.3.0"))
      assert release.artifacts[@x86]["size"] == 1000
      assert {:ok, again} = OsUpdates.import_manifest(manifest("0.3.0", security: true))
      assert again.id == release.id and again.security
      assert [%{version: "0.3.0"}] = OsUpdates.list_releases()
    end

    test "rejects invalid manifests" do
      bad = [
        Map.put(manifest("0.3.0"), "version", "latest"),
        Map.put(manifest("0.3.0"), "artifacts", %{}),
        put_in(manifest("0.3.0"), ["artifacts", @x86, "url"], "http://insecure/b.raucb"),
        put_in(manifest("0.3.0"), ["artifacts", @x86, "sha256"], "nope"),
        Map.put(manifest("0.3.0"), "artifacts", %{
          "other-os" => manifest("0.3.0")["artifacts"][@x86]
        }),
        "not a map"
      ]

      for m <- bad, do: assert({:error, _} = OsUpdates.import_manifest(m))
      assert OsUpdates.list_releases() == []
    end

    test "imports manifests of GitHub releases, skipping drafts and bad files" do
      releases = [
        %{
          "draft" => false,
          "assets" => [%{"name" => "manifest.json", "browser_download_url" => "https://gh/m-030"}]
        },
        %{
          "draft" => true,
          "assets" => [
            %{"name" => "manifest.json", "browser_download_url" => "https://gh/m-draft"}
          ]
        },
        %{
          "draft" => false,
          "assets" => [%{"name" => "manifest.json", "browser_download_url" => "https://gh/m-bad"}]
        },
        %{
          "draft" => false,
          "assets" => [%{"name" => "notes.txt", "browser_download_url" => "https://gh/x"}]
        }
      ]

      fetch = fn
        "https://api.github.com/repos/castmill/castmill-os/releases?per_page=20", _ ->
          {:ok, %{body: Jason.encode!(releases)}}

        "https://gh/m-030", _ ->
          {:ok, %{body: Jason.encode!(manifest("0.3.0"))}}

        "https://gh/m-bad", _ ->
          {:ok, %{body: "{not json"}}

        url, _ ->
          flunk("unexpected fetch #{url}")
      end

      assert {:ok, ["0.3.0"]} = OsUpdates.import_from_github("castmill/castmill-os", fetch)
      # Already known: nothing new.
      assert {:ok, []} = OsUpdates.import_from_github("castmill/castmill-os", fetch)
    end

    test "a GitHub pre-release stays a pre-release, and corrected releases reach devices", %{
      org: org
    } do
      device = castmill_os_device(org)
      {:ok, _} = OsUpdates.set_policy(org.id, %{"mode" => "latest", "prereleases" => true})
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      releases = [
        %{
          "draft" => false,
          "prerelease" => true,
          "assets" => [%{"name" => "manifest.json", "browser_download_url" => "https://gh/m"}]
        }
      ]

      serve = fn manifest ->
        fn
          "https://api.github.com/" <> _, _ -> {:ok, %{body: Jason.encode!(releases)}}
          "https://gh/m", _ -> {:ok, %{body: Jason.encode!(manifest)}}
        end
      end

      # The manifest says stable (no pre-release version), GitHub says pre-release.
      assert {:ok, ["0.3.0"]} = OsUpdates.import_from_github("o/r", serve.(manifest("0.3.0")))
      assert OsUpdates.get_release("0.3.0").prerelease
      assert_receive %{event: "os_update", payload: %{version: "0.3.0", url: url}}
      assert url =~ "x86.raucb"

      # Re-import unchanged: no new targets.
      assert {:ok, []} = OsUpdates.import_from_github("o/r", serve.(manifest("0.3.0")))
      refute_receive %{event: "os_update"}

      # A corrected bundle URL for the same version: devices get it.
      fixed =
        put_in(manifest("0.3.0"), ["artifacts", @x86, "url"], "https://github.com/fixed.raucb")

      assert {:ok, []} = OsUpdates.import_from_github("o/r", serve.(fixed))
      assert_receive %{event: "os_update", payload: %{url: "https://github.com/fixed.raucb"}}

      # Organizations that exclude pre-releases don't get it.
      {:ok, _} = OsUpdates.set_policy(org.id, %{"mode" => "latest"})
      assert OsUpdates.target_for(Repo.reload(device)) == %{version: nil}
    end
  end

  describe "targets" do
    setup %{org: org} do
      {:ok, _} =
        OsUpdates.import_manifest(manifest("0.3.0", published_at: "2026-12-01T10:00:00Z"))

      {:ok, _} =
        OsUpdates.import_manifest(
          manifest("0.4.0-rc.1", prerelease: true, published_at: "2026-12-10T10:00:00Z")
        )

      %{device: castmill_os_device(org)}
    end

    test "manual by default: no update", %{device: device} do
      assert OsUpdates.get_policy(device.organization_id)["mode"] == "manual"
      assert OsUpdates.target_for(Repo.reload(device)) == %{version: nil}
    end

    test "only Castmill OS devices get a target", %{org: org} do
      assert OsUpdates.target_for(device(org)) == nil
    end

    test "latest skips pre-releases unless the organization opts in", %{org: org, device: device} do
      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

      assert {:ok, _} = OsUpdates.set_policy(org.id, %{"mode" => "latest"})

      assert_receive %{
        event: "os_update",
        payload: %{version: "0.3.0", activate: "window", override: false}
      }

      assert {:ok, _} = OsUpdates.set_policy(org.id, %{"mode" => "latest", "prereleases" => true})
      assert_receive %{event: "os_update", payload: %{version: "0.4.0-rc.1"}}
    end

    test "a pinned organization version and a device override", %{org: org, device: device} do
      assert {:ok, _} = OsUpdates.set_policy(org.id, %{"mode" => "version", "version" => "0.3.0"})

      assert %{version: "0.3.0", url: url, sha256: @sha, size: 1000} =
               OsUpdates.target_for(Repo.reload(device))

      assert url =~ "v0.3.0"

      assert {:ok, _} =
               OsUpdates.set_device_override(device.id, %{
                 "mode" => "version",
                 "version" => "0.4.0-rc.1",
                 "now" => true
               })

      assert %{version: "0.4.0-rc.1", activate: "now", override: true} =
               OsUpdates.target_for(Repo.reload(device))

      assert {:ok, _} = OsUpdates.set_device_override(device.id, %{"mode" => "follow"})
      assert %{version: "0.3.0", override: false} = OsUpdates.target_for(Repo.reload(device))
    end

    test "no target for a hardware family without a bundle", %{org: org, device: device} do
      {:ok, _} = OsUpdates.set_policy(org.id, %{"mode" => "latest"})

      {:ok, device, true} =
        OsUpdates.record_status(device.id, %{
          "compatible" => "castmill-os-raspberrypi5",
          "state" => "idle"
        })

      assert OsUpdates.target_for(device) == %{version: nil}
    end

    test "a policy change looks up each release once for the whole organization", %{
      org: org,
      device: device
    } do
      others = for _ <- 1..4, do: castmill_os_device(org)

      {:ok, _} =
        OsUpdates.set_device_override(hd(others).id, %{"mode" => "version", "version" => "0.3.0"})

      for d <- [device | others], do: Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{d.id}")

      test_pid = self()
      handler = "os-release-queries-#{inspect(test_pid)}"

      :ok =
        :telemetry.attach(
          handler,
          [:castmill, :repo, :query],
          fn _event, _measurements, %{source: source}, _ ->
            if self() == test_pid and source == "os_releases", do: send(test_pid, :release_query)
          end,
          nil
        )

      on_exit(fn -> :telemetry.detach(handler) end)

      assert {:ok, _} = OsUpdates.set_policy(org.id, %{"mode" => "latest"})
      :telemetry.detach(handler)

      for _ <- 1..5, do: assert_receive(%{event: "os_update", payload: %{version: "0.3.0"}})

      # One query for the latest release, one for the override's version.
      queries = Stream.repeatedly(fn -> receive do: (:release_query -> 1), after: (0 -> nil) end)
      assert queries |> Enum.take_while(& &1) |> length() == 2
    end

    test "rejects unknown modes and versions", %{org: org, device: device} do
      assert {:error, :invalid_mode} = OsUpdates.set_policy(org.id, %{"mode" => "yolo"})

      assert {:error, :unknown_version} =
               OsUpdates.set_policy(org.id, %{"mode" => "version", "version" => "9.9.9"})

      assert {:error, :invalid_mode} =
               OsUpdates.set_device_override(device.id, %{"mode" => "latest"})
    end
  end

  describe "status reports" do
    test "stores valid reports and tells when the hardware family changed", %{org: org} do
      d = device(org)
      Phoenix.PubSub.subscribe(Castmill.PubSub, "device_updates:#{d.id}")

      report = %{
        "compatible" => @x86,
        "state" => "installing",
        "progress" => 40,
        "version" => "0.3.0"
      }

      assert {:ok, device, true} = OsUpdates.record_status(d.id, report)
      assert device.os_status["progress"] == 40
      assert_receive %{os_status: %{"state" => "installing"}}
      assert {:ok, _device, false} = OsUpdates.record_status(d.id, report)
    end

    test "rejects invalid reports", %{org: org} do
      d = device(org)

      for bad <- [
            %{"state" => "idle"},
            %{"compatible" => @x86, "state" => "exploded"},
            %{"compatible" => @x86, "state" => "installing", "progress" => 140},
            %{"compatible" => String.duplicate("x", 200), "state" => "idle"}
          ] do
        assert {:error, _} = OsUpdates.record_status(d.id, bad)
      end
    end
  end
end
