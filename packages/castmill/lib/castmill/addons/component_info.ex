defmodule Castmill.Addons.ComponentInfo do
  @derive {Jason.Encoder,
           only: [
             :id,
             :name,
             :name_key,
             :description,
             :version,
             :icon,
             :path,
             :mount_point,
             :mount_path,
             :keyboard_shortcut,
             :translations_path
           ]}
  defstruct id: nil,
            name: nil,
            name_key: nil,
            description: nil,
            version: nil,
            icon: nil,
            path: nil,
            mount_point: nil,
            mount_path: nil,
            keyboard_shortcut: nil,
            translations_path: nil
end
