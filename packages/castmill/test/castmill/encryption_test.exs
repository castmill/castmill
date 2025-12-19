defmodule Castmill.EncryptionTest do
  use ExUnit.Case, async: true

  alias Castmill.Encryption

  describe "encrypt_for_resource/3" do
    test "encrypts data successfully" do
      data = %{"client_id" => "test-id", "client_secret" => "test-secret"}

      assert {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "network-123")
      assert is_binary(encrypted)
      # Version (1) + IV (12) + Tag (16) + at least some ciphertext
      assert byte_size(encrypted) > 29
    end

    test "produces different ciphertext for same data (random IV)" do
      data = %{"key" => "value"}

      {:ok, encrypted1} = Encryption.encrypt_for_resource(data, :network, "net-1")
      {:ok, encrypted2} = Encryption.encrypt_for_resource(data, :network, "net-1")

      # Same data, same resource, but different ciphertext due to random IV
      assert encrypted1 != encrypted2
    end

    test "produces different keys for different resources" do
      data = %{"key" => "value"}

      {:ok, encrypted_net} = Encryption.encrypt_for_resource(data, :network, "id-1")
      {:ok, encrypted_org} = Encryption.encrypt_for_resource(data, :organization, "id-1")

      # Can't compare keys directly, but verify they both work independently
      assert {:ok, ^data} = Encryption.decrypt(encrypted_net, :network, "id-1")
      assert {:ok, ^data} = Encryption.decrypt(encrypted_org, :organization, "id-1")
    end

    test "version byte is embedded in ciphertext" do
      data = %{"test" => "data"}

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "net-1")

      # First byte should be version 1
      <<version::8, _rest::binary>> = encrypted
      assert version == 1
    end
  end

  describe "decrypt/3" do
    test "decrypts data encrypted with encrypt_for_resource" do
      original = %{
        "client_id" => "abc123",
        "client_secret" => "supersecret",
        "nested" => %{"key" => "value"}
      }

      {:ok, encrypted} = Encryption.encrypt_for_resource(original, :organization, "org-uuid-123")
      {:ok, decrypted} = Encryption.decrypt(encrypted, :organization, "org-uuid-123")

      assert decrypted == original
    end

    test "fails with wrong resource type" do
      data = %{"key" => "value"}

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "id-1")

      # Try to decrypt with wrong resource type
      assert {:error, :decryption_failed} = Encryption.decrypt(encrypted, :organization, "id-1")
    end

    test "fails with wrong resource id" do
      data = %{"key" => "value"}

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "id-1")

      # Try to decrypt with wrong resource id
      assert {:error, :decryption_failed} = Encryption.decrypt(encrypted, :network, "id-2")
    end

    test "fails with corrupted ciphertext" do
      data = %{"key" => "value"}

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "id-1")

      # Corrupt the ciphertext
      corrupted = encrypted <> <<0>>
      assert {:error, :decryption_failed} = Encryption.decrypt(corrupted, :network, "id-1")
    end

    test "fails with invalid format" do
      assert {:error, :invalid_format} = Encryption.decrypt(<<1, 2, 3>>, :network, "id-1")
      assert {:error, :invalid_format} = Encryption.decrypt("not binary enough", :network, "id-1")
    end
  end

  describe "get_version/1" do
    test "extracts version from encrypted data" do
      data = %{"key" => "value"}
      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "id-1")

      assert {:ok, 1} = Encryption.get_version(encrypted)
    end

    test "returns error for invalid data" do
      assert {:error, :invalid_format} = Encryption.get_version(<<>>)
    end
  end

  describe "is_current_version?/1" do
    test "returns true for data encrypted with current version" do
      data = %{"key" => "value"}
      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "id-1")

      assert Encryption.is_current_version?(encrypted)
    end

    test "returns false for invalid data" do
      refute Encryption.is_current_version?(<<>>)
      refute Encryption.is_current_version?("invalid")
    end
  end

  describe "re_encrypt/3" do
    test "returns already_current for data on current version" do
      data = %{"key" => "value"}
      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "id-1")

      assert {:ok, :already_current} = Encryption.re_encrypt(encrypted, :network, "id-1")
    end

    test "returns error for invalid format" do
      # Empty binary is invalid - doesn't have enough bytes for version extraction
      assert {:error, :invalid_format} = Encryption.re_encrypt(<<>>, :network, "id-1")

      # Data with version byte that matches current returns already_current
      # (even if the rest of the data is garbage, because we check version first)
      # This is correct behavior - we only try to decrypt if version differs
      assert {:ok, :already_current} = Encryption.re_encrypt(<<1, 2, 3>>, :network, "id-1")
    end
  end

  describe "get_current_version/0" do
    test "returns current version" do
      assert {:ok, version} = Encryption.get_current_version()
      assert is_integer(version)
      assert version >= 1
    end
  end

  describe "available_versions/0" do
    test "returns list of available versions" do
      assert {:ok, versions} = Encryption.available_versions()
      assert is_list(versions)
      assert 1 in versions
    end
  end

  describe "different resource types" do
    test "works with network resources" do
      data = %{"api_key" => "network-key"}

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "net-uuid")
      {:ok, decrypted} = Encryption.decrypt(encrypted, :network, "net-uuid")

      assert decrypted == data
    end

    test "works with organization resources" do
      data = %{"access_token" => "org-token", "refresh_token" => "refresh"}

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :organization, "org-uuid")
      {:ok, decrypted} = Encryption.decrypt(encrypted, :organization, "org-uuid")

      assert decrypted == data
    end

    test "works with widget resources" do
      data = %{"widget_secret" => "widget-data"}

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :widget, 12345)
      {:ok, decrypted} = Encryption.decrypt(encrypted, :widget, 12345)

      assert decrypted == data
    end

    test "works with integer resource IDs" do
      data = %{"key" => "value"}

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, 42)
      {:ok, decrypted} = Encryption.decrypt(encrypted, :network, 42)

      assert decrypted == data
    end
  end

  describe "complex data structures" do
    test "handles nested maps" do
      data = %{
        "oauth" => %{
          "access_token" => "token123",
          "refresh_token" => "refresh456",
          "metadata" => %{
            "provider" => "spotify",
            "scopes" => ["read", "write"]
          }
        },
        "api_keys" => ["key1", "key2"]
      }

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :organization, "org-1")
      {:ok, decrypted} = Encryption.decrypt(encrypted, :organization, "org-1")

      assert decrypted == data
    end

    test "handles unicode and special characters" do
      data = %{
        "name" => "Tëst Üñíçödé",
        "emoji" => "🔐🎵",
        "special" => "line1\nline2\ttab"
      }

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "net-1")
      {:ok, decrypted} = Encryption.decrypt(encrypted, :network, "net-1")

      assert decrypted == data
    end

    test "handles empty map" do
      data = %{}

      {:ok, encrypted} = Encryption.encrypt_for_resource(data, :network, "net-1")
      {:ok, decrypted} = Encryption.decrypt(encrypted, :network, "net-1")

      assert decrypted == data
    end
  end
end
