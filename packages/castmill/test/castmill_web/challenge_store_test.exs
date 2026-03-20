defmodule CastmillWeb.ChallengeStoreTest do
  use ExUnit.Case, async: false

  alias CastmillWeb.ChallengeStore

  # The GenServer is started by the application supervision tree.
  # In tests, ensure the ETS table exists (it should, since Application starts it).

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
      expires_at = System.monotonic_time(:millisecond) - 1
      :ets.insert(CastmillWeb.ChallengeStore, {challenge, expires_at})

      assert ChallengeStore.consume(challenge) == false
    end
  end
end
