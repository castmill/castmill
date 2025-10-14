#!/usr/bin/env node

/**
 * Translation Helper Tool for Castmill Dashboard
 *
 * This utility helps manage translations across all supported languages.
 *
 * Usage:
 *   node scripts/i18n/translation-helper.js add <section> <key> <english-text>
 *   node scripts/i18n/translation-helper.js check
 *   node scripts/i18n/translation-helper.js sync
 *   node scripts/i18n/translation-helper.js list <section>
 *
 * Examples:
 *   node scripts/i18n/translation-helper.js add teams.invitation title "Team Invitation"
 *   node scripts/i18n/translation-helper.js check
 *   node scripts/i18n/translation-helper.js sync
 *   node scripts/i18n/translation-helper.js list teams
 */

const fs = require('fs');
const path = require('path');

// Supported languages with their native names
const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English' },
  es: { name: 'Spanish', nativeName: 'Español' },
  sv: { name: 'Swedish', nativeName: 'Svenska' },
  de: { name: 'German', nativeName: 'Deutsch' },
  fr: { name: 'French', nativeName: 'Français' },
  zh: { name: 'Chinese', nativeName: '中文' },
  ar: { name: 'Arabic', nativeName: 'العربية' },
  ko: { name: 'Korean', nativeName: '한국어' },
  ja: { name: 'Japanese', nativeName: '日本語' },
};

const LOCALES_DIR = path.join(__dirname, '../../src/i18n/locales');

// AI-powered translation suggestions (placeholder - replace with actual API if needed)
const AUTO_TRANSLATIONS = {
  es: (text) => `[ES] ${text}`, // Spanish
  sv: (text) => `[SV] ${text}`, // Swedish
  de: (text) => `[DE] ${text}`, // German
  fr: (text) => `[FR] ${text}`, // French
  zh: (text) => `[ZH] ${text}`, // Chinese
  ar: (text) => `[AR] ${text}`, // Arabic
  ko: (text) => `[KO] ${text}`, // Korean
  ja: (text) => `[JA] ${text}`, // Japanese
};

/**
 * Load a translation file
 */
function loadTranslationFile(langCode) {
  const filePath = path.join(LOCALES_DIR, `${langCode}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error loading ${langCode}.json:`, error.message);
    return null;
  }
}

/**
 * Save a translation file
 */
function saveTranslationFile(langCode, data) {
  const filePath = path.join(LOCALES_DIR, `${langCode}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return true;
  } catch (error) {
    console.error(`❌ Error saving ${langCode}.json:`, error.message);
    return false;
  }
}

/**
 * Get nested value from object by path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested value in object by path
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Add a new translation key to all language files
 */
function addTranslation(section, key, englishText) {
  const fullKey = `${section}.${key}`;
  console.log(`\n📝 Adding translation key: ${fullKey}`);
  console.log(`   English text: "${englishText}"\n`);

  let successCount = 0;

  for (const langCode of Object.keys(SUPPORTED_LANGUAGES)) {
    const data = loadTranslationFile(langCode);
    if (!data) continue;

    // Check if key already exists
    const existing = getNestedValue(data, fullKey);
    if (existing) {
      console.log(`⚠️  ${langCode}.json: Key already exists, skipping`);
      continue;
    }

    // Add the translation
    const translation =
      langCode === 'en' ? englishText : `[TODO: Translate] ${englishText}`;

    setNestedValue(data, fullKey, translation);

    if (saveTranslationFile(langCode, data)) {
      console.log(`✅ ${langCode}.json: Added "${translation}"`);
      successCount++;
    }
  }

  console.log(
    `\n✨ Successfully added translation to ${successCount}/${Object.keys(SUPPORTED_LANGUAGES).length} files\n`
  );
  console.log(
    `⚠️  Remember to translate the [TODO] placeholders in non-English files!\n`
  );
}

/**
 * Check for missing translations
 */
function checkTranslations() {
  console.log('\n🔍 Checking for missing translations...\n');

  const baseData = loadTranslationFile('en');
  if (!baseData) {
    console.error('❌ Could not load base language file (en.json)');
    return;
  }

  const issues = [];

  // Check each language against English
  for (const langCode of Object.keys(SUPPORTED_LANGUAGES)) {
    if (langCode === 'en') continue;

    const langData = loadTranslationFile(langCode);
    if (!langData) continue;

    const missing = findMissingKeys(baseData, langData, '');
    const untranslated = findUntranslatedKeys(langData, '');

    if (missing.length > 0 || untranslated.length > 0) {
      issues.push({ langCode, missing, untranslated });
    }
  }

  if (issues.length === 0) {
    console.log('✅ All translations are complete!\n');
    return;
  }

  // Report issues
  for (const { langCode, missing, untranslated } of issues) {
    const lang = SUPPORTED_LANGUAGES[langCode];
    console.log(`\n📋 ${lang.name} (${langCode}.json):`);

    if (missing.length > 0) {
      console.log(`   ❌ Missing keys (${missing.length}):`);
      missing.slice(0, 10).forEach((key) => console.log(`      - ${key}`));
      if (missing.length > 10) {
        console.log(`      ... and ${missing.length - 10} more`);
      }
    }

    if (untranslated.length > 0) {
      console.log(`   ⚠️  Untranslated keys (${untranslated.length}):`);
      untranslated.slice(0, 10).forEach((key) => console.log(`      - ${key}`));
      if (untranslated.length > 10) {
        console.log(`      ... and ${untranslated.length - 10} more`);
      }
    }
  }

  console.log(
    '\n💡 Run `node scripts/i18n/translation-helper.js sync` to copy missing keys\n'
  );
}

/**
 * Find missing keys recursively
 */
function findMissingKeys(base, target, prefix) {
  const missing = [];

  for (const key in base) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof base[key] === 'object' && !Array.isArray(base[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        missing.push(fullKey);
      } else {
        missing.push(...findMissingKeys(base[key], target[key], fullKey));
      }
    } else {
      if (!(key in target)) {
        missing.push(fullKey);
      }
    }
  }

  return missing;
}

/**
 * Find untranslated keys (contains [TODO] markers)
 */
function findUntranslatedKeys(data, prefix) {
  const untranslated = [];

  for (const key in data) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = data[key];

    if (typeof value === 'object' && !Array.isArray(value)) {
      untranslated.push(...findUntranslatedKeys(value, fullKey));
    } else if (typeof value === 'string' && value.includes('[TODO')) {
      untranslated.push(fullKey);
    }
  }

  return untranslated;
}

/**
 * Sync missing keys from English to other languages
 */
function syncTranslations() {
  console.log('\n🔄 Syncing translations from English to other languages...\n');

  const baseData = loadTranslationFile('en');
  if (!baseData) {
    console.error('❌ Could not load base language file (en.json)');
    return;
  }

  let totalAdded = 0;

  for (const langCode of Object.keys(SUPPORTED_LANGUAGES)) {
    if (langCode === 'en') continue;

    const langData = loadTranslationFile(langCode);
    if (!langData) continue;

    const missing = findMissingKeys(baseData, langData, '');

    if (missing.length === 0) {
      console.log(`✅ ${langCode}.json: Already up to date`);
      continue;
    }

    // Add missing keys with TODO markers
    for (const key of missing) {
      const englishValue = getNestedValue(baseData, key);
      const todoValue =
        typeof englishValue === 'object'
          ? englishValue
          : `[TODO: Translate] ${englishValue}`;
      setNestedValue(langData, key, todoValue);
    }

    if (saveTranslationFile(langCode, langData)) {
      console.log(`✅ ${langCode}.json: Added ${missing.length} missing keys`);
      totalAdded += missing.length;
    }
  }

  console.log(`\n✨ Successfully synced ${totalAdded} translation keys\n`);
  console.log(`⚠️  Remember to translate the [TODO] placeholders!\n`);
}

/**
 * List all keys in a section
 */
function listSection(section) {
  console.log(`\n📋 Listing all keys in section: ${section}\n`);

  const data = loadTranslationFile('en');
  if (!data) return;

  const sectionData = getNestedValue(data, section);
  if (!sectionData) {
    console.log(`❌ Section "${section}" not found in English translations\n`);
    return;
  }

  function printKeys(obj, prefix = '') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];

      if (typeof value === 'object' && !Array.isArray(value)) {
        console.log(`  📁 ${fullKey}/`);
        printKeys(value, fullKey);
      } else {
        console.log(`  🔑 ${fullKey}: "${value}"`);
      }
    }
  }

  printKeys(sectionData, section);
  console.log();
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          Castmill Translation Helper Tool                     ║
╚═══════════════════════════════════════════════════════════════╝

Manage translations across all 9 supported languages:
  ${Object.values(SUPPORTED_LANGUAGES)
    .map((l) => l.nativeName)
    .join(', ')}

Commands:

  add <section.key> <english-text>
    Add a new translation key to all language files
    Example: node scripts/i18n/translation-helper.js add teams.invitation.title "Team Invitation"

  check
    Check for missing and untranslated keys
    Example: node scripts/i18n/translation-helper.js check

  sync
    Sync missing keys from English to other languages with [TODO] markers
    Example: node scripts/i18n/translation-helper.js sync

  list <section>
    List all translation keys in a specific section
    Example: node scripts/i18n/translation-helper.js list teams

  help
    Show this help message

Tips:
  • Always add translations to English first (base language)
  • Run 'check' regularly to find missing translations
  • Use 'sync' to copy structure from English with TODO markers
  • Update TODO markers with actual translations for each language

`);
}

// Main CLI handler
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'add': {
      const keyPath = args[1];
      const text = args.slice(2).join(' ');

      if (!keyPath || !text) {
        console.error('❌ Usage: add <section.key> <english-text>');
        process.exit(1);
      }

      const parts = keyPath.split('.');
      if (parts.length < 2) {
        console.error(
          '❌ Key must have at least section.key format (e.g., teams.title)'
        );
        process.exit(1);
      }

      const section = parts.slice(0, -1).join('.');
      const key = parts[parts.length - 1];
      addTranslation(section, key, text);
      break;
    }

    case 'check':
      checkTranslations();
      break;

    case 'sync':
      syncTranslations();
      break;

    case 'list': {
      const section = args[1];
      if (!section) {
        console.error('❌ Usage: list <section>');
        process.exit(1);
      }
      listSection(section);
      break;
    }

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      console.error(`❌ Unknown command: ${command}\n`);
      showHelp();
      process.exit(1);
  }
}

// Run the CLI
main();
