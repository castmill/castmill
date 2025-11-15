defmodule CastmillWeb.Telemetry do
  use Supervisor
  import Telemetry.Metrics

  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @impl true
  def init(_arg) do
    children = [
      # Telemetry poller will execute the given period measurements
      # every 10_000ms. Learn more here: https://hexdocs.pm/telemetry_metrics
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000}
      # Add reporters as children of your supervision tree.
      # {Telemetry.Metrics.ConsoleReporter, metrics: metrics()}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  def metrics do
    [
      # Phoenix Metrics
      summary("phoenix.endpoint.start.system_time",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.endpoint.stop.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.start.system_time",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.exception.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.stop.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.socket_connected.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.channel_join.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.channel_handled_in.duration",
        tags: [:event],
        unit: {:native, :millisecond}
      ),

      # Database Metrics
      summary("castmill.repo.query.total_time",
        unit: {:native, :millisecond},
        description: "The sum of the other measurements"
      ),
      summary("castmill.repo.query.decode_time",
        unit: {:native, :millisecond},
        description: "The time spent decoding the data received from the database"
      ),
      summary("castmill.repo.query.query_time",
        unit: {:native, :millisecond},
        description: "The time spent executing the query"
      ),
      summary("castmill.repo.query.queue_time",
        unit: {:native, :millisecond},
        description: "The time spent waiting for a database connection"
      ),
      summary("castmill.repo.query.idle_time",
        unit: {:native, :millisecond},
        description:
          "The time the connection spent waiting before being checked out for the query"
      ),

      # RC Session Metrics
      counter("castmill.rc_session.created.count",
        description: "Total number of RC sessions created"
      ),
      counter("castmill.rc_session.closed.count",
        description: "Total number of RC sessions closed"
      ),
      summary("castmill.rc_session.closed.duration",
        unit: {:native, :millisecond},
        description: "Duration of RC sessions from start to close"
      ),
      counter("castmill.rc_session.timeout.count",
        description: "Total number of RC sessions that timed out",
        tags: [:state]
      ),
      counter("castmill.rc_session.state_transition.count",
        description: "RC session state transitions",
        tags: [:from_state, :to_state]
      ),
      counter("castmill.rc_session.control_event.count",
        description: "Total number of control events sent"
      ),
      summary("castmill.rc_session.control_event.latency",
        unit: {:native, :microsecond},
        description: "Latency of control event processing"
      ),
      counter("castmill.rc_session.media_frame.count",
        description: "Total number of media frames received"
      ),
      summary("castmill.rc_session.media_frame.size",
        unit: :byte,
        description: "Size of media frames"
      ),
      last_value("castmill.rc_session.media_frame.fps",
        description: "Frames per second for media streams"
      ),
      counter("castmill.rc_session.frames_dropped.count",
        description: "Total number of frames dropped"
      ),
      counter("castmill.rc_session.relay_failed.count",
        description: "Total number of relay start failures"
      ),
      counter("castmill.rc_session.queue_full.count",
        description: "Total number of control queue full events"
      ),
      last_value("castmill.rc_session.active_sessions.count",
        description: "Current number of active RC sessions"
      ),

      # VM Metrics
      summary("vm.memory.total", unit: {:byte, :kilobyte}),
      summary("vm.total_run_queue_lengths.total"),
      summary("vm.total_run_queue_lengths.cpu"),
      summary("vm.total_run_queue_lengths.io")
    ]
  end

  defp periodic_measurements do
    [
      # A module, function and arguments to be invoked periodically.
      # This function must call :telemetry.execute/3 and a metric must be added above.
      # {CastmillWeb, :count_users, []}
    ]
  end
end
