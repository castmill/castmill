defmodule Castmill.WidgetsTest do
  use Castmill.DataCase

  alias Castmill.Widgets.Schema

  @moduletag :widgets_data_case

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
          "schema" => %{
            "item" => "number"
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
          "schema" => "number"
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

    @tag :only
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
        # "ref" should be a string
        "field_a" => 123
      }

      assert {:error, _} = Schema.validate_data(schema, data)
    end

    test "validate_data/2 validates list with deep nested data" do
      schema = %{
        "field_a" => %{
          "type" => "list",
          "schema" => %{
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
          "schema" => %{
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
          "schema" => %{
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
              "schema" => %{
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
              "schema" => %{
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
end
