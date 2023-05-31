defmodule CastmillWeb.Layouts do
  use CastmillWeb, :html
  import CastmillWeb.Live.Admin.Topbar

  embed_templates "layouts/*"
end
