defmodule CastmillWeb.ChallengeStoreTest do
  use Castmill.DataCase, async: false

  alias CastmillWeb.ChallengeStore

  describe "put/1 + consume/1" do
    test "a stored challenge can be consumed exactly once" do
      challenge = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

      :ok = ChallengeStore.put(challenge)
      assert ChallengeStore.consume(challenge) == true
      assert ChallengeStore.consume(challenge) == false
    end

    test "consuming a never-stored challenge returns false" do
      assert ChallengeStore.consume("never_stored_challenge") == false
    end

    test "multiple different challenges are independent" do
      c1 = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
      c2 = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

      :ok = ChallengeStore.put(c1)
      :ok = ChallengeStore.put(c2)

      assert ChallengeStore.consume(c1) == true
      # c2 is still available
      assert ChallengeStore.consume(c2) == true
      # Both are now consumed
      assert ChallengeStore.consume(c1) == false
      assert ChallengeStore.consume(c2) == false
    end
  end

  describe "expiry" do
    test "an expired challenge cannot be consumed" do
      challenge = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

      # Insert directly with an already-expired timestamp
      expired = DateTime.add(DateTime.utc_now(), -1, :second)

      Castmill.Repo.insert_all(
        "webauthn_challenges",
        [%{challenge: challenge, expires_at: expired}]
      )

      assert ChallengeStore.consume(challenge) == false
    end

    test "sweep deletes only expired challenges" do
      expired = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
      valid = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

      Castmill.Repo.insert_all("webauthn_challenges", [
        %{challenge: expired, expires_at: DateTime.add(DateTime.utc_now(), -1, :second)}
      ])

      :ok = ChallengeStore.put(valid)

      assert ChallengeStore.sweep() >= 1
      assert ChallengeStore.consume(valid) == true
      assert ChallengeStore.consume(expired) == false
    end

    test "the periodic sweep is off in tests" do
      assert Application.get_env(:castmill, ChallengeStore)[:sweep] == false
    end
  end
end
