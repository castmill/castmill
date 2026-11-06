defmodule Castmill.Widgets.Integrations.Fetchers.TestChoices do
  @moduledoc false
  # Choice provider for tests. The list name selects the behavior.

  @photos for n <- 1..5, do: %{value: "photo-#{n}", label: "Photo #{n}"}

  def fetch(_credentials, _options), do: {:ok, %{}, %{}}

  def choices("photos", %{"query" => query, "cursor" => cursor}, _credentials) do
    matching = Enum.filter(@photos, &String.contains?(&1.label, query))
    offset = if cursor, do: String.to_integer(cursor), else: 0
    page = Enum.slice(matching, offset, 2)
    next = if offset + 2 < length(matching), do: Integer.to_string(offset + 2)

    {:ok,
     %{
       items:
         Enum.map(page, fn photo ->
           Map.merge(photo, %{
             thumbnail_url: "https://img.example/#{photo.value}?w=320",
             preview: %{type: "image", url: "https://img.example/#{photo.value}?w=1920"}
           })
         end),
       next: next
     }}
  end

  # Echoes what the provider received; the unique value shows whether a result was cached.
  def choices("echo", params, credentials) do
    {:ok,
     %{
       "items" => [
         %{
           "value" => "echo-#{System.unique_integer([:positive])}",
           "label" => Jason.encode!(credentials),
           "description" => Jason.encode!(params)
         }
       ],
       "next" => nil
     }}
  end

  def choices("slow", _params, _credentials) do
    Process.sleep(500)
    {:ok, %{items: [], next: nil}}
  end

  def choices("fail", _params, _credentials), do: {:error, :boom}
  def choices("raise", _params, _credentials), do: raise("boom")
  def choices("exit", _params, _credentials), do: exit(:boom)
  def choices("invalid", _params, _credentials), do: :nope
  def choices("no-items", _params, _credentials), do: {:ok, %{items: :nope}}

  def choices("messy", _params, _credentials) do
    {:ok,
     %{
       items: [
         %{label: "Missing value"},
         "not a map",
         %{value: 42},
         %{
           "value" => "a",
           "label" => "A",
           "description" => "",
           "thumbnail_url" => "http://insecure.example/a.jpg",
           "preview" => %{"type" => "video", "url" => "javascript:alert(1)"},
           "disabled" => "yes",
           "secret" => "dropped"
         },
         %{
           value: "b",
           label: "B",
           thumbnail_url: "https://cdn.example/b.jpg",
           preview: %{type: "font", url: "https://cdn.example/b.woff2", mime_type: "font/woff2"},
           disabled: true
         }
       ],
       next: ""
     }}
  end
end
