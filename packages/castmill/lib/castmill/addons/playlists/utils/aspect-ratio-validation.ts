/**
 * Shared aspect ratio validation utilities for playlists
 */

import {
  MAX_ASPECT_RATIO_VALUE,
  MAX_ASPECT_RATIO,
  MIN_ASPECT_RATIO,
} from '../constants';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

/**
 * Validates a single custom ratio field (width or height)
 * @param field - The field name ('width' or 'height')
 * @param value - The value to validate
 * @param t - Translation function
 * @param errors - Current errors map
 * @returns Updated errors map
 */
export function validateCustomRatioField(
  field: string,
  value: string,
  t: TranslateFn,
  errors: Map<string, string>
): Map<string, string> {
  const newErrors = new Map(errors);
  const num = parseInt(value, 10);

  if (!value || isNaN(num)) {
    newErrors.set(field, t('playlists.errors.aspectRatioNumber'));
  } else if (num <= 0) {
    newErrors.set(field, t('playlists.errors.aspectRatioPositive'));
  } else if (num > MAX_ASPECT_RATIO_VALUE) {
    newErrors.set(field, t('playlists.errors.aspectRatioMax'));
  } else {
    newErrors.delete(field);
  }

  return newErrors;
}

/**
 * Validates that the aspect ratio is not too extreme
 * @param width - Width value (as string)
 * @param height - Height value (as string)
 * @param t - Translation function
 * @param errors - Current errors map
 * @returns Object with isValid flag and updated errors map
 */
export function validateAspectRatioExtreme(
  width: string,
  height: string,
  t: TranslateFn,
  errors: Map<string, string>
): { isValid: boolean; errors: Map<string, string> } {
  const newErrors = new Map(errors);
  const widthNum = parseInt(width, 10);
  const heightNum = parseInt(height, 10);

  if (!isNaN(widthNum) && !isNaN(heightNum) && widthNum > 0 && heightNum > 0) {
    const ratio = widthNum / heightNum;
    if (ratio > MAX_ASPECT_RATIO || ratio < MIN_ASPECT_RATIO) {
      newErrors.set('aspectRatio', t('playlists.errors.aspectRatioExtreme'));
      return { isValid: false, errors: newErrors };
    } else {
      newErrors.delete('aspectRatio');
      return { isValid: true, errors: newErrors };
    }
  }

  newErrors.delete('aspectRatio');
  return { isValid: true, errors: newErrors };
}

/**
 * Checks if an aspect ratio is valid (for form validation)
 * @param width - Width value (as string)
 * @param height - Height value (as string)
 * @returns True if the aspect ratio is valid
 */
export function isValidAspectRatio(width: string, height: string): boolean {
  const widthNum = parseInt(width, 10);
  const heightNum = parseInt(height, 10);

  if (isNaN(widthNum) || isNaN(heightNum) || widthNum <= 0 || heightNum <= 0) {
    return false;
  }

  if (widthNum > MAX_ASPECT_RATIO_VALUE || heightNum > MAX_ASPECT_RATIO_VALUE) {
    return false;
  }

  const ratio = widthNum / heightNum;
  return ratio <= MAX_ASPECT_RATIO && ratio >= MIN_ASPECT_RATIO;
}
