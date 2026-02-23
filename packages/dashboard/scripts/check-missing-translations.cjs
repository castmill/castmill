#!/usr/bin/env node

/**
 * Missing Translations Checker
 *
 * This script compares translation files against the English (en.json) reference
 * to identify missing translation keys in other languages.
 *
 * Usage:
 *   node scripts/check-missing-translations.cjs [language]
 *
 * Arguments:
 *   language  Optional. Check specific language (e.g., 'es', 'fr', 'de').
 *             If not provided, checks all languages.
 *
 * Examples:
 *   node scripts/check-missing-translations.cjs       # Check all languages
 *   node scripts/check-missing-translations.cjs es    # Check Spanish only
 *   node scripts/check-missing-translations.cjs de    # Check German only
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const REFERENCE_LANG = 'en';

// All supported languages
const LANGUAGES = ['es', 'sv', 'de', 'fr', 'zh', 'ar', 'ko', 'ja'];

// Strings that are acceptable to be identical across languages
// (cognates, proper nouns, technical terms, abbreviations)
// Technical terms, proper nouns, and universal strings that are identical across languages
const ALLOWED_IDENTICAL_STRINGS = new Set([
  'Widgets',
  'Widget',
  'JSON',
  'URL',
  'Cache',
  'WiFi',
  'Passkeys',
  'Passkey',
  'ID',
  'OAuth 2.0',
  'Webhook',
  'Data', // Loanword in Swedish, German
  'Media', // Loanword in Swedish, German, French
  'Code', // Loanword in German, French
  'Info', // Loanword in Swedish, German, French
  '© 2011-2025 Castmill™',
  'Error', // Cognate in Spanish
  'Total', // Cognate in Spanish
  'Status', // Cognate in Swedish, German, French
  'Version', // Cognate in Swedish, German, French
  'Online', // Cognate in Swedish, German, French
  'Offline', // Cognate in Swedish, German
  'Team "{{name}}"', // Cognate in Swedish
  'Name', // Cognate in German
  'Details', // Cognate in German
  'Teams', // Cognate in German
  'Tags', // Cognate in German
  'Playlists', // Cognate in German
  'Playlist "{{name}}"', // Cognate in German
  'Type', // Cognate in French
  'Actions', // Cognate in French
  'Message', // Cognate in French
  'Description', // Cognate in French
  'Maintenance', // Cognate in French
  'Notifications', // Cognate in French
  'Invitations', // Cognate in French
  'Navigation', // Cognate in French
  '9:16 (Portrait)', // Cognate in French
  '3:4 (Portrait)', // Cognate in French
  'Contact', // Cognate in French
  'Administrator', // Cognate in German
  // Time unit abbreviations - internationally recognized
  'd', // days short
  'h', // hours short
  'm', // minutes short
  // Social media URLs and placeholders - intentionally identical
  'GitHub URL',
  'X (Twitter) URL',
  'LinkedIn URL',
  'Facebook URL',
  'support@example.com',
  'https://example.com/logo.png',
  'https://example.com/privacy',
  'https://github.com/yourcompany',
  'https://x.com/yourcompany',
  'https://linkedin.com/company/yourcompany',
  'https://facebook.com/yourcompany',
]);

class TranslationChecker {
  constructor() {
    this.issues = [];
    this.totalMissing = 0;
    this.stats = {
      filesScanned: 0,
      issuesFound: 0,
      warnings: 0,
      errors: 0,
    };
  }

  /**
   * Check if a string is allowed to be identical between languages
   */
  isAllowedIdentical(str) {
    if (!str) return false;

    for (const allowed of ALLOWED_IDENTICAL_STRINGS) {
      if (allowed instanceof RegExp) {
        if (allowed.test(str)) return true;
      } else {
        if (allowed === str) return true;
      }
    }

    return false;
  }

  /**
   * Check if a string uses non-Latin script (CJK, Arabic, Cyrillic)
   */
  usesNonLatinScript(str) {
    if (!str) return false;

    // Chinese, Japanese, Korean
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(str)) {
      return true;
    }

    // Arabic, Hebrew
    if (/[\u0600-\u06FF\u0590-\u05FF]/.test(str)) {
      return true;
    }

    // Cyrillic (Russian, etc.)
    if (/[\u0400-\u04FF]/.test(str)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a translation is properly translated for the target language
   */
  isProperlyTranslated(englishValue, translatedValue, targetLang) {
    // If values are different, it's translated
    if (englishValue !== translatedValue) {
      return true;
    }

    // Check if it's an allowed cognate/proper noun/technical term FIRST
    // (applies to ALL languages including non-Latin)
    if (this.isAllowedIdentical(englishValue)) {
      return true;
    }

    // For non-Latin script languages (Chinese, Arabic, Korean, Japanese),
    // the translation MUST use non-Latin characters
    const nonLatinLanguages = ['zh', 'ar', 'ko', 'ja'];
    if (nonLatinLanguages.includes(targetLang)) {
      return this.usesNonLatinScript(translatedValue);
    }

    // For Latin-based languages, it's already been checked above
    return false;
  }

  /**
   * Load a JSON translation file
   */
  loadTranslationFile(lang) {
    const filePath = path.join(LOCALES_DIR, `${lang}.json`);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(
        `${colors.red}Error loading ${lang}.json:${colors.reset}`,
        error.message
      );
      return null;
    }
  }

  /**
   * Flatten nested JSON object into dot-notation keys
   * e.g., { common: { save: "Save" } } -> { "common.save": "Save" }
   */
  flattenObject(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        // Recursively flatten nested objects
        Object.assign(flattened, this.flattenObject(value, fullKey));
      } else {
        flattened[fullKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Compare two flattened translation objects
   */
  findMissingKeys(reference, target, lang) {
    const missing = [];
    const untranslated = [];
    const referenceKeys = Object.keys(reference);

    for (const key of referenceKeys) {
      if (!(key in target)) {
        // Key doesn't exist at all
        missing.push({
          key,
          value: reference[key],
          type: 'missing',
        });
      } else if (
        reference[key] === target[key] &&
        typeof reference[key] === 'string'
      ) {
        // Key exists but value is identical to English
        // Use hybrid validation: character set detection + allowlist
        if (!this.isProperlyTranslated(reference[key], target[key], lang)) {
          untranslated.push({
            key,
            value: reference[key],
            type: 'untranslated',
          });
        }
      }
    }

    return { missing, untranslated };
  }

  /**
   * Group missing keys by namespace (top-level key)
   */
  groupByNamespace(keys) {
    const grouped = {};

    for (const item of keys) {
      const namespace = item.key.split('.')[0];
      if (!grouped[namespace]) {
        grouped[namespace] = [];
      }
      grouped[namespace].push(item);
    }

    return grouped;
  }

  /**
   * Check a specific language against English reference
   */
  checkLanguage(lang) {
    const reference = this.loadTranslationFile(REFERENCE_LANG);
    const target = this.loadTranslationFile(lang);

    if (!reference || !target) {
      return null;
    }

    const flatReference = this.flattenObject(reference);
    const flatTarget = this.flattenObject(target);

    const { missing, untranslated } = this.findMissingKeys(
      flatReference,
      flatTarget,
      lang
    );
    const totalIssues = missing.length + untranslated.length;

    return {
      lang,
      totalKeys: Object.keys(flatReference).length,
      translatedKeys: Object.keys(flatTarget).length - untranslated.length,
      missingKeys: missing,
      untranslatedKeys: untranslated,
      missingCount: missing.length,
      untranslatedCount: untranslated.length,
      totalIssues,
      coverage: (
        ((Object.keys(flatTarget).length - untranslated.length) /
          Object.keys(flatReference).length) *
        100
      ).toFixed(1),
    };
  }

  /**
   * Print results for a single language
   */
  printLanguageReport(result) {
    const {
      lang,
      totalKeys,
      translatedKeys,
      missingKeys,
      untranslatedKeys,
      missingCount,
      untranslatedCount,
      totalIssues,
      coverage,
    } = result;

    console.log(`\n${'='.repeat(70)}`);
    console.log(
      `${colors.bold}${colors.cyan}Language: ${lang.toUpperCase()}${colors.reset}`
    );
    console.log(`${'='.repeat(70)}`);

    console.log(
      `${colors.blue}Coverage:${colors.reset} ${coverage}% (${translatedKeys}/${totalKeys} keys)`
    );

    if (totalIssues === 0) {
      console.log(`${colors.green}✓ All translations complete!${colors.reset}`);
      return;
    }

    if (missingCount > 0) {
      console.log(
        `${colors.red}Missing:${colors.reset} ${missingCount} keys (keys don't exist)`
      );
    }
    if (untranslatedCount > 0) {
      console.log(
        `${colors.yellow}Untranslated:${colors.reset} ${untranslatedCount} keys (same as English)`
      );
    }
    console.log('');

    // Show missing keys first
    if (missingKeys.length > 0) {
      const grouped = this.groupByNamespace(missingKeys);
      console.log(`${colors.bold}${colors.red}MISSING KEYS:${colors.reset}`);

      for (const [namespace, keys] of Object.entries(grouped)) {
        console.log(
          `${colors.bold}${namespace}${colors.reset} (${keys.length} missing):`
        );

        for (const { key, value } of keys) {
          console.log(
            `  ${colors.red}✗${colors.reset} ${colors.gray}${key}${colors.reset}`
          );
          console.log(`    ${colors.gray}English: "${value}"${colors.reset}`);
        }
        console.log('');
      }
    }

    // Show untranslated keys
    if (untranslatedKeys.length > 0) {
      const grouped = this.groupByNamespace(untranslatedKeys);
      console.log(
        `${colors.bold}${colors.yellow}UNTRANSLATED KEYS (same as English):${colors.reset}`
      );

      for (const [namespace, keys] of Object.entries(grouped)) {
        console.log(
          `${colors.bold}${namespace}${colors.reset} (${keys.length} untranslated):`
        );

        for (const { key, value } of keys) {
          console.log(
            `  ${colors.yellow}⚠${colors.reset} ${colors.gray}${key}${colors.reset}`
          );
          console.log(`    ${colors.gray}English: "${value}"${colors.reset}`);
        }
        console.log('');
      }
    }
  }

  /**
   * Print summary for all languages
   */
  printSummary(results) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${colors.bold}${colors.cyan}SUMMARY${colors.reset}`);
    console.log(`${'='.repeat(70)}\n`);

    console.log(
      `${colors.bold}Language    Coverage    Missing    Untranslated    Status${colors.reset}`
    );
    console.log(`${'-'.repeat(70)}`);

    let allComplete = true;

    for (const result of results) {
      if (!result) continue;

      const { lang, coverage, missingCount, untranslatedCount, totalIssues } =
        result;
      const status =
        totalIssues === 0
          ? `${colors.green}✓ Complete${colors.reset}`
          : `${colors.yellow}⚠ Incomplete${colors.reset}`;

      console.log(
        `${lang.toUpperCase().padEnd(12)}` +
          `${coverage}%`.padEnd(12) +
          `${missingCount}`.padEnd(11) +
          `${untranslatedCount}`.padEnd(16) +
          `${status}`
      );

      if (totalIssues > 0) {
        allComplete = false;
        this.totalMissing += totalIssues;
      }
    }

    console.log(`${'='.repeat(70)}\n`);

    if (allComplete) {
      console.log(
        `${colors.green}${colors.bold}🎉 All languages are fully translated!${colors.reset}\n`
      );
      return 0;
    } else {
      console.log(
        `${colors.yellow}${colors.bold}⚠ Total issues (missing + untranslated): ${this.totalMissing}${colors.reset}\n`
      );
      return 1;
    }
  }

  /**
   * Run the checker
   */
  run(targetLang = null) {
    console.log(
      `${colors.cyan}${colors.bold}Missing Translations Checker${colors.reset}`
    );
    console.log(
      `Checking against reference: ${colors.green}${REFERENCE_LANG}.json${colors.reset}\n`
    );

    const languagesToCheck = targetLang ? [targetLang] : LANGUAGES;
    const results = [];

    for (const lang of languagesToCheck) {
      const result = this.checkLanguage(lang);
      if (result) {
        results.push(result);
        if (targetLang) {
          // If checking single language, show detailed report
          this.printLanguageReport(result);
        }
      }
    }

    // Always show summary
    const exitCode = this.printSummary(results);

    return exitCode;
  }
}

// Main execution
const targetLang = process.argv[2];

if (targetLang && !LANGUAGES.includes(targetLang)) {
  console.error(
    `${colors.red}Error: Invalid language "${targetLang}"${colors.reset}`
  );
  console.error(`Supported languages: ${LANGUAGES.join(', ')}`);
  process.exit(1);
}

const checker = new TranslationChecker();
const exitCode = checker.run(targetLang);

process.exit(exitCode);
