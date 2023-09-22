# Used by "mix format" and to export configuration.
export_locals_without_parens = [
  plug: 1,
  plug: 2,
  forward: 2,
  forward: 3,
  forward: 4,
  match: 2,
  match: 3,
  get: 2,
  get: 3,
  head: 2,
  head: 3,
  post: 2,
  post: 3,
  put: 2,
  put: 3,
  patch: 2,
  patch: 3,
  delete: 2,
  delete: 3,
  options: 2,
  options: 3,
  field: 2,
  field: 3,
  field: 4,
  field: 5,
  pipe_through: 1,
  live: 2,
  live: 3
]

[
  import_deps: [:ecto, :ecto_sql, :phoenix],
  subdirectories: ["priv/*/migrations"],
  plugins: [Phoenix.LiveView.HTMLFormatter],
  inputs: ["*.{heex,ex,exs}", "{config,lib,test}/**/*.{heex,ex,exs}", "priv/*/seeds.exs"]
]
