defmodule Castmill.CryptoTest do
  use ExUnit.Case, async: true

  alias Castmill.Crypto

  describe "encrypt/2 and decrypt/2" do
    test "encrypts and decrypts data successfully" do
      key = Crypto.generate_key()
      data = %{"api_key" => "secret123", "username" => "test_user"}

      encrypted = Crypto.encrypt(data, key)
      assert is_binary(encrypted)

      {:ok, decrypted} = Crypto.decrypt(encrypted, key)
      assert decrypted == data
    end

    test "encrypts complex nested data" do
      key = Crypto.generate_key()

      data = %{
        "credentials" => %{
          "api_key" => "secret123",
          "api_secret" => "supersecret"
        },
        "config" => %{
          "endpoint" => "https://api.example.com",
          "timeout" => 5000
        }
      }

      encrypted = Crypto.encrypt(data, key)
      {:ok, decrypted} = Crypto.decrypt(encrypted, key)
      assert decrypted == data
    end

    test "fails to decrypt with wrong key" do
      key1 = Crypto.generate_key()
      key2 = Crypto.generate_key()
      data = %{"secret" => "value"}

      encrypted = Crypto.encrypt(data, key1)
      assert {:error, :decryption_failed} = Crypto.decrypt(encrypted, key2)
    end

    test "fails to decrypt corrupted data" do
      key = Crypto.generate_key()
      data = %{"secret" => "value"}

      encrypted = Crypto.encrypt(data, key)

      # Corrupt the ciphertext
      <<prefix::binary-20, _rest::binary>> = encrypted
      corrupted = prefix <> "corrupted"

      assert {:error, _} = Crypto.decrypt(corrupted, key)
    end

    test "requires 32-byte key for encryption" do
      short_key = :crypto.strong_rand_bytes(16)
      data = %{"test" => "data"}

      assert_raise ArgumentError, fn ->
        Crypto.encrypt(data, short_key)
      end
    end

    test "requires 32-byte key for decryption" do
      encrypted = :crypto.strong_rand_bytes(50)
      short_key = :crypto.strong_rand_bytes(16)

      assert {:error, :invalid_key_size} = Crypto.decrypt(encrypted, short_key)
    end
  end

  describe "generate_key/0" do
    test "generates 32-byte key" do
      key = Crypto.generate_key()
      assert byte_size(key) == 32
    end

    test "generates unique keys" do
      key1 = Crypto.generate_key()
      key2 = Crypto.generate_key()
      assert key1 != key2
    end
  end

  describe "encode_key/1 and decode_key/1" do
    test "encodes and decodes key successfully" do
      key = Crypto.generate_key()
      encoded = Crypto.encode_key(key)

      assert is_binary(encoded)
      assert String.match?(encoded, ~r/^[A-Za-z0-9+\/=]+$/)

      {:ok, decoded} = Crypto.decode_key(encoded)
      assert decoded == key
    end

    test "fails to decode invalid base64" do
      assert {:error, :invalid_encoding} = Crypto.decode_key("not valid base64!@#$")
    end

    test "fails to decode wrong-sized key" do
      # Encode a 16-byte key
      short_key = :crypto.strong_rand_bytes(16)
      encoded = Base.encode64(short_key)

      assert {:error, :invalid_key_size} = Crypto.decode_key(encoded)
    end
  end
end
