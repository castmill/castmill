# Dashboard Scripts

This directory contains utility scripts for the Dashboard package, primarily focused on i18n (internationalization) maintenance and validation.

## Available Scripts

### 1. check-i18n.cjs - Localization Checker

Ensures all user-facing strings in the Dashboard are properly localized using the i18n system.

#### Usage

```bash
# Run the checker
yarn check-i18n

# Or use the alias
yarn lint:i18n
```

#### What It Checks

The script scans all TypeScript/TSX files in `src/` and identifies:

1. **Hardcoded JSX text nodes** - Text between JSX tags that should use `t()`
2. **Hardcoded prop values** - String literals in common props like `label`, `title`, `description`, `message`, `placeholder`
3. **Alert messages** - Hardcoded strings in `alert()` calls
4. **Table column titles** - Column definitions with hardcoded `title` values

## Output

The script provides:

- **Color-coded severity** - Errors (❌) and warnings (⚠️)
- **File and line number** - Exact location of each issue
- **Context** - The hardcoded string that needs localization
- **Suggested fix** - How to replace it with `t()` function

Example output:

```
⚠️  Found 81 localization issues in 27 files

pages/teams-page/teams-page.tsx
  ❌ Line 45: Hardcoded text in JSX should use t() function
     Text: "Add Team"
     Fix:  {t('your.key.here')}

  ❌ Line 63: Hardcoded string in "label" prop should use t() function
     Text: "Team Name"
     Fix:  label={t('your.key.here')}
```

## Integration

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
yarn check-i18n
```

### CI/CD

Add to GitHub Actions workflow:

```yaml
- name: Check i18n
  run: cd packages/dashboard && yarn check-i18n
```

## Ignored Patterns

The script automatically ignores:

- Test files (`*.test.tsx`, `*.spec.ts`)
- i18n directory itself
- Technical strings (URLs, hex colors, data attributes, etc.)
- Single characters and numbers
- Constants (ALL_CAPS)
- Strings that look like translation keys (e.g., `common.save`)

## False Positives

If the script reports a false positive, you can:

1. Check if the string is actually technical and shouldn't be localized
2. Verify the string isn't already using `t()` in a way the regex didn't catch
3. Add more ignore patterns to the script if needed

## Configuration

Edit `scripts/check-i18n.cjs` to customize:

- `config.textProps` - Props that commonly contain user-facing text
- `config.ignorePatterns` - Regex patterns for strings to ignore
- `config.excludePatterns` - File patterns to skip

## Best Practices

1. **Run before commits** - Catch localization issues early
2. **Fix systematically** - Address one file at a time
3. **Add keys to all languages** - Don't forget the other 8 locale files
4. **Use descriptive keys** - `teams.addButton` instead of `button1`
5. **Group related keys** - Keep all team-related keys under `teams.*`

## Related Documentation

- Main i18n guide: `src/i18n/README.md`
- Project AGENTS.md i18n section
- Locale files: `src/i18n/locales/*.json`

---

### 2. check-missing-translations.cjs - Translation Completeness Checker

Compares translation files against the English (en.json) reference to identify missing translation keys in other languages.

#### Usage

```bash
# Check all languages
node scripts/check-missing-translations.cjs

# Check specific language
node scripts/check-missing-translations.cjs es    # Spanish
node scripts/check-missing-translations.cjs de    # German
node scripts/check-missing-translations.cjs ja    # Japanese
```

#### What It Checks

- Compares each language file against `en.json` (the source of truth)
- Identifies missing keys in each language
- Reports extra keys that don't exist in English
- Verifies structural consistency across all 9 languages

#### Output

```
Checking missing translations...

✓ Spanish (es): All 284 keys present
✓ Swedish (sv): All 284 keys present
✗ Japanese (ja): Missing 3 keys
  - settings.newFeature
  - common.newButton
  - validation.newRule

⚠ French (fr): Has 1 extra key
  + sidebar.deprecated
```

#### When to Use

- After adding new translation keys to `en.json`
- Before committing translation updates
- During code review to verify translation completeness
- When debugging missing translations in the UI

---

### 3. merge-i18n.cjs - Translation Key Merger

Automatically merges new translation keys from `en.json` into other locale files, preserving existing translations.

#### Usage

```bash
# Merge new keys into all languages
node scripts/merge-i18n.cjs
```

#### What It Does

1. Reads English translations (source of truth for structure)
2. For each language file:
   - Preserves all existing translations
   - Adds missing keys with English text as fallback
   - Maintains proper JSON structure and nesting
3. Writes updated files back to `src/i18n/locales/`

#### Workflow Example

```bash
# 1. Add new keys to en.json
# 2. Run merge script to propagate structure
node scripts/merge-i18n.cjs

# 3. Check what needs translation
node scripts/check-missing-translations.cjs

# 4. Manually translate the English fallback values
# 5. Verify completeness
node scripts/check-missing-translations.cjs
```

#### Important Notes

- ⚠️ **Fallback values are in English** - You must manually translate them
- ✅ **Preserves existing translations** - Safe to run multiple times
- ✅ **Maintains structure** - Keeps nested objects and arrays intact

---

## Adding New Scripts

When creating new utility scripts for the Dashboard:

1. **Place in `scripts/` directory** - Keep all maintenance scripts together
2. **Use `.cjs` extension** - For CommonJS Node.js scripts
3. **Add shebang** - Include `#!/usr/bin/env node` at the top
4. **Document in this README** - Add usage instructions and examples
5. **Add to package.json** - Create yarn aliases for common usage
6. **Update AGENTS.md** - Document script purpose for future AI assistance

### Script Template

```javascript
#!/usr/bin/env node
/**
 * Script Name - Brief description
 *
 * Usage:
 *   node scripts/script-name.cjs [args]
 *
 * Description:
 *   Detailed explanation of what the script does
 */

const fs = require('fs');
const path = require('path');

// Your script logic here
```

---

## Best Practices for i18n Maintenance

1. **Run check-i18n before commits** - Catch localization issues early
2. **Use merge-i18n for new keys** - Automatically propagate structure
3. **Verify with check-missing-translations** - Ensure completeness
4. **Translate systematically** - One language at a time
5. **Build frequently** - Catch JSON errors early (run `yarn build`)
6. **Keep all 9 languages synchronized** - Always at 348 lines, 284 keys

## Related Documentation

- Main i18n guide: `src/i18n/README.md`
- Project AGENTS.md i18n section
- Locale files: `src/i18n/locales/*.json`
