defmodule CastmillWeb.ChannelController do
  use CastmillWeb, :controller

  action_fallback(CastmillWeb.FallbackController)

  def index(_conn, %{"channel_id" => _channel_id}) do
  end

  def create(
        %Plug.Conn{body_params: _body_params} = _conn,
        %{"channel_id" => _channel_id} = _params
      ) do
  end

  def delete(
        _conn,
        %{
          "channel_id" => _channel_id,
          "id" => _file_id,
          "organization_id" => _organization_id
        }
      ) do
  end
end
