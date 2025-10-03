#!/usr/bin/env node

/**
 * I18n Localization Checker
 * 
 * This script scans TypeScript/TSX files for hardcoded strings that should be localized.
 * It helps identify strings that aren't using the t() translation function.
 * 
 * Usage:
 *   node scripts/check-i18n.js [--fix]
 * 
 * Options:
 *   --fix  Attempt to auto-fix some issues (dry run for now)
 * 
 * The script checks for:
 * - String literals in JSX text nodes
 * - String literals in common props (label, title, description, message, placeholder)
 * - Alert/console messages with hardcoded strings
 * 
 * It ignores:
 * - Test files
 * - Strings that are likely technical (URLs, keys, IDs, etc.)
 * - Strings already wrapped in t()
 * - Import/export statements
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const config = {
  srcDir: path.join(__dirname, '../src'),
  excludePatterns: [
    '**/node_modules/**',
    '**/*.test.tsx',
    '**/*.test.ts',
    '**/*.spec.tsx',
    '**/*.spec.ts',
    '**/i18n/**', // Don't check i18n files themselves
  ],
  // Props that commonly contain user-facing text
  textProps: ['label', 'title', 'description', 'message', 'placeholder', 'text', 'name'],
  // Technical patterns to ignore
  ignorePatterns: [
    /^[a-z_]+$/i, // Single words that might be keys
    /^#[0-9a-f]{3,6}$/i, // Hex colors
    /^https?:\/\//i, // URLs
    /^\//i, // Paths starting with /
    /^[A-Z_]+$/, // Constants
    /^\$\{.*\}$/, // Template variable references
    /^data-/i, // Data attributes
    /^aria-/i, // ARIA attributes
    /^class$/i, // Class names
    /^style$/i, // Style attributes
    /^key$/i, // React keys
    /^ref$/i, // Refs
    /^id$/i, // IDs
    /^type$/i, // Type attributes
  ],
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

class I18nChecker {
  constructor() {
    this.issues = [];
    this.stats = {
      filesScanned: 0,
      issuesFound: 0,
      warnings: 0,
      errors: 0,
    };
  }

  /**
   * Check if a string should be ignored
   */
  shouldIgnore(str) {
    if (!str || str.trim().length === 0) return true;
    if (str.length < 2) return true; // Single characters
    if (/^\d+$/.test(str)) return true; // Pure numbers
    if (/^[^a-zA-Z]*$/.test(str)) return true; // No letters (punctuation, symbols)
    
    // Skip specific strings user doesn't want translated
    const skipStrings = ['Privacy Policy', 'Terms', 'Privacy', 'Contact'];
    if (skipStrings.includes(str)) return true;
    
    for (const pattern of config.ignorePatterns) {
      if (pattern.test(str)) return true;
    }
    
    return false;
  }

  /**
   * Extract string literals from JSX text content
   */
  findJSXTextNodes(content, filePath) {
    // Match text between JSX tags: >text here<
    // But be more careful to avoid matching code
    const jsxTextRegex = />([^<>{}]+)</g;
    let match;
    
    while ((match = jsxTextRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (this.shouldIgnore(text)) continue;
      
      // Skip if contains code-like patterns
      if (/[(){};=]/.test(text)) continue;
      if (/^\s*$/.test(text)) continue;
      if (text.includes('\n')) continue; // Multi-line - likely code
      
      // Must have at least one complete word
      if (!/\b[a-zA-Z]{2,}\b/.test(text)) continue;
      
      // Check if it's wrapped in t()
      const beforeMatch = content.substring(Math.max(0, match.index - 20), match.index);
      if (/\{t\(['"'][^'"']*['"']\)\}$/.test(beforeMatch)) continue;
      
      // Get line number
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      this.addIssue({
        type: 'jsx-text',
        severity: 'error',
        file: filePath,
        line: lineNumber,
        text: text,
        message: 'Hardcoded text in JSX should use t() function',
        suggestion: `{t('your.key.here')}`,
      });
    }
  }

  /**
   * Extract string literals from prop assignments
   */
  findPropsWithStrings(content, filePath) {
    // Match prop assignments with string literals
    for (const prop of config.textProps) {
      // Match both:
      // 1. prop="string" or prop='string'
      // 2. prop={"string"} or prop={'string'}
      const patterns = [
        new RegExp(`${prop}=["']([^"']+)["']`, 'g'),
        new RegExp(`${prop}=\\{["']([^"']+)["']\\}`, 'g'),
      ];
      
      for (const propRegex of patterns) {
        let match;
        
        while ((match = propRegex.exec(content)) !== null) {
          const text = match[1];
          if (this.shouldIgnore(text)) continue;
          
          // Check if the string looks like a translation key
          if (text.includes('.') && /^[a-z]+\.[a-z.]+$/i.test(text)) continue;
          
          // Get line number
          const lineNumber = content.substring(0, match.index).split('\n').length;
          
          this.addIssue({
            type: 'prop-string',
            severity: 'error',
            file: filePath,
            line: lineNumber,
            prop: prop,
            text: text,
            message: `Hardcoded string in "${prop}" prop should use t() function`,
            suggestion: `${prop}={t('your.key.here')}`,
          });
        }
      }
    }
  }

  /**
   * Find alert() and console messages with hardcoded strings
   */
  findAlertMessages(content, filePath) {
    // Match alert('string') or alert("string") or alert(`string`)
    const alertRegex = /alert\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let match;
    
    while ((match = alertRegex.exec(content)) !== null) {
      const text = match[1];
      if (this.shouldIgnore(text)) continue;
      
      // Check if it looks like a template string with variables
      if (text.includes('${')) continue;
      
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      this.addIssue({
        type: 'alert-message',
        severity: 'warning',
        file: filePath,
        line: lineNumber,
        text: text,
        message: 'Alert message should be localized',
        suggestion: `alert(t('your.error.key'))`,
      });
    }
    
    // Also check for template literals in alerts
    const alertTemplateRegex = /alert\s*\(\s*`([^`]+)`\s*\)/g;
    while ((match = alertTemplateRegex.exec(content)) !== null) {
      const text = match[1];
      // Only flag if it doesn't use t() inside
      if (!text.includes('t(')) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        this.addIssue({
          type: 'alert-template',
          severity: 'warning',
          file: filePath,
          line: lineNumber,
          text: text,
          message: 'Alert message with template literal should use t() with params',
          suggestion: `alert(t('your.error.key', { param: value }))`,
        });
      }
    }
  }

  /**
   * Find column definitions with hardcoded titles
   */
  findTableColumns(content, filePath) {
    // Match title: 'string' or title: "string" in column definitions
    const columnRegex = /title:\s*['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = columnRegex.exec(content)) !== null) {
      const text = match[1];
      if (this.shouldIgnore(text)) continue;
      
      // Check if it's already using t()
      const beforeMatch = content.substring(Math.max(0, match.index - 20), match.index);
      if (/title:\s*t\(/.test(beforeMatch)) continue;
      
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      this.addIssue({
        type: 'column-title',
        severity: 'error',
        file: filePath,
        line: lineNumber,
        text: text,
        message: 'Table column title should use t() function',
        suggestion: `title: t('common.${text.toLowerCase()}')`,
      });
    }
  }

  /**
   * Add an issue to the list
   */
  addIssue(issue) {
    this.issues.push(issue);
    this.stats.issuesFound++;
    if (issue.severity === 'error') {
      this.stats.errors++;
    } else {
      this.stats.warnings++;
    }
  }

  /**
   * Scan a single file
   */
  scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(config.srcDir, filePath);
    
    // Skip if file doesn't use React/SolidJS JSX
    if (!content.includes('Component') && !content.includes('<')) return;
    
    // Skip if file already imports useI18n (likely already localized)
    // But still check for issues
    const hasI18n = content.includes('useI18n') || content.includes('props.store.i18n');
    
    this.findJSXTextNodes(content, relativePath);
    this.findPropsWithStrings(content, relativePath);
    this.findAlertMessages(content, relativePath);
    this.findTableColumns(content, relativePath);
    
    this.stats.filesScanned++;
  }

  /**
   * Scan all files in the source directory
   */
  scanAll() {
    console.log(`${colors.cyan}🔍 Scanning for localization issues...${colors.reset}\n`);
    
    const files = glob.sync('**/*.{ts,tsx}', {
      cwd: config.srcDir,
      ignore: config.excludePatterns,
      absolute: true,
    });
    
    files.forEach(file => this.scanFile(file));
  }

  /**
   * Group issues by file
   */
  groupByFile() {
    const grouped = {};
    for (const issue of this.issues) {
      if (!grouped[issue.file]) {
        grouped[issue.file] = [];
      }
      grouped[issue.file].push(issue);
    }
    return grouped;
  }

  /**
   * Print the report
   */
  printReport() {
    const grouped = this.groupByFile();
    const fileCount = Object.keys(grouped).length;
    
    if (this.issues.length === 0) {
      console.log(`${colors.green}✅ No localization issues found!${colors.reset}\n`);
      console.log(`Scanned ${this.stats.filesScanned} files.\n`);
      return;
    }
    
    console.log(`${colors.yellow}⚠️  Found ${this.stats.issuesFound} localization issues in ${fileCount} files${colors.reset}\n`);
    
    // Print issues grouped by file
    for (const [file, issues] of Object.entries(grouped)) {
      console.log(`${colors.blue}${file}${colors.reset}`);
      
      // Sort by line number
      issues.sort((a, b) => a.line - b.line);
      
      for (const issue of issues) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        const color = issue.severity === 'error' ? colors.red : colors.yellow;
        
        console.log(`  ${icon} ${colors.gray}Line ${issue.line}:${colors.reset} ${color}${issue.message}${colors.reset}`);
        console.log(`     ${colors.gray}Text: "${issue.text}"${colors.reset}`);
        console.log(`     ${colors.green}Fix:  ${issue.suggestion}${colors.reset}`);
        console.log();
      }
    }
    
    // Print summary
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}Summary:${colors.reset}`);
    console.log(`  Files scanned: ${this.stats.filesScanned}`);
    console.log(`  ${colors.red}Errors:   ${this.stats.errors}${colors.reset}`);
    console.log(`  ${colors.yellow}Warnings: ${this.stats.warnings}${colors.reset}`);
    console.log(`  Total:    ${this.stats.issuesFound}`);
    console.log();
    
    // Exit with error code if there are errors
    if (this.stats.errors > 0) {
      process.exit(1);
    }
  }
}

// Main execution
const checker = new I18nChecker();
checker.scanAll();
checker.printReport();
