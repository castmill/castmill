# Email Branding (White-Label Emails)

Emails that belong to a network must look like they come from that network.
White-label customers do not accept emails that show Castmill, so **never
hardcode "Castmill" in an email that is sent for a network**.

## `Castmill.EmailBrand`

`packages/castmill/lib/castmill/email_brand.ex` builds the brand of an email:

| Field | Network brand | Castmill brand (no network) |
| --- | --- | --- |
| `name` | Network name | `Castmill™` |
| `sender_name` | Network name | `nil` (configured name, `Castmill`) |
| `reply_to`, `support_email` | Network email, if valid | `nil`, `support@castmill.com` |
| `support_url` | `nil` | `https://castmill.com/support` |
| `copyright` | Network copyright; `© year Name` if it still names Castmill | `© year Castmill AB. All rights reserved.` |

- `EmailBrand.for_network/1` takes a `%Network{}`, a network id or `nil`.
- `EmailBrand.for_origin/1` resolves the network from a dashboard origin, for
  flows that only know the domain (for example credential recovery).
- `EmailBrand.put_sender/2` sets `From` to `{brand.sender_name, MAILER_FROM
  address}` and `Reply-To` to the network email. Only the sender name changes,
  so no extra DNS setup is needed.
- `EmailBrand.html_escape/1` escapes the brand for HTML templates, because
  network names and emails are user input.

## Rules for new emails

1. Find the network the email belongs to (the organization's, team's,
   invitation's or user's network) and build the brand with
   `EmailBrand.for_network/1`.
2. Set the sender with `EmailBrand.put_sender/2` instead of reading
   `:mailer_from` directly.
3. Render `@brand` in templates (name, support contact, copyright). Use
   `EmailBrand.html_escape/1` for HTML bodies. Show the "do not reply" line only
   when the brand has no `reply_to`.
4. Send through `Castmill.EmailDelivery.deliver/2`. The queue serializes only
   known fields (including `reply_to`); add new fields to both
   `serialize_email/1` and `deserialize_email/1`.
5. Test that a network email contains the network's name and no "Castmill".

Add-ons (also in castmill-saas) follow the same rules. Legacy account emails
that only the root user receives (password reset, email change) stay
Castmill-branded.

## Where branding is applied

- `Castmill.Accounts.UserNotifier`: sign-up, already registered, network
  invitation, network admin setup and credential recovery.
- `Castmill.EmailRenderer` with `templates/email/base_layout.html.eex`:
  organization and team invitations.
- `Castmill.Addons.Onboarding`: the welcome email (the `:user_signup` hook
  payload carries `network_id`).

A per-network sender domain (`From: noreply@customer.com`) needs a verified
sending identity per network and is not implemented yet.
