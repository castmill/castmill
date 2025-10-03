#!/usr/bin/env node
/**
 * Merge new translation keys from en.json into other locale files
 * Preserves existing translations and only adds missing keys (using English as fallback)
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/i18n/locales');
const enPath = path.join(localesDir, 'en.json');
const locales = ['es', 'sv', 'de', 'fr', 'zh', 'ar', 'ko', 'ja'];

// Read English translations (source of truth for structure)
const enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf8'));

/**
 * Deep merge: add missing keys from source to target, keep existing target values
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        // Recursively merge objects
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else if (!(key in result)) {
        // Add missing key with English value as fallback
        result[key] = source[key];
      }
      // Keep existing translation if key already exists
    }
  }
  
  return result;
}

// Process each locale
locales.forEach(locale => {
  const localePath = path.join(localesDir, `${locale}.json`);
  
  try {
    // Read existing translations
    const existingTranslations = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    
    // Merge with English (adds missing keys, preserves existing translations)
    const mergedTranslations = deepMerge(existingTranslations, enTranslations);
    
    // Write back
    fs.writeFileSync(localePath, JSON.stringify(mergedTranslations, null, 2) + '\n', 'utf8');
    
    console.log(`✅ ${locale}.json - merged successfully`);
  } catch (error) {
    console.error(`❌ ${locale}.json - error:`, error.message);
  }
});

console.log('\n✨ All locale files updated!');
