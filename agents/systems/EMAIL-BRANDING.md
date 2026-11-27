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

## Design: `Castmill.EmailLayout`

Every email uses `Castmill.EmailLayout.render(brand, subject:, blocks:, preheader:, reason:)`,
which returns `{html_body, text_body}` from the same content:

- the brand's logo (or its name), a card with the content, and a footer with
  the support contact, the optional `reason` and the copyright;
- light and dark mode (`prefers-color-scheme`, with the light design where a
  client doesn't support it);
- blocks: `{:heading, text}`, `{:text, inline}`, `{:button, label, url}`,
  `{:link, url}` (fallback for the button), `{:code, text}`,
  `{:steps, [{title, inline}]}` and `{:note, inline}`. `inline` is a string or
  a list of strings, `{:strong, text}` and `{:link, label, url}`.

The layout escapes everything, so pass plain values. Don't write HTML
templates for emails.

The brand carries what the layout shows:

| Field | Network brand | Castmill brand |
| --- | --- | --- |
| `logo_url`, `logo_dark_url` | `logo_light` and `logo` (light and dark backgrounds), as in the dashboard | `/images/email/castmill-logo-{light,dark}.png` on the backend |
| `logo_backdrop` | `:dark` when only `logo` is set, `:light` when only `logo_light` is: the logo is shown on a backdrop of that colour in both modes | `nil` |
| `dashboard_url` | `https://` + the network domain | `nil` |
| `accent` | `nil`: a neutral dark button that suits any logo | Castmill blue |

Only http(s) logo URLs are used. Castmill's logo URLs are built from the
endpoint's configured host (`CASTMILL_HOST`), so they work in background jobs.
`EmailBrand.dashboard_url/1` adds `https://` to a domain without a scheme; use
it for links built from a network domain.

## Rules for new emails

1. Find the network the email belongs to (the organization's, team's,
   invitation's or user's network) and build the brand with
   `EmailBrand.for_network/1`.
2. Render the email with `Castmill.EmailLayout.render/2`.
3. Set the sender with `EmailBrand.put_sender/2` instead of reading
   `:mailer_from` directly.
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
- `Castmill.EmailRenderer`: organization and team invitations.
- `Castmill.Addons.Onboarding`: the welcome email (the `:user_signup` hook
  payload carries `network_id`), with getting-started steps and a link to the
  network's dashboard.

A per-network sender domain (`From: noreply@customer.com`) needs a verified
sending identity per network and is not implemented yet.
