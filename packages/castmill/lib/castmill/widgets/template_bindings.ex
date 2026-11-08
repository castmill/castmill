defmodule Castmill.Widgets.TemplateBindings do
  @moduledoc """
  Validates the formatting bindings of a widget template (`fmt`, `list` and `first`,
  see `agents/systems/TEMPLATE-VALUE-FORMATTING.md`), so template mistakes are caught
  when a widget is created or uploaded rather than on a screen.

  The grammar and formatter list mirror the player
  (`packages/player/src/widgets/template/format`); keep them in sync.
  """

  # name => {min_args, max_args}
  @formatters %{
    "number" => {0, 3},
    "date" => {1, 2},
    "timed" => {0, 0},
    "upper" => {0, 0},
    "lower" => {0, 0},
    "capitalize" => {0, 0},
    "trim" => {0, 0},
    "truncate" => {1, 1},
    "default" => {1, 1}
  }

  @list_keys ~w(key items where sort desc item skip limit join)
  @operators ~w(eq neq gt gte lt lte present)

  # A plain string that looks like a placeholder, e.g. "{data.price | number} kr":
  # probably a `fmt` missing its {"fmt": …} wrapper. Paths start with data., options.,
  # $ or @, so CSS such as "{fill:red}" does not match.
  @placeholder_like ~r/\{\s*(?:data\.|options\.|\$|@)[^{}]*\}/

  @doc "The formatter names and their argument counts."
  def formatters, do: @formatters

  @doc """
  Returns `{errors, warnings}` for a template. Each entry is `{path, message}`, where
  the path names the components and keys leading to the problem.
  """
  def check(template) do
    {errors, warnings} = walk(template, [], {[], []})
    {Enum.reverse(errors), Enum.reverse(warnings)}
  end

  @doc "Returns `:ok` or `{:error, messages}` (warnings are ignored)."
  def validate(template) do
    case check(template) do
      {[], _warnings} -> :ok
      {errors, _warnings} -> {:error, Enum.map(errors, &describe/1)}
    end
  end

  @doc "Formats a `{path, message}` entry for display."
  def describe({path, message}) do
    case path do
      [] -> message
      _ -> "#{Enum.join(path, " > ")}: #{message}"
    end
  end

  # --- traversal --------------------------------------------------------------

  defp walk(%{"fmt" => fmt} = map, path, acc) do
    acc =
      if is_binary(fmt) do
        case parse(fmt) do
          :ok -> acc
          {:error, message} -> error(acc, path, "invalid fmt #{inspect(fmt)}: #{message}")
        end
      else
        error(acc, path, "fmt must be a string")
      end

    map |> Map.delete("fmt") |> walk(path, acc)
  end

  defp walk(%{"list" => list} = map, path, acc) do
    acc =
      if is_map(list) do
        walk_list(list, path ++ ["list"], acc)
      else
        error(acc, path ++ ["list"], "list must be an object")
      end

    map |> Map.delete("list") |> walk(path, acc)
  end

  defp walk(%{"first" => first} = map, path, acc) when map_size(map) == 1 do
    if is_list(first) and first != [] do
      first
      |> Enum.with_index()
      |> Enum.reduce(acc, fn {value, index}, acc ->
        walk(value, path ++ ["first[#{index}]"], acc)
      end)
    else
      error(acc, path, "first must be a non-empty list")
    end
  end

  defp walk(map, path, acc) when is_map(map) do
    segment = fn key -> if is_binary(map["name"]), do: "#{map["name"]}.#{key}", else: key end

    map
    |> Enum.sort_by(fn {key, _} -> key end)
    |> Enum.reduce(acc, fn {key, value}, acc ->
      walk(value, path ++ [segment.(to_string(key))], acc)
    end)
  end

  defp walk(list, path, acc) when is_list(list) do
    list
    |> Enum.with_index()
    |> Enum.reduce(acc, fn {value, index}, acc -> walk(value, path ++ ["[#{index}]"], acc) end)
  end

  defp walk(string, path, acc) when is_binary(string) do
    if Regex.match?(@placeholder_like, string) do
      warning(acc, path, "#{inspect(string)} looks like a format text; wrap it as {\"fmt\": …}")
    else
      acc
    end
  end

  defp walk(_value, _path, acc), do: acc

  defp walk_list(list, path, acc) do
    acc =
      case Map.keys(list) -- @list_keys do
        [] -> acc
        unknown -> error(acc, path, "unknown list keys #{Enum.join(Enum.sort(unknown), ", ")}")
      end

    acc =
      cond do
        is_binary(list["key"]) and not Map.has_key?(list, "items") ->
          acc

        is_list(list["items"]) and not Map.has_key?(list, "key") ->
          walk(list["items"], path ++ ["items"], acc)

        true ->
          error(acc, path, "list needs either a key (string) or items (list)")
      end

    acc =
      case list["where"] do
        nil -> acc
        where when is_list(where) -> check_conditions(where, path ++ ["where"], acc)
        _ -> error(acc, path, "where must be a list of conditions")
      end

    acc = if Map.has_key?(list, "item"), do: walk(list["item"], path ++ ["item"], acc), else: acc

    acc
    |> check_type(list, "sort", path, &is_binary/1, "a key path")
    |> check_type(list, "desc", path, &is_boolean/1, "a boolean")
    |> check_type(list, "skip", path, &(is_integer(&1) and &1 >= 0), "a non-negative integer")
    |> check_type(list, "limit", path, &(is_integer(&1) and &1 >= 0), "a non-negative integer")
    |> check_type(list, "join", path, &is_binary/1, "a string")
  end

  defp check_conditions(conditions, path, acc) do
    conditions
    |> Enum.with_index()
    |> Enum.reduce(acc, fn {condition, index}, acc ->
      condition_path = path ++ ["[#{index}]"]

      with true <- is_map(condition) || :not_map,
           true <- is_binary(condition["key"]) || :no_key,
           [_op] <- Map.keys(condition) -- ["key"],
           [] <- (Map.keys(condition) -- ["key"]) -- @operators,
           true <- valid_present?(condition) || :bad_present do
        acc
      else
        :not_map ->
          error(acc, condition_path, "a condition must be an object")

        :no_key ->
          error(acc, condition_path, "a condition needs a key")

        :bad_present ->
          error(acc, condition_path, "present must be a boolean")

        [] ->
          error(acc, condition_path, "a condition needs one of #{Enum.join(@operators, ", ")}")

        ops ->
          error(
            acc,
            condition_path,
            "a condition takes exactly one of #{Enum.join(@operators, ", ")} (got #{Enum.join(Enum.sort(ops), ", ")})"
          )
      end
    end)
  end

  defp valid_present?(%{"present" => present}), do: is_boolean(present)
  defp valid_present?(_condition), do: true

  defp check_type(acc, map, key, path, valid?, description) do
    if Map.has_key?(map, key) and not valid?.(map[key]),
      do: error(acc, path, "#{key} must be #{description}"),
      else: acc
  end

  defp error({errors, warnings}, path, message), do: {[{path, message} | errors], warnings}
  defp warning({errors, warnings}, path, message), do: {errors, [{path, message} | warnings]}

  # --- fmt grammar ---------------------------------------------------------------

  @doc """
  Parses a `fmt` text and checks its formatters. Returns `:ok` or `{:error, message}`.
  """
  def parse(fmt) when is_binary(fmt), do: literal(String.graphemes(fmt), 0)

  defp literal([], _pos), do: :ok
  defp literal(["{", "{" | rest], pos), do: literal(rest, pos + 2)
  defp literal(["}", "}" | rest], pos), do: literal(rest, pos + 2)
  defp literal(["}" | _], pos), do: {:error, "unexpected \"}\" at position #{pos}"}

  defp literal(["{" | rest], pos) do
    with {:ok, parts, rest, next} <- placeholder(rest, pos + 1, [[]], "", nil, pos),
         :ok <- check_placeholder(parts, pos) do
      literal(rest, next)
    end
  end

  defp literal([_ | rest], pos), do: literal(rest, pos + 1)

  # Collects "|"-separated parts of ":"-separated items until the closing "}".
  defp placeholder([], _pos, _parts, _current, _quoted, start),
    do: {:error, "unclosed placeholder at position #{start}"}

  defp placeholder(["'" | rest], pos, parts, current, quoted, start) do
    if is_nil(quoted) and String.trim(current) == "",
      do: quote_value(rest, pos + 1, parts, "", pos, start),
      else: {:error, "unexpected quote at position #{pos}"}
  end

  defp placeholder([char | rest], pos, parts, current, quoted, start)
       when char in [":", "|", "}"] do
    parts = finish_item(parts, current, quoted)

    case char do
      "|" -> placeholder(rest, pos + 1, parts ++ [[]], "", nil, start)
      ":" -> placeholder(rest, pos + 1, parts, "", nil, start)
      "}" -> {:ok, parts, rest, pos + 1}
    end
  end

  defp placeholder(["{" | _], pos, _parts, _current, _quoted, _start),
    do: {:error, "unexpected \"{\" at position #{pos}"}

  defp placeholder([char | rest], pos, parts, current, quoted, start) do
    if not is_nil(quoted) and char != " ",
      do: {:error, "unexpected text after quote at position #{pos}"},
      else: placeholder(rest, pos + 1, parts, current <> char, quoted, start)
  end

  defp quote_value([], _pos, _parts, _value, quote_pos, _start),
    do: {:error, "unclosed quote at position #{quote_pos}"}

  defp quote_value(["'", "'" | rest], pos, parts, value, quote_pos, start),
    do: quote_value(rest, pos + 2, parts, value <> "'", quote_pos, start)

  defp quote_value(["'" | rest], pos, parts, value, _quote_pos, start),
    do: placeholder(rest, pos + 1, parts, "", value, start)

  defp quote_value([char | rest], pos, parts, value, quote_pos, start),
    do: quote_value(rest, pos + 1, parts, value <> char, quote_pos, start)

  defp finish_item(parts, current, quoted) do
    item = if is_nil(quoted), do: String.trim(current), else: quoted
    List.update_at(parts, -1, &(&1 ++ [item]))
  end

  defp check_placeholder([path_part | formatter_parts], pos) do
    case path_part do
      [path] when path != "" -> check_formatters(formatter_parts, pos)
      _ -> {:error, "missing path at position #{pos}"}
    end
  end

  defp check_formatters([], _pos), do: :ok

  defp check_formatters([[name | args] | rest], pos) do
    case Map.fetch(@formatters, name) do
      {:ok, {min, max}} when length(args) >= min and length(args) <= max ->
        check_formatters(rest, pos)

      {:ok, {min, max}} ->
        expected = if min == max, do: "#{min}", else: "#{min} to #{max}"
        {:error, "formatter \"#{name}\" takes #{expected} argument(s)"}

      :error when name == "" ->
        {:error, "missing formatter name at position #{pos}"}

      :error ->
        {:error, "unknown formatter \"#{name}\""}
    end
  end
end
