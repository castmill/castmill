defmodule Castmill.Addons.ComponentInfo do
  @derive {Jason.Encoder,
           only: [:name, :name_key, :description, :version, :icon, :path, :mount_point, :mount_path]}
  defstruct name: nil,
            name_key: nil,
            description: nil,
            version: nil,
            icon: nil,
            path: nil,
            mount_point: nil,
            mount_path: nil
end
