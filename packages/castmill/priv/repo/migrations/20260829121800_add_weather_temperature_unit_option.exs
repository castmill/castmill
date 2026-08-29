defmodule Castmill.Repo.Migrations.AddWeatherTemperatureUnitOption do
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget

  @weather_option_translations %{
    "en" => %{
      "label" => "Use Fahrenheit",
      "description" => "Display temperatures in Fahrenheit instead of Celsius"
    },
    "es" => %{
      "label" => "Usar Fahrenheit",
      "description" => "Muestra las temperaturas en Fahrenheit en lugar de Celsius"
    },
    "sv" => %{
      "label" => "Använd Fahrenheit",
      "description" => "Visa temperaturer i Fahrenheit istället för Celsius"
    },
    "de" => %{
      "label" => "Fahrenheit verwenden",
      "description" => "Temperaturen in Fahrenheit statt in Celsius anzeigen"
    },
    "fr" => %{
      "label" => "Utiliser Fahrenheit",
      "description" => "Afficher les températures en Fahrenheit au lieu de Celsius"
    },
    "zh" => %{
      "label" => "使用华氏度",
      "description" => "以华氏度而不是摄氏度显示温度"
    },
    "ar" => %{
      "label" => "استخدام فهرنهايت",
      "description" => "اعرض درجات الحرارة بالفهرنهايت بدلًا من المئوية"
    },
    "ko" => %{
      "label" => "화씨 사용",
      "description" => "섭씨 대신 화씨로 온도를 표시합니다"
    },
    "ja" => %{
      "label" => "華氏を使用",
      "description" => "摂氏ではなく華氏で気温を表示します"
    }
  }

  def up do
    weather = Repo.one(from(w in Widget, where: w.slug == "weather"))

    if weather do
      from(w in Widget, where: w.id == ^weather.id)
      |> Repo.update_all(
        set: [
          options_schema: options_schema(),
          translations: add_option_translations(weather.translations || %{})
        ]
      )
    end
  end

  def down do
    :ok
  end

  defp options_schema do
    %{
      "location" => %{
        "type" => "location",
        "required" => true,
        "description" => "Select the location for weather information",
        "default" => %{
          "lat" => 51.505,
          "lng" => -0.09,
          "address" => "London, United Kingdom"
        },
        "defaultZoom" => 10,
        "order" => 1
      },
      "fahrenheit" => %{
        "type" => "boolean",
        "default" => false,
        "description" => "Display temperatures in Fahrenheit instead of Celsius",
        "order" => 2
      }
    }
  end

  defp add_option_translations(existing_translations) do
    Enum.reduce(
      @weather_option_translations,
      existing_translations,
      fn {locale, translation}, acc ->
        Map.update(
          acc,
          locale,
          %{"options" => %{"fahrenheit" => translation}},
          fn locale_translations ->
            options = Map.get(locale_translations, "options", %{})
            updated_options = Map.put(options, "fahrenheit", translation)
            Map.put(locale_translations, "options", updated_options)
          end
        )
      end
    )
  end
end
