defmodule Castmill.PaginationBehavior do
  @moduledoc """
  Defines a contract for listing and counting resources with pagination.
  """

  @callback list_resources(
              resource :: module(),
              params :: %{
                optional(:organization_id) => any(),
                optional(:page) => non_neg_integer(),
                optional(:page_size) => non_neg_integer(),
                optional(:search) => String.t(),
                optional(:filters) => any()
              }
            ) :: [any()]

  @callback count_resources(
              resource :: module(),
              params :: %{
                optional(:organization_id) => any(),
                optional(:search) => String.t(),
                optional(:filters) => any()
              }
            ) :: non_neg_integer()
end
