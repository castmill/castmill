defmodule Castmill.Workers.BullMQCallbacksTest do
  use ExUnit.Case, async: true

  import ExUnit.CaptureLog

  alias Castmill.Workers.BullMQCallbacks

  defp job(attempts_made, attempts \\ 4) do
    %{
      BullMQ.Job.new("feed_media", "download", %{}, attempts: attempts)
      | id: "7",
        attempts_made: attempts_made
    }
  end

  test "on_failed has the arity BullMQ validates and applies" do
    assert is_function(BullMQCallbacks.on_failed(:feed_media), 2)

    log =
      capture_log(fn ->
        apply(BullMQCallbacks.on_failed(:email), [job(3), {:error, :smtp}])
      end)

    assert log =~ "[error]"
    assert log =~ "failed queue=email job=download id=7 attempts=4: {:error, :smtp}"

    log = capture_log(fn -> apply(BullMQCallbacks.on_failed(:email), [%{}, "boom"]) end)
    assert log =~ "job=? id=? attempts=?: boom"
  end

  test "the processor passes results through and logs retried attempts" do
    processor = BullMQCallbacks.processor(:feed_media, fn job -> job.data[:result] end)

    log =
      capture_log(fn ->
        assert processor.(%{job(0) | data: %{result: {:error, :timeout}}}) == {:error, :timeout}
      end)

    assert log =~ "[warning]"
    assert log =~ "retrying queue=feed_media job=download id=7 attempt=1: :timeout"

    # The last attempt is reported by on_failed instead.
    assert capture_log(fn ->
             assert processor.(%{job(3) | data: %{result: {:error, :timeout}}}) ==
                      {:error, :timeout}
           end) == ""

    assert capture_log(fn -> assert processor.(%{job(0) | data: %{result: :ok}}) == :ok end) ==
             ""
  end

  test "the processor logs and re-raises exceptions" do
    processor = BullMQCallbacks.processor(:email, fn _job -> raise "smtp down" end)

    log =
      capture_log(fn ->
        assert_raise RuntimeError, "smtp down", fn -> processor.(job(1)) end
      end)

    assert log =~ "attempt=2: smtp down"
    assert capture_log(fn -> catch_error(processor.(%{})) end) == ""
  end
end
