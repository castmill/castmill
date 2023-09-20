defmodule CastmillWeb.CalendarController do
  use CastmillWeb, :controller

  action_fallback(CastmillWeb.FallbackController)

  def index(_conn, %{"calendar_id" => _calendar_id}) do
  end

  def create(
        %Plug.Conn{body_params: _body_params} = _conn,
        %{"calendar_id" => _calendar_id} = _params
      ) do
  end

  def delete(
        _conn,
        %{
          "calendar_id" => _calendar_id,
          "id" => _file_id,
          "organization_id" => _organization_id
        }
      ) do
  end
end
