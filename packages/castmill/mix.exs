defmodule Castmill.MixProject do
  use Mix.Project

  def project do
    [
      app: :castmill,
      version: "2.0.0",
      elixir: "~> 1.14",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {Castmill.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:argon2_elixir, "~> 3.1.0"},
      {:cors_plug, "~> 3.0"},
      {:ecto_sql, "~> 3.6"},
      {:esbuild, "~> 0.7", runtime: Mix.env() == :dev},
      {:ex_aws, "~> 2.1"},
      {:ex_aws_s3, "~> 2.0"},
      {:ffmpex, "~> 0.11.0"},
      {:file_type, "~> 0.1.0"},
      {:finch, "~> 0.13"},
      {:floki, ">= 0.30.0", only: :test},
      {:gettext, "~> 0.20"},
      {:hackney, "~> 1.9"},
      {:httpoison, "~> 2.0"},
      {:image, "~> 0.37"},
      {:jason, "~> 1.2"},
      {:mox, "~> 1.0", only: [:test]},
      {:multipart, "~> 0.4.0"},
      {:oban, "~> 2.17"},
      {:phoenix, "~> 1.7.2"},
      {:phoenix_ecto, "~> 4.4"},
      {:plug_cowboy, "~> 2.5"},
      {:postgrex, ">= 0.0.0"},
      {:phoenix_html, "~> 3.3"},
      {:phoenix_live_reload, "~> 1.2", only: :dev},
      {:phoenix_live_view, "~> 0.18.16"},
      {:phoenix_live_dashboard, "~> 0.7.2"},
      {:swoosh, "~> 1.3"},
      {:tailwind, "~> 0.2.0", runtime: Mix.env() == :dev},
      {:telemetry_metrics, "~> 0.6"},
      {:telemetry_poller, "~> 1.0"},
      {:tarams, "~> 1.8.0"},
      {:tzdata, "~> 1.1"},
      {:uuid, "~> 1.1"},
      {:wax_, "~> 0.6.0"}
    ]
  end

  # Aliases are shortcuts or tasks specific to the current project.
  # For example, to install project dependencies and perform other setup tasks, run:
  #
  #     $ mix setup
  #
  # See the documentation for `Mix` for more info on aliases.
  defp aliases do
    [
      setup: ["deps.get", "ecto.setup", "assets.setup", "assets.build"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"],
      "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
      "assets.build": ["tailwind default", "esbuild default"],
      "assets.deploy": ["tailwind default --minify", "esbuild default --minify", "phx.digest"]
    ]
  end
end
