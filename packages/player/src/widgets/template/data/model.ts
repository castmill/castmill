/**
 * Template Model
 *
 * This class represents the data model to be used by the template widget.
 *
 */

export class Model {
  constructor(private data: any) {}

  static interpolateAll(
    source: Record<string, string>,
    data: object
  ): [{ [index: string]: string }, Error[]] {
    const result: { [index: string]: string } = {};
    const allErrors = [];

    for (const key in source) {
      const [value, errors] = Model.interpolate(source[key], data);
      if (errors.length > 0) {
        allErrors.push(...errors);
        continue;
      }
      result[key] = value;
    }
    return [result, allErrors];
  }

  /**
   * Interpolates all the bindings in the given string.
   * A binding is a string that starts with a ${ is followed by a key path and ends with }.
   *
   * For example:
   *   "Hello ${name}!"
   *   "Hello ${user.name}!"
   *   "Hello ${user.name}! You are ${user.age} years old."
   *
   * returns a tuple with the interpolated string and/or an array of errors.
   */
  static interpolate(str: string, data: object): [string, Error[]] {
    const regex = /\${([^}]+)}/g;
    let match;
    let result = str;
    const errors = [];

    while ((match = regex.exec(str))) {
      const [binding, keyPath] = match;
      const [value, error] = Model.get(data, keyPath);
      if (error) {
        errors.push(error);
        continue;
      }
      result = result.replace(binding, value);
    }
    return [result, errors];
  }

  /**
   * Gets the value or array (or subarray) at the given key path.
   *
   * Suported bindings:
   * - "foo.bar"
   * - "foo.bar[0][2]"
   * - "foo.bar[0]2].baz[3:4]"
   * - "foo.bar[0]2].baz[:4]"
   * - "foo.bar[0]2].baz[4:]"
   *
   * @param data object where we want to extract a value based on a binding.
   *
   * @param binding string with the binding pointing to our value.
   * @returns
   */
  static get(data: any, binding: string) {
    const keys = binding.split(".");
    let error;

    for (const key of keys) {
      let { variable, indexes } = getArrayIndexes(key);
      if (variable && indexes) {
        let array = data[variable];

        for (let i = 0; i < indexes.length; i++) {
          if (!Array.isArray(array)) {
            error = new Error(`${variable} as ${binding} is not an array`);
            break;
          }
          if (indexes[i].includes(":")) {
            array = getSubArray(array, indexes[i]);
          }
        }

        data = array;
      } else {
        if (data[key] === undefined) {
          error = new Error(`Invalid key path: ${binding}`);
          break;
        }
        data = data[key];
      }
    }
    return [!error ? data : void 0, error];
  }
}
// ("foo.bar.baz[3][0:3]");

// Credits: https://stackoverflow.com/questions/39182149/regex-to-extract-array-indices
function getArrayIndexes(str: string) {
  let match;
  if ((match = str.match(/^([^[]+)\s*(\[\s*([\d\:]+)\s*\]\s*)+\s*$/))) {
    const variable = match[1],
      indexes = [];
    const re = /\[\s*([\d\:]+)\s*\]/g;

    while ((match = re.exec(str))) {
      indexes.push(match[1]);
    }
    return { variable, indexes };
  } else {
    return { variable: null, indexes: null };
  }
}

function getSubArray(arr: any[], substr: string) {
  const [start, end] = substr.split(":");
  return arr.slice(+start, +end);
}
