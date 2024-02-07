/**
 * Utility class that provides formatting capabilities to the templates.
 *
 */

/**
 * Example:
 * binding: "model.house.price | formatNumber($val, ',', '.') | formatString('%s Kr.')"
 *
 */

class Formatters {
  static formatNumber(input: number): string {
    return `${input}`
  }
}
