defmodule Castmill.Workers.EncryptionRotation do
  @moduledoc """
  BullMQ worker for background re-encryption during key rotation.

  This worker handles the migration of encrypted data from old key versions
  to the current key version. It processes records in batches to avoid
  overwhelming the system.

  ## Usage

  After deploying a new encryption key:

  1. The system will automatically detect records on old key versions
  2. Schedule rotation jobs using:

      Castmill.Workers.EncryptionRotation.schedule_rotation()

  3. Monitor progress in logs or admin dashboard

  ## Job Arguments

    - resource_type: "network" | "organization"
    - batch_size: Number of records to process per job (default: 100)
    - offset: Starting offset for pagination
  """

  require Logger

  alias Castmill.Repo
  alias Castmill.Encryption
  alias Castmill.Widgets.Integrations.WidgetIntegrationCredential
  alias Castmill.Workers.BullMQHelper
  import Ecto.Query

  @default_batch_size 100
  @queue "maintenance"

  @doc """
  Processes the encryption rotation job.
  This is called by BullMQ worker.
  """
  def process(%BullMQ.Job{data: args}) do
    resource_type = String.to_existing_atom(args["resource_type"] || "organization")
    batch_size = args["batch_size"] || @default_batch_size
    offset = args["offset"] || 0

    case resource_type do
      :organization -> rotate_organization_credentials(batch_size, offset)
      :network -> rotate_network_credentials(batch_size, offset)
      _ -> {:error, "Unknown resource type: #{resource_type}"}
    end
  end

  @doc """
  Schedules rotation jobs for all resource types.
  """
  def schedule_rotation(batch_size \\ @default_batch_size) do
    # Schedule organization credential rotation
    BullMQHelper.add_job(
      @queue,
      "encryption_rotation",
      %{resource_type: "organization", batch_size: batch_size, offset: 0},
      priority: 3,
      attempts: 3
    )

    # Network credentials will be scheduled when that table exists
    # BullMQHelper.add_job(
    #   @queue,
    #   "encryption_rotation",
    #   %{resource_type: "network", batch_size: batch_size, offset: 0},
    #   priority: 3, attempts: 3
    # )

    :ok
  end

  @doc """
  Returns statistics about encryption key versions in use.
  """
  def rotation_stats do
    {:ok, current_version} = Encryption.get_current_version()

    org_credentials =
      from(c in WidgetIntegrationCredential,
        where: not is_nil(c.organization_id),
        select: c.encrypted_credentials
      )
      |> Repo.all()
      |> Enum.reduce(%{current: 0, old: 0, total: 0}, fn encrypted, acc ->
        case Encryption.get_version(encrypted) do
          {:ok, ^current_version} ->
            %{acc | current: acc.current + 1, total: acc.total + 1}

          {:ok, _old_version} ->
            %{acc | old: acc.old + 1, total: acc.total + 1}

          _ ->
            %{acc | total: acc.total + 1}
        end
      end)

    %{
      current_version: current_version,
      organization_credentials: org_credentials,
      needs_rotation: org_credentials.old > 0
    }
  end

  # Private functions

  defp rotate_organization_credentials(batch_size, offset) do
    {:ok, current_version} = Encryption.get_current_version()

    credentials =
      from(c in WidgetIntegrationCredential,
        where: not is_nil(c.organization_id),
        order_by: c.id,
        limit: ^batch_size,
        offset: ^offset,
        preload: [:organization]
      )
      |> Repo.all()

    if Enum.empty?(credentials) do
      Logger.info("Encryption rotation complete for organization credentials")
      :ok
    else
      {rotated, skipped, errors} =
        Enum.reduce(credentials, {0, 0, 0}, fn cred, {r, s, e} ->
          case rotate_credential(cred, current_version) do
            :rotated -> {r + 1, s, e}
            :skipped -> {r, s + 1, e}
            :error -> {r, s, e + 1}
          end
        end)

      Logger.info(
        "Encryption rotation batch: rotated=#{rotated}, skipped=#{skipped}, errors=#{errors}"
      )

      # Schedule next batch if we processed a full batch
      if length(credentials) == batch_size do
        BullMQHelper.add_job(
          @queue,
          "encryption_rotation",
          %{resource_type: "organization", batch_size: batch_size, offset: offset + batch_size},
          priority: 3,
          attempts: 3
        )
      end

      :ok
    end
  end

  defp rotate_network_credentials(_batch_size, _offset) do
    # Network credentials table doesn't exist yet
    # This will be implemented when we add network_integration_credentials
    Logger.info("Network credential rotation not yet implemented")
    :ok
  end

  defp rotate_credential(credential, current_version) do
    case Encryption.get_version(credential.encrypted_credentials) do
      {:ok, ^current_version} ->
        :skipped

      {:ok, old_version} ->
        Logger.debug(
          "Rotating credential #{credential.id} from v#{old_version} to v#{current_version}"
        )

        organization_id = credential.organization_id

        case Encryption.re_encrypt(
               credential.encrypted_credentials,
               :organization,
               organization_id
             ) do
          {:ok, :already_current} ->
            :skipped

          {:ok, new_encrypted} ->
            case Repo.update(
                   WidgetIntegrationCredential.changeset(credential, %{
                     encrypted_credentials: new_encrypted
                   })
                 ) do
              {:ok, _} ->
                :rotated

              {:error, reason} ->
                Logger.error("Failed to update credential #{credential.id}: #{inspect(reason)}")
                :error
            end

          {:error, reason} ->
            Logger.error("Failed to re-encrypt credential #{credential.id}: #{inspect(reason)}")
            :error
        end

      {:error, _} ->
        Logger.warning("Invalid encrypted data in credential #{credential.id}")
        :error
    end
  end
end
