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
   * Suported keypaths:
   * - "foo.bar"
   * - "foo.bar[0][2]"
   * - "foo.bar[0]2].baz[3:4]"
   * - "foo.bar[0]2].baz[:4]"
   * - "foo.bar[0]2].baz[4:]"
   * - "foo.bar[0]2].baz[@index]" (where index is a global variable)
   * - "foo.bar[0]2].baz[str]" (where str is a plain string)
   *
   * @param obj object where we want to extract a value based on a keypath.
   *
   * @param keypath string with the keypath pointing to our value.
   * @returns
   */
  static get(obj: any, keypath: string, globals?: { [index: string]: any }) {
    const keys = keypath.split('.');
    let error;

    for (const key of keys) {
      // Check for null/undefined before attempting any property access
      if (obj === null || obj === undefined) {
        error = new Error(`Invalid key path: ${keypath}`);
        break;
      }

      let { variable, indexes } = getArrayIndexes(key);
      if (variable && indexes) {
        let array = obj[variable];

        for (let i = 0; i < indexes.length; i++) {
          if (!Array.isArray(array) && typeof array !== 'object') {
            error = new Error(`${variable} as ${keypath} is not an array`);
            break;
          }
          if (indexes[i].includes(':')) {
            array = getSubArray(array, indexes[i], globals);
          } else if (indexes[i].startsWith('@')) {
            const globalKey = indexes[i].slice(1) as string | number;
            if (globals && globalKey in globals) {
              array = array[globals[globalKey]]; // This will work for both object and array
              if (array === undefined) {
                error = new Error(
                  `Invalid global index: ${globals[globalKey]}`
                );
                break;
              }
            } else {
              error = new Error(`Global key not found: ${globalKey}`);
              break;
            }
          } else {
            array = array[+indexes[i]];
            if (array === undefined) {
              error = new Error(`Invalid index: ${indexes[i]}`);
              break;
            }
          }
        }

        obj = array;
      } else {
        if (obj === null || obj === undefined || obj[key] === undefined) {
          error = new Error(`Invalid key path: ${keypath}`);
          break;
        }
        obj = obj[key];
      }
    }
    return [!error ? obj : void 0, error];
  }
}

function getArrayIndexes(str: string) {
  let match;
  const rePattern = /^([^\[]+)((?:\[\s*(?:[\d:]+|@\w+)\s*\])+)$/;

  if ((match = str.match(rePattern))) {
    const variable = match[1],
      indexes = [];
    // Updated regex to capture @index correctly
    const re = /\[\s*([\d\:]+|@\w+)\s*\]/g;

    while ((match = re.exec(str))) {
      indexes.push(match[1]);
    }
    return { variable, indexes };
  } else {
    return { variable: null, indexes: null };
  }
}

function getSubArray(
  arr: any[],
  substr: string,
  globals?: { [index: string]: any }
) {
  const [start, end] = substr
    .split(':')
    .map((e) => (e.startsWith('@') && globals ? globals[e.slice(1)] : +e));
  return arr.slice(start, end);
}
