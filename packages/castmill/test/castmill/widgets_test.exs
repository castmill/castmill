defmodule Castmill.WidgetsTest do
  use Castmill.DataCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Widgets.Schema
  alias Castmill.Widgets

  @moduletag :widgets_config_case

  describe "widgets schemas" do
    test "validate_schema/1 returns error if empty schema" do
      schema = %{}
      {:error, _} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 with basic types" do
      schema = %{
        "field_a" => "string",
        "field_b" => "number"
      }

      assert {:ok, nil} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 with map type" do
      schema = %{
        "field_c" => %{
          "type" => "map",
          "schema" => %{
            "subfield_a" => "string",
            "subfield_b" => "number"
          }
        }
      }

      assert {:ok, nil} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 with list type" do
      schema = %{
        "field_d" => %{
          "type" => "list",
          "items" => %{
            "type" => "number"
          }
        }
      }

      assert {:ok, nil} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 with ref type" do
      schema = %{
        "field_e" => %{
          "type" => "ref",
          "collection" => "medias"
        }
      }

      assert {:ok, nil} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 with required fields and default values" do
      schema = %{
        "field_a" => %{
          "type" => "number",
          "required" => true,
          "default" => 123
        },
        "field_b" => %{
          "type" => "string",
          "required" => false,
          "default" => "abc"
        }
      }

      assert {:ok, nil} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 with incorrect type string" do
      assert {:error, _} =
               Schema.validate_schema(%{
                 "field_a" => "foo"
               })
    end

    test "validate_schema/1 with incorrect data types for boolean and number fields" do
      schema = %{
        # expects a number
        "field_a" => "number",
        # expects a boolean
        "field_b" => "boolean"
      }

      data = %{
        "field_a" => "not a number",
        "field_b" => "not a boolean"
      }

      assert {:error, _} = Schema.validate_data(schema, data)
    end

    test "validate_schema/1 with incorrect type" do
      assert {:error, _} =
               Schema.validate_schema(%{
                 "field_a" => %{"type" => "foo"}
               })
    end

    test "validate_schema/1 with incorrect 'required' field" do
      schema = %{
        "field_a" => %{
          "type" => "string",
          "required" => "yes"
        }
      }

      assert {:error, _} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 with incorrect default value" do
      schema = %{
        "field_a" => %{
          "type" => "number",
          # string instead of a number
          "default" => "123"
        }
      }

      assert {:error, _} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 with missing 'schema' attribute in map type" do
      schema = %{
        "field_a" => %{
          "type" => "map"
        }
      }

      assert {:error, _} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 with empty 'schema' attribute in map type returns error" do
      schema = %{
        "field_a" => %{
          "type" => "map",
          "schema" => %{}
        }
      }

      assert {:error, _} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 validates a widget schema with required number and string fields" do
      schema = %{
        "field_a" => %{
          "type" => "number",
          "required" => true
        },
        "field_b" => %{
          "type" => "string",
          "required" => false
        }
      }

      assert {:ok, nil} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 validates a widget schema with a default value for string and number fields" do
      {:ok, nil} =
        Schema.validate_schema(%{
          "field_a" => %{
            "type" => "number",
            "default" => 123
          },
          "field_b" => %{
            "type" => "string",
            "default" => "abc"
          }
        })
    end

    test "validate_schema/1 validates a widget schema with a map field" do
      schema = %{
        field_a: %{
          "type" => "map",
          "schema" => %{
            field_a: "string",
            field_b: "number"
          }
        }
      }

      {:ok, nil} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 validates a widget schema with a reference field" do
      schema = %{
        "field_a" => %{
          "type" => "ref",
          "collection" => "medias"
        }
      }

      {:ok, nil} = Schema.validate_schema(schema)
    end

    test "validate_schema/1 validates a widget schema with a reference field missing the collection property" do
      schema = %{
        "field_a" => %{
          "type" => "ref"
        }
      }

      {:error, _} = Schema.validate_schema(schema)
    end

    test "validate_data/1 validates that simple data is actually conforming to the given schema" do
      schema = %{
        "field_a" => "string",
        "field_b" => "number"
      }

      data = %{
        "field_a" => "abc",
        "field_b" => 123
      }

      {:ok, %{"field_a" => "abc", "field_b" => 123}} = Schema.validate_data(schema, data)
    end

    test "validate_data/1 validates data and fills in defaults" do
      schema = %{
        "field_a" => %{"type" => "string", "required" => true},
        "field_b" => %{"type" => "number", "required" => false, "default" => 123},
        "field_c" => %{"type" => "number", "required" => false}
      }

      data = %{
        "field_a" => "abc"
      }

      assert {:ok, %{"field_a" => "abc", "field_b" => 123}} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 assigns default values when fields are missing in the data" do
      schema = %{
        "field_a" => %{
          "type" => "string",
          "default" => "default value"
        },
        "field_b" => %{
          "type" => "number",
          "default" => 123
        }
      }

      data = %{
        "field_a" => "actual value"
      }

      assert {:ok, %{"field_a" => "actual value", "field_b" => 123}} =
               Schema.validate_data(schema, data)
    end

    test "validate_data/2 validates nested schemas" do
      schema = %{
        "field_a" => "string",
        "field_b" => %{
          "type" => "map",
          "schema" => %{
            "subfield_a" => "string",
            "subfield_b" => "number"
          }
        }
      }

      data = %{
        "field_a" => "abc",
        "field_b" => %{
          "subfield_a" => "xyz",
          "subfield_b" => 123
        }
      }

      assert {:ok, ^data} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 populates default values" do
      schema = %{
        "field_a" => %{
          "type" => "string",
          "default" => "default_a"
        },
        "field_b" => %{
          "type" => "number",
          "default" => 123
        }
      }

      data = %{
        "field_a" => "abc"
      }

      assert {:ok, %{"field_a" => "abc", "field_b" => 123}} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 ignores non-required and non-provided fields" do
      schema = %{
        "field_a" => %{
          "type" => "string",
          "required" => false
        },
        "field_b" => "number"
      }

      data = %{
        "field_b" => 123
      }

      assert {:ok, ^data} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 validates list data" do
      schema = %{
        "field_a" => %{
          "type" => "list",
          "items" => "number"
        }
      }

      data = %{
        "field_a" => [1, 2, 3]
      }

      assert {:ok, ^data} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 validates ref data" do
      schema = %{
        "field_a" => %{
          "type" => "ref",
          "collection" => "users"
        }
      }

      data = %{
        "field_a" => "user1"
      }

      assert {:ok, ^data} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 gives an error for invalid list data" do
      schema = %{
        "field_a" => %{
          "type" => "list",
          "schema" => "number"
        }
      }

      data = %{
        "field_a" => [1, "invalid", 3]
      }

      assert {:error, _} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 gives an error for invalid ref data" do
      schema = %{
        "field_a" => %{
          "type" => "ref",
          "collection" => "users"
        }
      }

      data = %{
        # "ref" should be a string or a number
        "field_a" => %{}
      }

      assert {:error, _} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 validates list with deep nested data" do
      schema = %{
        "field_a" => %{
          "type" => "list",
          "items" => %{
            "type" => "map",
            "schema" => %{
              "subfield_a" => "string",
              "subfield_b" => "number"
            }
          }
        }
      }

      data = %{
        "field_a" => [
          %{
            "subfield_a" => "abc",
            "subfield_b" => 123
          },
          %{
            "subfield_a" => "xyz",
            "subfield_b" => 456
          }
        ]
      }

      assert {:ok, ^data} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 validates list with deep nested data with an error in a deep property" do
      schema = %{
        "field_a" => %{
          "type" => "list",
          "items" => %{
            "type" => "map",
            "schema" => %{
              "subfield_a" => "string",
              "subfield_b" => "number"
            }
          }
        }
      }

      data = %{
        "field_a" => [
          %{
            "subfield_a" => "abc",
            # "subfield_b" should be a number
            "subfield_b" => "123"
          },
          %{
            "subfield_a" => "xyz",
            "subfield_b" => 456
          }
        ]
      }

      assert {:error, _} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 validates list with deep nested data and default values" do
      schema = %{
        "field_a" => %{
          "type" => "list",
          "items" => %{
            "type" => "map",
            "schema" => %{
              "subfield_a" => "string",
              "subfield_b" => %{
                "type" => "number",
                "default" => 123
              }
            }
          }
        }
      }

      data = %{
        "field_a" => [
          %{
            "subfield_a" => "abc"
          },
          %{
            "subfield_a" => "xyz"
          }
        ]
      }

      assert {:ok,
              %{
                "field_a" => [
                  %{
                    "subfield_a" => "abc",
                    "subfield_b" => 123
                  },
                  %{
                    "subfield_a" => "xyz",
                    "subfield_b" => 123
                  }
                ]
              }} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 validates map with deep nested data including lists and default values and required values" do
      schema = %{
        "field_a" => %{
          "type" => "map",
          "schema" => %{
            "subfield_a" => "string",
            "subfield_b" => %{
              "type" => "number",
              "default" => 123
            },
            "subfield_c" => %{
              "type" => "list",
              "items" => %{
                "type" => "map",
                "schema" => %{
                  "subsubfield_a" => "string",
                  "subsubfield_b" => %{
                    "type" => "number",
                    "default" => 456
                  }
                }
              }
            }
          }
        }
      }

      data = %{
        "field_a" => %{
          "subfield_a" => "abc",
          "subfield_c" => [
            %{
              "subsubfield_a" => "def"
            },
            %{
              "subsubfield_a" => "ghi"
            }
          ]
        }
      }

      assert {:ok,
              %{
                "field_a" => %{
                  "subfield_a" => "abc",
                  "subfield_b" => 123,
                  "subfield_c" => [
                    %{
                      "subsubfield_a" => "def",
                      "subsubfield_b" => 456
                    },
                    %{
                      "subsubfield_a" => "ghi",
                      "subsubfield_b" => 456
                    }
                  ]
                }
              }} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 validates map with deep nested data missing a required field deep in the data" do
      schema = %{
        "field_a" => %{
          "type" => "map",
          "schema" => %{
            "subfield_a" => "string",
            "subfield_b" => %{
              "type" => "number",
              "default" => 123
            },
            "subfield_c" => %{
              "type" => "list",
              "items" => %{
                "type" => "map",
                "schema" => %{
                  "subsubfield_a" => %{"type" => "string", "required" => true},
                  "subsubfield_b" => %{
                    "type" => "number",
                    "default" => 456
                  }
                }
              }
            }
          }
        }
      }

      data = %{
        "field_a" => %{
          "subfield_a" => "abc",
          "subfield_c" => [
            %{
              # "subsubfield_a" is missing
              "subsubfield_b" => 123
            },
            %{
              "subsubfield_a" => "ghi"
            }
          ]
        }
      }

      assert {:error, _} = Schema.validate_data(schema, data)
    end
  end

  describe "update_widget_config/4" do
    setup do
      network = network_fixture()

      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})

      widget =
        widget_fixture(%{
          name: "widget",
          template: %{
            "type" => "image",
            "name" => "image",
            "opts" => %{
              "url" => %{"key" => "options.image.files[@target].uri"},
              "autozoom" => %{"key" => "options.autozoom"},
              "duration" => %{"key" => "options.duration"}
            }
          }
        })

      playlist_item =
        playlist_item_fixture(%{
          playlist_id: playlist.id,
          offset: 0,
          duration: 120
        })

      widget_config =
        widget_config_fixture(%{playlist_item_id: playlist_item.id, widget_id: widget.id})

      options = %{"color" => "blue"}
      data = %{"size" => "large"}

      [
        playlist: playlist,
        playlist_item: playlist_item,
        widget_config: widget_config,
        options: options,
        data: data
      ]
    end

    test "updates widget configuration successfully", %{
      playlist: playlist,
      playlist_item: playlist_item,
      options: options,
      data: data
    } do
      assert {:ok, "Widget configuration updated successfully"} =
               Widgets.update_widget_config(playlist.id, playlist_item.id, options, data)

      updated_widget_config = Widgets.get_widget_config(playlist.id, playlist_item.id)

      assert updated_widget_config.options == options
      assert updated_widget_config.data == data
    end
  end

  describe "list_widgets/1" do
    setup do
      # Create test widgets with different names for search testing
      {:ok, widget1} =
        Widgets.create_widget(%{
          name: "Text Widget",
          slug: "text-widget",
          description: "A simple text widget",
          template: %{},
          options_schema: %{},
          data_schema: %{}
        })

      {:ok, widget2} =
        Widgets.create_widget(%{
          name: "Image Widget",
          slug: "image-widget",
          description: "An image display widget",
          template: %{},
          options_schema: %{},
          data_schema: %{}
        })

      {:ok, widget3} =
        Widgets.create_widget(%{
          name: "Video Widget",
          slug: "video-widget",
          description: "A video player widget",
          template: %{},
          options_schema: %{},
          data_schema: %{}
        })

      {:ok, widget1: widget1, widget2: widget2, widget3: widget3}
    end

    test "returns all widgets without parameters" do
      widgets = Widgets.list_widgets()
      assert length(widgets) >= 3
    end

    test "returns paginated widgets", %{widget1: widget1, widget2: widget2} do
      params = %{
        page: 1,
        page_size: 2,
        search: nil,
        key: "name",
        direction: "ascending"
      }

      widgets = Widgets.list_widgets(params)
      assert length(widgets) == 2
    end

    test "returns second page of widgets" do
      params = %{
        page: 2,
        page_size: 2,
        search: nil,
        key: "name",
        direction: "ascending"
      }

      widgets = Widgets.list_widgets(params)
      assert is_list(widgets)
    end

    test "filters widgets by search term" do
      params = %{
        page: 1,
        page_size: 10,
        search: "Text",
        key: "name",
        direction: "ascending"
      }

      widgets = Widgets.list_widgets(params)
      assert length(widgets) >= 1
      assert Enum.any?(widgets, fn w -> String.contains?(w.name, "Text") end)
    end

    test "search is case insensitive" do
      params = %{
        page: 1,
        page_size: 10,
        search: "text",
        key: "name",
        direction: "ascending"
      }

      widgets = Widgets.list_widgets(params)
      assert length(widgets) >= 1
      assert Enum.any?(widgets, fn w -> String.contains?(w.name, "Text") end)
    end

    test "sorts widgets by name ascending" do
      params = %{
        page: 1,
        page_size: 10,
        search: nil,
        key: "name",
        direction: "ascending"
      }

      widgets = Widgets.list_widgets(params)
      names = Enum.map(widgets, & &1.name)
      assert names == Enum.sort(names)
    end

    test "sorts widgets by name descending" do
      params = %{
        page: 1,
        page_size: 10,
        search: nil,
        key: "name",
        direction: "descending"
      }

      widgets = Widgets.list_widgets(params)
      names = Enum.map(widgets, & &1.name)
      assert names == Enum.sort(names, :desc)
    end
  end

  describe "count_widgets/1" do
    setup do
      {:ok, _widget1} =
        Widgets.create_widget(%{
          name: "Counter Widget 1",
          slug: "counter-widget-1",
          template: %{},
          options_schema: %{},
          data_schema: %{}
        })

      {:ok, _widget2} =
        Widgets.create_widget(%{
          name: "Counter Widget 2",
          slug: "counter-widget-2",
          template: %{},
          options_schema: %{},
          data_schema: %{}
        })

      :ok
    end

    test "returns total count of widgets" do
      count = Widgets.count_widgets()
      assert count >= 2
    end

    test "returns count with search filter" do
      count = Widgets.count_widgets(%{search: "Counter"})
      assert count >= 2
    end

    test "returns zero for non-matching search" do
      count = Widgets.count_widgets(%{search: "NonExistentWidget12345"})
      assert count == 0
    end

    test "search count is case insensitive" do
      count = Widgets.count_widgets(%{search: "counter"})
      assert count >= 2
    end
  end
end
