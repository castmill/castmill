defmodule Castmill.Widgets.Integrations.OAuth.GenericTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.Integrations.OAuth.Generic

  @valid_credential_schema %{
    "auth_type" => "oauth2",
    "oauth2" => %{
      "authorization_url" => "https://provider.example.com/authorize",
      "token_url" => "https://provider.example.com/token",
      "scopes" => ["read", "write"],
      "client_auth" => "basic",
      "pkce" => false
    },
    "fields" => %{
      "client_id" => %{"type" => "string", "required" => true},
      "client_secret" => %{"type" => "string", "required" => true, "secret" => true}
    }
  }

  @valid_context %{
    integration_id: "test-integration-123",
    widget_config_id: nil,
    organization_id: "org-456"
  }

  describe "get_oauth_config/1" do
    test "extracts valid OAuth configuration from credential_schema" do
      assert {:ok, config} = Generic.get_oauth_config(@valid_credential_schema)
      assert config.authorization_url == "https://provider.example.com/authorize"
      assert config.token_url == "https://provider.example.com/token"
      assert config.scopes == ["read", "write"]
      assert config.client_auth == "basic"
      assert config.pkce == false
    end

    test "supports oauth2_client_credentials auth_type" do
      schema = %{
        "auth_type" => "oauth2_client_credentials",
        "oauth2" => %{
          "authorization_url" => "https://example.com/auth",
          "token_url" => "https://example.com/token",
          "scopes" => ["api"]
        }
      }

      assert {:ok, config} = Generic.get_oauth_config(schema)
      assert config.token_url == "https://example.com/token"
    end

    test "returns error for missing oauth2 configuration" do
      schema = %{"auth_type" => "api_key"}
      assert {:error, :missing_oauth_config} = Generic.get_oauth_config(schema)
    end

    test "returns error for missing authorization_url" do
      schema = %{
        "auth_type" => "oauth2",
        "oauth2" => %{
          "token_url" => "https://example.com/token"
        }
      }

      assert {:error, :missing_oauth_config} = Generic.get_oauth_config(schema)
    end

    test "returns error for missing token_url" do
      schema = %{
        "auth_type" => "oauth2",
        "oauth2" => %{
          "authorization_url" => "https://example.com/auth"
        }
      }

      assert {:error, :missing_oauth_config} = Generic.get_oauth_config(schema)
    end

    test "returns error for nil input" do
      assert {:error, :missing_oauth_config} = Generic.get_oauth_config(nil)
    end

    test "uses default values for optional configuration" do
      schema = %{
        "auth_type" => "oauth2",
        "oauth2" => %{
          "authorization_url" => "https://example.com/auth",
          "token_url" => "https://example.com/token"
        }
      }

      assert {:ok, config} = Generic.get_oauth_config(schema)
      assert config.scopes == []
      assert config.client_auth == "basic"
      assert config.pkce == false
      assert config.token_placement == "header"
      assert config.refresh_margin_seconds == 300
    end
  end

  describe "authorization_url/4" do
    setup do
      {:ok, config} = Generic.get_oauth_config(@valid_credential_schema)
      %{oauth_config: config}
    end

    test "generates a valid authorization URL", %{oauth_config: config} do
      {:ok, url, state} =
        Generic.authorization_url(
          config,
          "client123",
          "https://callback.example.com/callback",
          @valid_context
        )

      assert String.starts_with?(url, "https://provider.example.com/authorize?")
      assert String.contains?(url, "client_id=client123")
      assert String.contains?(url, "response_type=code")
      assert String.contains?(url, "scope=read+write")
      assert String.contains?(url, "state=")
      assert is_binary(state)
      assert byte_size(state) > 0
    end

    test "includes redirect_uri in URL", %{oauth_config: config} do
      redirect = "https://myapp.com/oauth/callback"

      {:ok, url, _state} =
        Generic.authorization_url(config, "client123", redirect, @valid_context)

      assert String.contains?(url, URI.encode_www_form(redirect))
    end

    test "generates unique states for each call", %{oauth_config: config} do
      # Use different contexts to ensure uniqueness
      context1 = Map.put(@valid_context, :organization_id, "org-1")
      context2 = Map.put(@valid_context, :organization_id, "org-2")

      {:ok, _url1, state1} =
        Generic.authorization_url(config, "client123", "https://x.com/cb", context1)

      {:ok, _url2, state2} =
        Generic.authorization_url(config, "client123", "https://x.com/cb", context2)

      assert state1 != state2
    end
  end

  describe "validate_state/1" do
    test "validates a freshly generated state" do
      {:ok, config} = Generic.get_oauth_config(@valid_credential_schema)

      {:ok, _url, state} =
        Generic.authorization_url(config, "client123", "https://x.com/cb", @valid_context)

      assert {:ok, context} = Generic.validate_state(state)
      assert context.integration_id == "test-integration-123"
      assert context.organization_id == "org-456"
      assert context.widget_config_id == nil
    end

    test "includes widget_config_id when present in context" do
      {:ok, config} = Generic.get_oauth_config(@valid_credential_schema)

      context_with_widget = %{
        integration_id: "int-123",
        widget_config_id: "widget-789",
        organization_id: "org-456"
      }

      {:ok, _url, state} =
        Generic.authorization_url(config, "client123", "https://x.com/cb", context_with_widget)

      assert {:ok, decoded_context} = Generic.validate_state(state)
      assert decoded_context.widget_config_id == "widget-789"
    end

    test "returns error for invalid base64" do
      assert {:error, :invalid_state} = Generic.validate_state("not-valid-base64!!!")
    end

    test "returns error for invalid JSON" do
      invalid = Base.url_encode64("not-json", padding: false)
      assert {:error, :invalid_state} = Generic.validate_state(invalid)
    end

    test "returns error for missing required fields" do
      incomplete = Base.url_encode64(Jason.encode!(%{"foo" => "bar"}), padding: false)
      assert {:error, :invalid_state} = Generic.validate_state(incomplete)
    end

    test "returns error for tampered signature" do
      {:ok, config} = Generic.get_oauth_config(@valid_credential_schema)

      {:ok, _url, state} =
        Generic.authorization_url(config, "client123", "https://x.com/cb", @valid_context)

      # Decode, tamper, re-encode
      {:ok, decoded} = Base.url_decode64(state, padding: false)
      {:ok, data} = Jason.decode(decoded)
      tampered = Map.put(data, "signature", "tampered-sig")
      tampered_state = Base.url_encode64(Jason.encode!(tampered), padding: false)

      assert {:error, :invalid_state} = Generic.validate_state(tampered_state)
    end

    test "returns error for expired state" do
      # Create a state with an old timestamp by generating a valid one and manipulating it
      # We need to match exactly what compute_signature does internally
      secret = Application.get_env(:castmill, CastmillWeb.Endpoint)[:secret_key_base]
      old_timestamp = System.system_time(:second) - 700

      # When nil is interpolated in Elixir, it becomes empty string
      data = "int-123::org-456:#{old_timestamp}"

      signature =
        :crypto.mac(:hmac, :sha256, secret, data)
        |> Base.encode64()

      json_data =
        Jason.encode!(%{
          "integration_id" => "int-123",
          "widget_config_id" => nil,
          "organization_id" => "org-456",
          "timestamp" => old_timestamp,
          "signature" => signature
        })

      expired_state = Base.url_encode64(json_data, padding: false)

      assert {:error, :state_expired} = Generic.validate_state(expired_state)
    end
  end

  describe "token_expired?/2" do
    test "returns true for expired token" do
      past = System.system_time(:second) - 100
      assert Generic.token_expired?(past) == true
    end

    test "returns true for token expiring soon (within margin)" do
      almost_expired = System.system_time(:second) + 200
      assert Generic.token_expired?(almost_expired, 300) == true
    end

    test "returns false for valid token" do
      future = System.system_time(:second) + 3600
      assert Generic.token_expired?(future) == false
    end

    test "uses default margin of 300 seconds" do
      exactly_at_margin = System.system_time(:second) + 299
      assert Generic.token_expired?(exactly_at_margin) == true

      beyond_margin = System.system_time(:second) + 301
      assert Generic.token_expired?(beyond_margin) == false
    end

    test "returns true for nil expires_at" do
      assert Generic.token_expired?(nil) == true
    end
  end

  describe "build_credentials/3" do
    test "builds a complete credentials map" do
      tokens = %{
        access_token: "access-123",
        refresh_token: "refresh-456",
        expires_at: 1_234_567_890,
        token_type: "Bearer",
        scope: "read write"
      }

      result = Generic.build_credentials(tokens, "client-id", "client-secret")

      assert result["client_id"] == "client-id"
      assert result["client_secret"] == "client-secret"
      assert result["access_token"] == "access-123"
      assert result["refresh_token"] == "refresh-456"
      assert result["expires_at"] == 1_234_567_890
      assert result["token_type"] == "Bearer"
      assert result["scope"] == "read write"
    end

    test "uses defaults for missing optional token fields" do
      tokens = %{
        access_token: "access-123",
        refresh_token: nil,
        expires_at: 1_234_567_890
      }

      result = Generic.build_credentials(tokens, "cid", "csec")

      assert result["token_type"] == "Bearer"
      assert result["scope"] == ""
    end
  end
end
