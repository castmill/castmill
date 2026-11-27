defmodule Castmill.EmailLayout do
  @moduledoc """
  The design of every email: the brand's logo, a card with the content and a
  footer with the brand's support contact and copyright, in light and dark
  mode. The same content renders the HTML and the plain-text body, so both
  always say the same.

      {html, text} =
        EmailLayout.render(brand,
          subject: "Join Acme",
          preheader: "You have been invited to Acme.",
          blocks: [
            {:heading, "Join Acme"},
            {:text, ["You have been invited to ", {:strong, "Acme"}, "."]},
            {:button, "Accept invitation", url},
            {:link, url},
            {:note, "If you weren't expecting this, you can ignore it."}
          ]
        )

  Blocks:

    * `{:heading, text}`
    * `{:text, inline}`: a paragraph
    * `{:button, label, url}`: the email's main action
    * `{:link, url}`: the action's URL, for when the button doesn't work
    * `{:code, text}`: a code to copy, such as an invitation token
    * `{:steps, [{title, inline}]}`: a numbered list
    * `{:note, inline}`: small print below a rule, such as a security notice

  `inline` is a string or a list of strings, `{:strong, text}` and
  `{:link, label, url}`. All text is escaped here, so pass plain values.

  Options: `:subject` (required), `:blocks` (required), `:preheader` (the
  preview shown by mail clients) and `:reason` (why the recipient gets the
  email, shown in the footer).
  """

  alias Castmill.EmailBrand

  @font "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  @mono "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

  # Light and dark palettes. Dark mode applies where clients support
  # prefers-color-scheme (Apple Mail, iOS, Outlook for Mac, Thunderbird);
  # others show the light design.
  @light %{
    page: "#f3f4f6",
    card: "#ffffff",
    border: "#e5e7eb",
    text: "#111827",
    body: "#374151",
    muted: "#6b7280",
    subtle: "#f3f4f6",
    neutral_button: "#111827",
    neutral_button_text: "#ffffff"
  }

  @dark %{
    page: "#0b0e14",
    card: "#151a23",
    border: "#262d3a",
    text: "#f3f4f6",
    body: "#d1d5db",
    muted: "#9ca3af",
    subtle: "#1e2430",
    neutral_button: "#f3f4f6",
    neutral_button_text: "#111827",
    link: "#7aa7ff"
  }

  @logo_height 34

  @doc "Renders an email. Returns `{html_body, text_body}`."
  @spec render(EmailBrand.t(), keyword()) :: {String.t(), String.t()}
  def render(%EmailBrand{} = brand, opts) do
    subject = Keyword.fetch!(opts, :subject)
    blocks = Keyword.fetch!(opts, :blocks)
    preheader = Keyword.get(opts, :preheader, "")
    reason = Keyword.get(opts, :reason)

    {html(brand, subject, preheader, blocks, reason), text(brand, blocks, reason)}
  end

  # --- HTML ---

  defp html(brand, subject, preheader, blocks, reason) do
    accent = brand.accent || @light.neutral_button
    accent_text = if brand.accent, do: "#ffffff", else: @light.neutral_button_text
    dark_accent = if brand.accent, do: brand.accent, else: @dark.neutral_button
    dark_accent_text = if brand.accent, do: "#ffffff", else: @dark.neutral_button_text
    link = brand.accent || @light.text

    colors = %{accent: accent, accent_text: accent_text, link: link}

    """
    <!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>#{esc(subject)}</title>
    <!--[if mso]><style>body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
    <style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
      table { border-collapse: collapse; }
      img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
      a { color: #{link}; }
      .cm-dark-only { display: none; }
      @media (prefers-color-scheme: dark) {
        #{dark_css(dark_accent, dark_accent_text, brand.accent)}
      }
      [data-ogsc] .cm-page, [data-ogsb] .cm-page { background-color: #{@dark.page} !important; }
      [data-ogsc] .cm-card, [data-ogsb] .cm-card { background-color: #{@dark.card} !important; }
      @media only screen and (max-width: 620px) {
        .cm-card-pad { padding: 28px 22px !important; }
        .cm-shell { padding: 24px 12px !important; }
        .cm-heading { font-size: 22px !important; }
      }
    </style>
    </head>
    <body class="cm-page" style="margin: 0; padding: 0; background-color: #{@light.page};">
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #{@light.page}; opacity: 0;">#{esc(preheader)}#{String.duplicate("&#8199;&#65279;&#847; ", 40)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="cm-page" bgcolor="#{@light.page}" style="background-color: #{@light.page};">
    <tr><td align="center" class="cm-shell" style="padding: 40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px;">
    <tr><td style="padding: 0 4px 24px 4px;">#{logo(brand)}</td></tr>
    <tr><td class="cm-card cm-card-pad" bgcolor="#{@light.card}" style="background-color: #{@light.card}; border: 1px solid #{@light.border}; border-radius: 14px; padding: 40px 40px 36px 40px;">
    #{Enum.map_join(blocks, "\n", &block(&1, colors))}
    </td></tr>
    <tr><td style="padding: 24px 8px 0 8px;">#{footer(brand, reason)}</td></tr>
    </table>
    </td></tr>
    </table>
    </body>
    </html>
    """
  end

  defp dark_css(accent, accent_text, branded_accent) do
    link = if branded_accent, do: @dark.link, else: @dark.text

    """
    .cm-page { background-color: #{@dark.page} !important; }
        .cm-card { background-color: #{@dark.card} !important; border-color: #{@dark.border} !important; }
        .cm-text { color: #{@dark.text} !important; }
        .cm-body { color: #{@dark.body} !important; }
        .cm-muted { color: #{@dark.muted} !important; }
        .cm-rule { border-color: #{@dark.border} !important; }
        .cm-subtle { background-color: #{@dark.subtle} !important; border-color: #{@dark.border} !important; }
        .cm-link { color: #{link} !important; }
        .cm-button { background-color: #{accent} !important; }
        .cm-button a { color: #{accent_text} !important; }
        .cm-light-only { display: none !important; }
        .cm-dark-only { display: block !important; }
    """
  end

  defp logo(%EmailBrand{logo_url: nil} = brand) do
    ~s(<span class="cm-text" style="font-family: #{@font}; font-size: 20px; font-weight: 700; letter-spacing: -0.2px; color: #{@light.text};">#{esc(brand.name)}</span>)
  end

  # A logo made for dark backgrounds, shown on a dark backdrop in both modes.
  defp logo(%EmailBrand{logo_on_dark: true} = brand) do
    ~s(<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#151925" style="background-color: #151925; border-radius: 10px; padding: 10px 14px;">#{logo_img(brand.logo_url, brand.name, "")}</td></tr></table>)
  end

  defp logo(%EmailBrand{logo_url: url, logo_dark_url: url} = brand) do
    logo_img(url, brand.name, "")
  end

  defp logo(brand) do
    logo_img(brand.logo_url, brand.name, "cm-light-only") <>
      ~s(<!--[if !mso]><!--><div class="cm-dark-only" style="display: none; mso-hide: all;">) <>
      logo_img(brand.logo_dark_url, brand.name, "") <>
      "</div><!--<![endif]-->"
  end

  defp logo_img(url, name, class) do
    ~s(<img src="#{esc(url)}" alt="#{esc(name)}" height="#{@logo_height}" class="#{class}" style="display: block; height: #{@logo_height}px; width: auto; max-width: 220px; border: 0;">)
  end

  defp block({:heading, text}, _colors) do
    ~s(<h1 class="cm-text cm-heading" style="margin: 0 0 16px 0; font-family: #{@font}; font-size: 24px; line-height: 1.3; font-weight: 700; letter-spacing: -0.3px; color: #{@light.text};">#{esc(text)}</h1>)
  end

  defp block({:text, inline}, colors) do
    ~s(<p class="cm-body" style="margin: 0 0 16px 0; font-family: #{@font}; font-size: 16px; line-height: 1.6; color: #{@light.body};">#{inline_html(inline, colors)}</p>)
  end

  defp block({:button, label, url}, colors) do
    """
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
    <tr><td class="cm-button" bgcolor="#{colors.accent}" style="background-color: #{colors.accent}; border-radius: 8px;">
    <a href="#{esc(url)}" target="_blank" style="display: inline-block; padding: 13px 24px; font-family: #{@font}; font-size: 15px; font-weight: 600; line-height: 1.2; color: #{colors.accent_text}; text-decoration: none; border-radius: 8px;">#{esc(label)}</a>
    </td></tr>
    </table>
    """
  end

  defp block({:link, url}, _colors) do
    ~s(<p class="cm-muted" style="margin: 0 0 16px 0; font-family: #{@font}; font-size: 13px; line-height: 1.6; color: #{@light.muted};">If the button doesn't work, copy this link into your browser:<br><a href="#{esc(url)}" target="_blank" class="cm-link" style="color: #{@light.muted}; word-break: break-all;">#{esc(url)}</a></p>)
  end

  defp block({:code, code}, _colors) do
    ~s(<p class="cm-subtle cm-text" style="margin: 0 0 16px 0; padding: 12px 16px; border: 1px solid #{@light.border}; border-radius: 8px; background-color: #{@light.subtle}; font-family: #{@mono}; font-size: 15px; line-height: 1.5; color: #{@light.text}; word-break: break-all;">#{esc(code)}</p>)
  end

  defp block({:steps, steps}, colors) do
    rows =
      steps
      |> Enum.with_index(1)
      |> Enum.map_join("\n", fn {{title, description}, number} ->
        """
        <tr>
        <td valign="top" style="padding: 0 14px 18px 0; width: 28px;">
        <div class="cm-subtle cm-text" style="width: 28px; height: 28px; line-height: 28px; border-radius: 14px; background-color: #{@light.subtle}; text-align: center; font-family: #{@font}; font-size: 14px; font-weight: 700; color: #{@light.text};">#{number}</div>
        </td>
        <td valign="top" style="padding: 3px 0 18px 0;">
        <p class="cm-text" style="margin: 0 0 2px 0; font-family: #{@font}; font-size: 15px; line-height: 1.5; font-weight: 600; color: #{@light.text};">#{esc(title)}</p>
        <p class="cm-body" style="margin: 0; font-family: #{@font}; font-size: 15px; line-height: 1.55; color: #{@light.body};">#{inline_html(description, colors)}</p>
        </td>
        </tr>
        """
      end)

    ~s(<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 8px 0;">#{rows}</table>)
  end

  defp block({:note, inline}, colors) do
    ~s(<p class="cm-muted cm-rule" style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #{@light.border}; font-family: #{@font}; font-size: 13px; line-height: 1.6; color: #{@light.muted};">#{inline_html(inline, colors)}</p>)
  end

  defp footer(brand, reason) do
    support =
      cond do
        brand.reply_to ->
          ~s(Questions? Reply to this email or write to <a href="mailto:#{esc(brand.reply_to)}" class="cm-link" style="color: #{@light.muted};">#{esc(brand.reply_to)}</a>.)

        brand.support_email ->
          ~s(Questions? Contact <a href="mailto:#{esc(brand.support_email)}" class="cm-link" style="color: #{@light.muted};">#{esc(brand.support_email)}</a>.)

        true ->
          nil
      end

    [esc(brand.name), support, reason && esc(reason), esc(brand.copyright)]
    |> Enum.reject(&is_nil/1)
    |> Enum.map_join("\n", fn line ->
      ~s(<p class="cm-muted" style="margin: 0 0 6px 0; font-family: #{@font}; font-size: 12px; line-height: 1.6; color: #{@light.muted}; text-align: center;">#{line}</p>)
    end)
  end

  defp inline_html(parts, colors) when is_list(parts),
    do: Enum.map_join(parts, &inline_html(&1, colors))

  defp inline_html({:strong, text}, _colors),
    do:
      ~s(<strong class="cm-text" style="font-weight: 600; color: #{@light.text};">#{esc(text)}</strong>)

  defp inline_html({:link, label, url}, colors),
    do:
      ~s(<a href="#{esc(url)}" target="_blank" class="cm-link" style="color: #{colors.link};">#{esc(label)}</a>)

  defp inline_html(text, _colors), do: esc(text)

  defp esc(nil), do: ""
  defp esc(value), do: value |> to_string() |> Plug.HTML.html_escape()

  # --- Plain text ---

  defp text(brand, blocks, reason) do
    body =
      blocks
      |> Enum.map(&block_text/1)
      |> Enum.reject(&is_nil/1)
      |> Enum.join("\n\n")

    support =
      cond do
        brand.reply_to -> "Questions? Reply to this email or write to #{brand.reply_to}."
        brand.support_email -> "Questions? Contact #{brand.support_email}."
        true -> nil
      end

    footer =
      [brand.name, support, reason, brand.copyright]
      |> Enum.reject(&is_nil/1)
      |> Enum.join("\n")

    body <> "\n\n--\n" <> footer <> "\n"
  end

  defp block_text({:heading, text}), do: text
  defp block_text({:text, inline}), do: inline_text(inline)
  defp block_text({:button, label, url}), do: "#{label}:\n#{url}"
  # The button already shows the URL in text.
  defp block_text({:link, _url}), do: nil
  defp block_text({:code, code}), do: "    " <> code
  defp block_text({:note, inline}), do: inline_text(inline)

  defp block_text({:steps, steps}) do
    steps
    |> Enum.with_index(1)
    |> Enum.map_join("\n", fn {{title, description}, number} ->
      "#{number}. #{title}: #{inline_text(description)}"
    end)
  end

  defp inline_text(parts) when is_list(parts), do: Enum.map_join(parts, &inline_text/1)
  defp inline_text({:strong, text}), do: text
  defp inline_text({:link, label, url}), do: "#{label} (#{url})"
  defp inline_text(text), do: to_string(text)
end
