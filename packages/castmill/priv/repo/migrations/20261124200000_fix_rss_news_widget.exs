defmodule Castmill.Repo.Migrations.FixRssNewsWidget do
  @moduledoc """
  Makes the system RSS News widget usable.

  Its options_schema was a JSON Schema (`{"type": "object", "properties":
  {...}}`) instead of Castmill's flat widget schema, so the dashboard's widget
  form saw two options called "type" and "properties", failed to render, and
  the playlist editor stopped adding widgets. It also had no feed URL option
  and no integration, so it could never fetch a feed.

  This converts the options to the flat schema (`number` with `min`/`max`,
  labels in the translations), adds the required `feed_url` option and
  registers the "rss" pull integration (on-demand refresh, discriminated by
  feed URL, as `Castmill.Widgets.Integrations.Fetchers.Rss` expects).
  """
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo

  @slug "rss-news"

  # Display order of the options.
  @order ~w(feed_url max_items page_duration card_layout show_image image_width
            fallback_image show_source bg_color title_color description_color
            source_color transition_type transition_duration transition_easing
            show_ticker ticker_label ticker_speed ticker_separator ticker_bg_color
            ticker_text_color ticker_label_bg_color ticker_label_color)

  @feed_url %{
    "type" => "url",
    "required" => true,
    "placeholder" => "https://example.com/feed.xml",
    "description" => "Address of the RSS, Atom or JSON feed, or of a website that links to one"
  }

  # Option labels: locale => key => label.
  @labels %{
    "en" => %{
      "feed_url" => "Feed URL",
      "max_items" => "News per page",
      "page_duration" => "Page duration (seconds)",
      "card_layout" => "Card layout",
      "show_image" => "Show image",
      "image_width" => "Image width",
      "fallback_image" => "Fallback image",
      "show_source" => "Show source",
      "bg_color" => "Background color",
      "title_color" => "Title color",
      "description_color" => "Description color",
      "source_color" => "Source color",
      "transition_type" => "Page transition",
      "transition_duration" => "Transition duration (seconds)",
      "transition_easing" => "Transition easing",
      "show_ticker" => "Show ticker",
      "ticker_label" => "Ticker label",
      "ticker_speed" => "Ticker speed",
      "ticker_separator" => "Ticker separator",
      "ticker_bg_color" => "Ticker background color",
      "ticker_text_color" => "Ticker text color",
      "ticker_label_bg_color" => "Ticker label background color",
      "ticker_label_color" => "Ticker label color"
    },
    "es" => %{
      "feed_url" => "URL del feed",
      "max_items" => "Noticias por página",
      "page_duration" => "Duración de página (segundos)",
      "card_layout" => "Diseño de tarjeta",
      "show_image" => "Mostrar imagen",
      "image_width" => "Ancho de imagen",
      "fallback_image" => "Imagen alternativa",
      "show_source" => "Mostrar fuente",
      "bg_color" => "Color de fondo",
      "title_color" => "Color del título",
      "description_color" => "Color de la descripción",
      "source_color" => "Color de la fuente",
      "transition_type" => "Transición de página",
      "transition_duration" => "Duración de la transición (segundos)",
      "transition_easing" => "Aceleración de la transición",
      "show_ticker" => "Mostrar cinta",
      "ticker_label" => "Etiqueta de la cinta",
      "ticker_speed" => "Velocidad de la cinta",
      "ticker_separator" => "Separador de la cinta",
      "ticker_bg_color" => "Color de fondo de la cinta",
      "ticker_text_color" => "Color del texto de la cinta",
      "ticker_label_bg_color" => "Color de fondo de la etiqueta",
      "ticker_label_color" => "Color de la etiqueta"
    },
    "sv" => %{
      "feed_url" => "Flödets URL",
      "max_items" => "Nyheter per sida",
      "page_duration" => "Sidans visningstid (sekunder)",
      "card_layout" => "Kortlayout",
      "show_image" => "Visa bild",
      "image_width" => "Bildbredd",
      "fallback_image" => "Reservbild",
      "show_source" => "Visa källa",
      "bg_color" => "Bakgrundsfärg",
      "title_color" => "Rubrikfärg",
      "description_color" => "Beskrivningsfärg",
      "source_color" => "Källfärg",
      "transition_type" => "Sidövergång",
      "transition_duration" => "Övergångens längd (sekunder)",
      "transition_easing" => "Övergångens acceleration",
      "show_ticker" => "Visa nyhetslist",
      "ticker_label" => "Nyhetslistens etikett",
      "ticker_speed" => "Nyhetslistens hastighet",
      "ticker_separator" => "Nyhetslistens avskiljare",
      "ticker_bg_color" => "Nyhetslistens bakgrundsfärg",
      "ticker_text_color" => "Nyhetslistens textfärg",
      "ticker_label_bg_color" => "Etikettens bakgrundsfärg",
      "ticker_label_color" => "Etikettens färg"
    },
    "de" => %{
      "feed_url" => "Feed-URL",
      "max_items" => "Nachrichten pro Seite",
      "page_duration" => "Seitendauer (Sekunden)",
      "card_layout" => "Kartenlayout",
      "show_image" => "Bild anzeigen",
      "image_width" => "Bildbreite",
      "fallback_image" => "Ersatzbild",
      "show_source" => "Quelle anzeigen",
      "bg_color" => "Hintergrundfarbe",
      "title_color" => "Titelfarbe",
      "description_color" => "Beschreibungsfarbe",
      "source_color" => "Quellenfarbe",
      "transition_type" => "Seitenübergang",
      "transition_duration" => "Übergangsdauer (Sekunden)",
      "transition_easing" => "Übergangsbeschleunigung",
      "show_ticker" => "Laufband anzeigen",
      "ticker_label" => "Laufband-Beschriftung",
      "ticker_speed" => "Laufband-Geschwindigkeit",
      "ticker_separator" => "Laufband-Trennzeichen",
      "ticker_bg_color" => "Laufband-Hintergrundfarbe",
      "ticker_text_color" => "Laufband-Textfarbe",
      "ticker_label_bg_color" => "Hintergrundfarbe der Beschriftung",
      "ticker_label_color" => "Farbe der Beschriftung"
    },
    "fr" => %{
      "feed_url" => "URL du flux",
      "max_items" => "Actualités par page",
      "page_duration" => "Durée de la page (secondes)",
      "card_layout" => "Disposition des cartes",
      "show_image" => "Afficher l'image",
      "image_width" => "Largeur de l'image",
      "fallback_image" => "Image de remplacement",
      "show_source" => "Afficher la source",
      "bg_color" => "Couleur de fond",
      "title_color" => "Couleur du titre",
      "description_color" => "Couleur de la description",
      "source_color" => "Couleur de la source",
      "transition_type" => "Transition de page",
      "transition_duration" => "Durée de la transition (secondes)",
      "transition_easing" => "Accélération de la transition",
      "show_ticker" => "Afficher le bandeau",
      "ticker_label" => "Libellé du bandeau",
      "ticker_speed" => "Vitesse du bandeau",
      "ticker_separator" => "Séparateur du bandeau",
      "ticker_bg_color" => "Couleur de fond du bandeau",
      "ticker_text_color" => "Couleur du texte du bandeau",
      "ticker_label_bg_color" => "Couleur de fond du libellé",
      "ticker_label_color" => "Couleur du libellé"
    },
    "zh" => %{
      "feed_url" => "订阅源网址",
      "max_items" => "每页新闻数",
      "page_duration" => "每页时长（秒）",
      "card_layout" => "卡片布局",
      "show_image" => "显示图片",
      "image_width" => "图片宽度",
      "fallback_image" => "备用图片",
      "show_source" => "显示来源",
      "bg_color" => "背景颜色",
      "title_color" => "标题颜色",
      "description_color" => "描述颜色",
      "source_color" => "来源颜色",
      "transition_type" => "翻页过渡",
      "transition_duration" => "过渡时长（秒）",
      "transition_easing" => "过渡缓动",
      "show_ticker" => "显示滚动条",
      "ticker_label" => "滚动条标签",
      "ticker_speed" => "滚动速度",
      "ticker_separator" => "滚动条分隔符",
      "ticker_bg_color" => "滚动条背景颜色",
      "ticker_text_color" => "滚动条文字颜色",
      "ticker_label_bg_color" => "标签背景颜色",
      "ticker_label_color" => "标签颜色"
    },
    "ar" => %{
      "feed_url" => "رابط الموجز",
      "max_items" => "الأخبار في كل صفحة",
      "page_duration" => "مدة الصفحة (بالثواني)",
      "card_layout" => "تخطيط البطاقة",
      "show_image" => "إظهار الصورة",
      "image_width" => "عرض الصورة",
      "fallback_image" => "صورة بديلة",
      "show_source" => "إظهار المصدر",
      "bg_color" => "لون الخلفية",
      "title_color" => "لون العنوان",
      "description_color" => "لون الوصف",
      "source_color" => "لون المصدر",
      "transition_type" => "انتقال الصفحة",
      "transition_duration" => "مدة الانتقال (بالثواني)",
      "transition_easing" => "تسارع الانتقال",
      "show_ticker" => "إظهار الشريط الإخباري",
      "ticker_label" => "تسمية الشريط",
      "ticker_speed" => "سرعة الشريط",
      "ticker_separator" => "فاصل الشريط",
      "ticker_bg_color" => "لون خلفية الشريط",
      "ticker_text_color" => "لون نص الشريط",
      "ticker_label_bg_color" => "لون خلفية التسمية",
      "ticker_label_color" => "لون التسمية"
    },
    "ko" => %{
      "feed_url" => "피드 URL",
      "max_items" => "페이지당 뉴스 수",
      "page_duration" => "페이지 표시 시간(초)",
      "card_layout" => "카드 레이아웃",
      "show_image" => "이미지 표시",
      "image_width" => "이미지 너비",
      "fallback_image" => "대체 이미지",
      "show_source" => "출처 표시",
      "bg_color" => "배경색",
      "title_color" => "제목 색상",
      "description_color" => "설명 색상",
      "source_color" => "출처 색상",
      "transition_type" => "페이지 전환",
      "transition_duration" => "전환 시간(초)",
      "transition_easing" => "전환 가속",
      "show_ticker" => "티커 표시",
      "ticker_label" => "티커 라벨",
      "ticker_speed" => "티커 속도",
      "ticker_separator" => "티커 구분자",
      "ticker_bg_color" => "티커 배경색",
      "ticker_text_color" => "티커 글자 색상",
      "ticker_label_bg_color" => "라벨 배경색",
      "ticker_label_color" => "라벨 색상"
    },
    "ja" => %{
      "feed_url" => "フィードのURL",
      "max_items" => "1ページのニュース数",
      "page_duration" => "ページの表示時間（秒）",
      "card_layout" => "カードのレイアウト",
      "show_image" => "画像を表示",
      "image_width" => "画像の幅",
      "fallback_image" => "代替画像",
      "show_source" => "ソースを表示",
      "bg_color" => "背景色",
      "title_color" => "タイトルの色",
      "description_color" => "説明の色",
      "source_color" => "ソースの色",
      "transition_type" => "ページの切り替え",
      "transition_duration" => "切り替え時間（秒）",
      "transition_easing" => "切り替えのイージング",
      "show_ticker" => "ティッカーを表示",
      "ticker_label" => "ティッカーのラベル",
      "ticker_speed" => "ティッカーの速度",
      "ticker_separator" => "ティッカーの区切り",
      "ticker_bg_color" => "ティッカーの背景色",
      "ticker_text_color" => "ティッカーの文字色",
      "ticker_label_bg_color" => "ラベルの背景色",
      "ticker_label_color" => "ラベルの色"
    }
  }

  @feed_url_descriptions %{
    "en" => "Address of the RSS, Atom or JSON feed, or of a website that links to one",
    "es" => "Dirección del feed RSS, Atom o JSON, o de un sitio web que enlace a uno",
    "sv" =>
      "Adressen till RSS-, Atom- eller JSON-flödet, eller till en webbplats som länkar till ett",
    "de" => "Adresse des RSS-, Atom- oder JSON-Feeds oder einer Website, die auf einen verlinkt",
    "fr" => "Adresse du flux RSS, Atom ou JSON, ou d'un site web qui renvoie vers un flux",
    "zh" => "RSS、Atom 或 JSON 订阅源的地址，或链接到订阅源的网站地址",
    "ar" => "عنوان موجز RSS أو Atom أو JSON، أو عنوان موقع يرتبط بأحدها",
    "ko" => "RSS, Atom 또는 JSON 피드 주소, 또는 피드로 연결되는 웹사이트 주소",
    "ja" => "RSS・Atom・JSONフィードのアドレス、またはフィードへのリンクがあるWebサイトのアドレス"
  }

  def up do
    case Repo.one(widget_query()) do
      nil ->
        :ok

      widget ->
        from(w in "widgets", where: w.id == ^widget.id)
        |> Repo.update_all(
          set: [
            options_schema: flat_schema(widget.options_schema || %{}),
            translations: add_translations(widget.translations || %{}),
            updated_at: now()
          ]
        )

        insert_integration(widget.id)
    end
  end

  def down do
    case Repo.one(widget_query()) do
      nil ->
        :ok

      widget ->
        from(i in "widget_integrations", where: i.widget_id == ^widget.id and i.name == "rss")
        |> Repo.delete_all()

        from(w in "widgets", where: w.id == ^widget.id)
        |> Repo.update_all(
          set: [
            options_schema: json_schema(widget.options_schema || %{}),
            translations: remove_translations(widget.translations || %{}),
            updated_at: now()
          ]
        )
    end
  end

  # Schemaless, so later Widget schema fields don't break this migration.
  defp widget_query do
    from(w in "widgets",
      where: w.slug == @slug,
      select: %{id: w.id, options_schema: w.options_schema, translations: w.translations}
    )
  end

  defp now, do: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

  # JSON Schema properties -> Castmill's flat widget schema.
  def flat_schema(%{"properties" => props}) when is_map(props) do
    props
    |> Map.new(fn {key, field} -> {key, flat_field(field)} end)
    |> Map.put_new("feed_url", @feed_url)
    |> add_order()
  end

  def flat_schema(schema) when is_map(schema) do
    schema |> Map.put_new("feed_url", @feed_url) |> add_order()
  end

  defp flat_field(field) do
    field
    |> Map.drop(["title"])
    |> rename_key("minimum", "min")
    |> rename_key("maximum", "max")
    |> Map.update("type", "string", fn
      "integer" -> "number"
      type -> type
    end)
  end

  defp rename_key(map, from, to) do
    case Map.pop(map, from) do
      {nil, map} -> map
      {value, map} -> Map.put(map, to, value)
    end
  end

  defp add_order(schema) do
    Map.new(schema, fn {key, field} ->
      case Enum.find_index(@order, &(&1 == key)) do
        nil -> {key, field}
        i -> {key, Map.put(field, "order", i)}
      end
    end)
  end

  defp json_schema(schema) do
    properties =
      schema
      |> Map.delete("feed_url")
      |> Map.new(fn {key, field} ->
        {key,
         field
         |> Map.delete("order")
         |> Map.put("title", @labels["en"][key] || key)
         |> rename_key("min", "minimum")
         |> rename_key("max", "maximum")}
      end)

    %{"type" => "object", "properties" => properties}
  end

  defp add_translations(translations) do
    Enum.reduce(@labels, translations, fn {locale, labels}, acc ->
      options =
        Map.new(labels, fn {key, label} ->
          entry = %{"label" => label}

          entry =
            if key == "feed_url",
              do: Map.put(entry, "description", @feed_url_descriptions[locale]),
              else: entry

          {key, entry}
        end)

      Map.update(acc, locale, %{"options" => options}, fn t ->
        Map.update(t, "options", options, &Map.merge(&1, options))
      end)
    end)
  end

  defp remove_translations(translations) do
    keys = Map.keys(@labels["en"])

    Map.new(translations, fn {locale, t} ->
      options = Map.drop(Map.get(t, "options", %{}), keys)
      t = if options == %{}, do: Map.delete(t, "options"), else: Map.put(t, "options", options)
      {locale, t}
    end)
  end

  # Schemaless, like the weather widget's.
  defp insert_integration(widget_id) do
    now = now()

    Repo.insert_all(
      "widget_integrations",
      [
        %{
          widget_id: widget_id,
          name: "rss",
          description: "RSS, Atom and JSON feeds",
          integration_type: "pull",
          credential_scope: "organization",
          credential_schema: %{"auth_type" => "none"},
          config_schema: %{},
          pull_interval_seconds: 600,
          pull_config: %{
            "auth_type" => "none",
            "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.Rss"
          },
          push_config: %{},
          discriminator_type: "widget_option",
          discriminator_key: "feed_url",
          refresh_mode: "on_demand",
          is_active: true,
          inserted_at: now,
          updated_at: now
        }
      ],
      on_conflict:
        {:replace,
         [
           :description,
           :integration_type,
           :credential_scope,
           :credential_schema,
           :pull_interval_seconds,
           :pull_config,
           :discriminator_type,
           :discriminator_key,
           :refresh_mode,
           :is_active,
           :updated_at
         ]},
      conflict_target: [:widget_id, :name]
    )
  end
end
