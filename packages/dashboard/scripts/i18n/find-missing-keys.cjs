#!/usr/bin/env node

/**
 * Find Missing Translation Keys
 *
 * This script scans the codebase for translation key usage (t(), tp(), etc.)
 * and checks if those keys exist in the English translation file.
 *
 * Usage:
 *   node scripts/i18n/find-missing-keys.cjs
 *
 * This helps identify:
 * - Translation keys used in code but not defined in en.json
 * - Typos or incorrect translation key references
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

const LOCALES_DIR = path.join(__dirname, '../../src/i18n/locales');
const SRC_DIR = path.join(__dirname, '../../src');

/**
 * Load English translation file
 */
function loadEnglishTranslations() {
  const filePath = path.join(LOCALES_DIR, 'en.json');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading en.json:${colors.reset}`, error.message);
    process.exit(1);
  }
}

/**
 * Flatten nested JSON object into dot-notation keys
 */
function flattenObject(obj, prefix = '') {
  const flattened = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value, fullKey));
    } else {
      flattened[fullKey] = value;
    }
  }

  return flattened;
}

/**
 * Extract translation keys from source code
 */
function extractKeysFromCode() {
  const keys = new Set();
  
  // Recursively scan all .ts and .tsx files
  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and other build directories
        if (!['node_modules', 'dist', 'build', '.next'].includes(entry.name)) {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        scanFile(fullPath);
      }
    }
  }
  
  function scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Match patterns: t('key'), t("key"), tp('key'), tp("key")
      // Also handle multiline and template strings
      const patterns = [
        /\bt\(['"]([^'"]+)['"]/g,
        /\bt\("([^"]+)"\)/g,
        /\btp\(['"]([^'"]+)['"]/g,
        /\btp\("([^"]+)"\)/g,
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const key = match[1];
          // Ignore keys with template literals ${...}
          if (!key.includes('${') && !key.includes('`')) {
            keys.add(key);
          }
        }
      }
    } catch (error) {
      // Skip files that can't be read
      console.error(`${colors.gray}Warning: Could not read ${filePath}${colors.reset}`);
    }
  }
  
  scanDirectory(SRC_DIR);
  return keys;
}

/**
 * Group keys by namespace
 */
function groupByNamespace(keys) {
  const grouped = {};

  for (const key of keys) {
    const namespace = key.split('.')[0];
    if (!grouped[namespace]) {
      grouped[namespace] = [];
    }
    grouped[namespace].push(key);
  }

  return grouped;
}

/**
 * Main execution
 */
function main() {
  console.log(`${colors.cyan}${colors.bold}Finding Missing Translation Keys${colors.reset}`);
  console.log(`Scanning source code for translation key usage...\n`);

  // Load English translations
  const englishData = loadEnglishTranslations();
  const englishKeys = flattenObject(englishData);
  const englishKeySet = new Set(Object.keys(englishKeys));

  console.log(`${colors.blue}English translation keys:${colors.reset} ${englishKeySet.size}`);

  // Extract keys used in code
  const usedKeys = extractKeysFromCode();
  console.log(`${colors.blue}Translation keys found in code:${colors.reset} ${usedKeys.size}\n`);

  // Find missing keys (used in code but not in en.json)
  const missingKeys = [];
  for (const key of usedKeys) {
    if (!englishKeySet.has(key)) {
      missingKeys.push(key);
    }
  }

  // Find unused keys (in en.json but not used in code)
  const unusedKeys = [];
  for (const key of englishKeySet) {
    if (!usedKeys.has(key)) {
      unusedKeys.push(key);
    }
  }

  // Report missing keys
  if (missingKeys.length > 0) {
    const grouped = groupByNamespace(missingKeys);
    console.log(`${colors.red}${colors.bold}MISSING KEYS (used in code but not in en.json):${colors.reset}`);
    console.log(`${colors.red}Total: ${missingKeys.length}${colors.reset}\n`);

    for (const [namespace, keys] of Object.entries(grouped)) {
      console.log(`${colors.bold}${namespace}${colors.reset} (${keys.length} missing):`);
      for (const key of keys.sort()) {
        console.log(`  ${colors.red}✗${colors.reset} ${colors.gray}${key}${colors.reset}`);
      }
      console.log('');
    }
  } else {
    console.log(`${colors.green}✓ All keys used in code exist in en.json${colors.reset}\n`);
  }

  // Report unused keys (optional, for cleanup)
  if (unusedKeys.length > 0) {
    console.log(`${colors.yellow}${colors.bold}POTENTIALLY UNUSED KEYS (in en.json but not found in code):${colors.reset}`);
    console.log(`${colors.yellow}Note: These might be used in addons or dynamically constructed keys${colors.reset}`);
    console.log(`${colors.yellow}Total: ${unusedKeys.length}${colors.reset}\n`);
    
    if (unusedKeys.length <= 20) {
      const grouped = groupByNamespace(unusedKeys);
      for (const [namespace, keys] of Object.entries(grouped)) {
        console.log(`${colors.bold}${namespace}${colors.reset} (${keys.length} unused):`);
        for (const key of keys.sort().slice(0, 10)) {
          console.log(`  ${colors.yellow}⚠${colors.reset} ${colors.gray}${key}${colors.reset}`);
        }
        if (keys.length > 10) {
          console.log(`  ${colors.gray}... and ${keys.length - 10} more${colors.reset}`);
        }
        console.log('');
      }
    } else {
      console.log(`  ${colors.gray}Run with --verbose to see all unused keys${colors.reset}\n`);
    }
  }

  // Exit with error if missing keys found
  if (missingKeys.length > 0) {
    console.log(`${colors.red}${colors.bold}❌ Found ${missingKeys.length} missing translation key(s)${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✅ No missing translation keys found${colors.reset}\n`);
    process.exit(0);
  }
}

main();
