defmodule Castmill.OrganizationDeletionLockingTest do
  @moduledoc """
  A feed media download that stores its object while the organization is
  being deleted must not leave that object behind. Runs outside the SQL
  sandbox so the sessions see each other's data; it deletes what it creates.
  """
  use ExUnit.Case, async: false

  import Ecto.Query
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.{Organizations, Repo}
  alias Castmill.Feeds.{Feed, FeedMedia}
  alias Ecto.Adapters.SQL.Sandbox

  setup do
    :ok = Sandbox.checkout(Repo, sandbox: false)
    Castmill.PublicStorage.Fake.install()

    network = network_fixture()

    organization =
      organization_fixture(%{
        network: network,
        name: "Deleting #{System.unique_integer([:positive])}"
      })

    feed =
      %Feed{}
      |> Feed.create_changeset(organization.id, %{name: "Posts"})
      |> Repo.insert!()

    url = "https://example.com/photo.jpg"

    media =
      Repo.insert!(%FeedMedia{
        feed_id: feed.id,
        organization_id: organization.id,
        original_url: url,
        url_hash: FeedMedia.hash_url(url),
        status: "pending"
      })

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)

      Repo.delete_all(
        from(c in Castmill.StorageCleanups.StorageCleanup,
          where: fragment("?->>'key' LIKE ?", c.data, ^"feeds/#{feed.id}/%")
        )
      )

      Repo.delete_all(
        from(o in Castmill.Organizations.Organization, where: o.id == ^organization.id)
      )

      # The network's default plan refers to it.
      Repo.update_all(from(n in Castmill.Networks.Network, where: n.id == ^network.id),
        set: [default_plan_id: nil]
      )

      Repo.delete_all(from(p in Castmill.Quotas.Plan, where: p.network_id == ^network.id))
      Repo.delete_all(from(n in Castmill.Networks.Network, where: n.id == ^network.id))
    end)

    %{organization: organization, feed: feed, media: media}
  end

  defp await_lock_waiters(count, attempts \\ 100) do
    %{rows: [[waiting]]} = Repo.query!("SELECT count(*) FROM pg_locks WHERE NOT granted")

    cond do
      waiting >= count -> :ok
      attempts == 0 -> flunk("Expected #{count} sessions waiting for a lock, got #{waiting}")
      true -> Process.sleep(20) && await_lock_waiters(count, attempts - 1)
    end
  end

  test "a download finishing during the deletion has its object deleted", %{
    organization: organization,
    feed: feed,
    media: media
  } do
    test_pid = self()
    key = "feeds/#{feed.id}/late.jpg"

    # A download finishing: it holds the feed's lock, as `Feeds.Media` does
    # when it records a stored object.
    download =
      Task.async(fn ->
        :ok = Sandbox.checkout(Repo, sandbox: false)

        Repo.transaction(fn ->
          Repo.one!(from(f in Feed, where: f.id == ^feed.id, lock: "FOR UPDATE"))
          send(test_pid, :feed_locked)
          receive do: (:finish -> :ok)

          media
          |> Ecto.Changeset.change(storage_key: key, status: "ready")
          |> Repo.update!()
        end)
      end)

    assert_receive :feed_locked

    deletion =
      Task.async(fn ->
        :ok = Sandbox.checkout(Repo, sandbox: false)
        result = Organizations.delete_organization(organization)
        # Cleanups run inline in tests, in this process.
        deleted? = receive do: ({:feed_media_deleted, ^key} -> true), after: (0 -> false)
        {result, deleted?}
      end)

    # The deletion waits for the download to record its object.
    await_lock_waiters(1)
    send(download.pid, :finish)
    assert {:ok, _} = Task.await(download)

    assert {{:ok, _}, true} = Task.await(deletion, 10_000)
    refute Repo.get(FeedMedia, media.id)
  end

  test "a feed created while the organization is locked is locked first, without deadlock",
       %{organization: organization} do
    test_pid = self()

    # Another session holds the organization so the deletion waits after
    # locking the existing feeds.
    {:ok, holder} =
      Repo.config()
      |> Keyword.take([:hostname, :port, :username, :password, :database])
      |> Postgrex.start_link()

    Postgrex.query!(holder, "BEGIN", [])

    Postgrex.query!(holder, "SELECT id FROM organizations WHERE id = $1 FOR SHARE", [
      Ecto.UUID.dump!(organization.id)
    ])

    deletion =
      Task.async(fn ->
        :ok = Sandbox.checkout(Repo, sandbox: false)
        Organizations.delete_organization(organization)
      end)

    await_lock_waiters(1)

    # A feed is created meanwhile, and a writer locks it and then references
    # the organization (as appending entries does).
    writer =
      Task.async(fn ->
        :ok = Sandbox.checkout(Repo, sandbox: false)

        feed =
          %Feed{}
          |> Feed.create_changeset(organization.id, %{name: "New feed"})
          |> Repo.insert!()

        Repo.transaction(fn ->
          Repo.one!(from(f in Feed, where: f.id == ^feed.id, lock: "FOR UPDATE"))
          send(test_pid, :new_feed_locked)
          receive do: (:finish -> :ok)
          url = "https://example.com/new.jpg"

          Repo.insert!(%FeedMedia{
            feed_id: feed.id,
            organization_id: organization.id,
            original_url: url,
            url_hash: FeedMedia.hash_url(url),
            status: "pending"
          })
        end)
      end)

    assert_receive :new_feed_locked, 5_000
    Postgrex.query!(holder, "COMMIT", [])

    # The deletion starts again and waits for the new feed's writer.
    await_lock_waiters(1)
    send(writer.pid, :finish)

    assert {:ok, _} = Task.await(writer, 10_000)
    assert {:ok, _} = Task.await(deletion, 10_000)
    refute Organizations.get_organization(organization.id)
  end
end
