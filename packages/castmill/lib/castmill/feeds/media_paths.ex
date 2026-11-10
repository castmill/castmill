defmodule Castmill.Feeds.MediaPaths do
  @moduledoc """
  Finds and replaces media URLs in feed data at the paths of a feed's
  `media_fields` (`"image"`, `"post.photo"`, `"photos[].url"`, `"images[]"`).

  When a stored copy replaces a URL, the original is kept next to it in
  `<field>_original` (for arrays of URLs, `<field>_original` is the list of
  original URLs). Originals always win when reading, so data can be swapped
  and restored any number of times.
  """

  @max_url_bytes 2_048

  @doc "Parses `\"photos[].url\"` into `[{\"photos\", true}, {\"url\", false}]`."
  def parse(path) do
    path
    |> String.split(".")
    |> Enum.map(fn segment ->
      if String.ends_with?(segment, "[]"),
        do: {String.trim_trailing(segment, "[]"), true},
        else: {segment, false}
    end)
  end

  @doc "The original media URLs found in `data` at `paths`, in order and without duplicates."
  def collect(data, paths) do
    paths
    |> Enum.flat_map(&collect_path(data, parse(&1)))
    |> Enum.filter(&media_url?/1)
    |> Enum.uniq()
  end

  @doc """
  Puts the stored URL of every original found in `ready` (`%{original => stored}`)
  at `paths`, and restores originals that are not in `ready`.
  """
  def apply(data, paths, ready) do
    Enum.reduce(paths, data, fn path, acc -> apply_path(acc, parse(path), ready) end)
  end

  @doc "Whether `value` is a URL that can be downloaded."
  def media_url?(value) when is_binary(value) and byte_size(value) <= @max_url_bytes do
    case URI.parse(value) do
      %URI{scheme: scheme, host: host} when scheme in ["http", "https"] and is_binary(host) ->
        host != ""

      _ ->
        false
    end
  end

  def media_url?(_value), do: false

  defp collect_path(map, [{key, false}]) when is_map(map), do: [scalar_original(map, key)]
  defp collect_path(map, [{key, true}]) when is_map(map), do: list_originals(map, key) || []

  defp collect_path(map, [{key, false} | rest]) when is_map(map),
    do: collect_path(Map.get(map, key), rest)

  defp collect_path(map, [{key, true} | rest]) when is_map(map) do
    case Map.get(map, key) do
      list when is_list(list) -> Enum.flat_map(list, &collect_path(&1, rest))
      _ -> []
    end
  end

  defp collect_path(_value, _segments), do: []

  defp apply_path(map, [{key, false}], ready) when is_map(map) do
    original_key = key <> "_original"
    original = scalar_original(map, key)

    cond do
      not is_binary(original) ->
        map

      stored = Map.get(ready, original) ->
        map |> Map.put(key, stored) |> Map.put(original_key, original)

      Map.has_key?(map, original_key) ->
        map |> Map.put(key, original) |> Map.delete(original_key)

      true ->
        map
    end
  end

  defp apply_path(map, [{key, true}], ready) when is_map(map) do
    case list_originals(map, key) do
      nil ->
        map

      originals ->
        swapped = Enum.map(originals, &((is_binary(&1) && Map.get(ready, &1)) || &1))

        if swapped == originals,
          do: map |> Map.put(key, originals) |> Map.delete(key <> "_original"),
          else: map |> Map.put(key, swapped) |> Map.put(key <> "_original", originals)
    end
  end

  defp apply_path(map, [{key, false} | rest], ready) when is_map(map) do
    case Map.fetch(map, key) do
      {:ok, value} -> Map.put(map, key, apply_path(value, rest, ready))
      :error -> map
    end
  end

  defp apply_path(map, [{key, true} | rest], ready) when is_map(map) do
    case Map.get(map, key) do
      list when is_list(list) -> Map.put(map, key, Enum.map(list, &apply_path(&1, rest, ready)))
      _ -> map
    end
  end

  defp apply_path(value, _segments, _ready), do: value

  defp scalar_original(map, key) do
    case Map.get(map, key <> "_original") do
      original when is_binary(original) -> original
      _ -> Map.get(map, key)
    end
  end

  defp list_originals(map, key) do
    case {Map.get(map, key), Map.get(map, key <> "_original")} do
      {list, originals}
      when is_list(list) and is_list(originals) and length(list) == length(originals) ->
        originals

      {list, _} when is_list(list) ->
        list

      _ ->
        nil
    end
  end
end
