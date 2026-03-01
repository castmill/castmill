defmodule Castmill.Repo.Migrations.StripProtocolFromNetworkDomains do
  use Ecto.Migration

  def up do
    # Remove http:// or https:// prefix from network domains.
    # Domains are now stored without protocol (e.g., "app.example.com" instead of "https://app.example.com").
    execute """
    UPDATE networks
    SET domain = REGEXP_REPLACE(domain, '^https?://', '')
    WHERE domain ~ '^https?://'
    """
  end

  def down do
    # Re-add https:// prefix to all domains
    execute """
    UPDATE networks
    SET domain = 'https://' || domain
    WHERE domain !~ '^https?://'
    """
  end
end
