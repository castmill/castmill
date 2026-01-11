defmodule Castmill.Widgets.AssetStorageTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.AssetStorage

  describe "extract_fonts/3" do
    test "extracts fonts from widget assets with explicit names" do
      widget_data = %{
        "name" => "Test Widget",
        "slug" => "test-widget",
        "assets" => %{
          "fonts" => %{
            "montserrat-regular" => %{
              "path" => "assets/fonts/Montserrat-Regular.woff2",
              "name" => "Montserrat",
              "type" => "font/woff2"
            },
            "lato-regular" => %{
              "path" => "assets/fonts/Lato-Regular.woff2",
              "name" => "Lato",
              "type" => "font/woff2"
            }
          }
        }
      }

      fonts = AssetStorage.extract_fonts(widget_data, "test-widget", %{})

      assert length(fonts) == 2

      # Sort by name for consistent test
      fonts = Enum.sort_by(fonts, & &1["name"])

      assert Enum.at(fonts, 0)["name"] == "Lato"
      assert Enum.at(fonts, 0)["url"] =~ "/widget_assets/test-widget/assets/fonts/Lato-Regular.woff2"

      assert Enum.at(fonts, 1)["name"] == "Montserrat"

      assert Enum.at(fonts, 1)["url"] =~
               "/widget_assets/test-widget/assets/fonts/Montserrat-Regular.woff2"
    end

    test "extracts fonts without explicit names - uses formatted key/path" do
      widget_data = %{
        "name" => "Test Widget",
        "slug" => "test-widget",
        "assets" => %{
          "fonts" => %{
            "myFont" => %{
              "path" => "assets/fonts/MyCustomFont.woff2",
              "type" => "font/woff2"
            }
          }
        }
      }

      fonts = AssetStorage.extract_fonts(widget_data, "test-widget", %{})

      assert length(fonts) == 1
      assert Enum.at(fonts, 0)["name"] == "My Custom Font"
      assert Enum.at(fonts, 0)["url"] =~ "/widget_assets/test-widget/assets/fonts/MyCustomFont.woff2"
    end

    test "returns empty list when no fonts are defined" do
      widget_data = %{
        "name" => "Test Widget",
        "slug" => "test-widget",
        "assets" => %{
          "icons" => %{
            "icon" => %{"path" => "assets/icons/icon.svg"}
          }
        }
      }

      fonts = AssetStorage.extract_fonts(widget_data, "test-widget", %{})

      assert fonts == []
    end

    test "returns empty list when assets are not defined" do
      widget_data = %{
        "name" => "Test Widget",
        "slug" => "test-widget"
      }

      fonts = AssetStorage.extract_fonts(widget_data, "test-widget", %{})

      assert fonts == []
    end

    test "skips fonts without a path" do
      widget_data = %{
        "name" => "Test Widget",
        "slug" => "test-widget",
        "assets" => %{
          "fonts" => %{
            "valid-font" => %{
              "path" => "assets/fonts/Font.woff2",
              "name" => "Valid Font"
            },
            "invalid-font" => %{
              "name" => "Invalid Font"
              # No path
            }
          }
        }
      }

      fonts = AssetStorage.extract_fonts(widget_data, "test-widget", %{})

      assert length(fonts) == 1
      assert Enum.at(fonts, 0)["name"] == "Valid Font"
    end
  end
end
