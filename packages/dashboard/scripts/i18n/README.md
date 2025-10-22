# Translation Helper Scripts

This directory contains tools for managing translations across all supported languages in the Castmill dashboard.

## Overview

The Castmill dashboard supports 9 languages:

- English (en) - Base language
- Spanish (es)
- Swedish (sv)
- German (de)
- French (fr)
- Chinese Mandarin (zh)
- Arabic (ar) - RTL support
- Korean (ko)
- Japanese (ja)

## Available Scripts

### find-missing-keys.cjs

**NEW**: Scans the codebase for translation keys used in code and reports any keys that don't exist in the English translation file.

**Usage:**

```bash
node scripts/i18n/find-missing-keys.cjs
```

**What it does:**

- Scans all TypeScript/TSX files for `t()` and `tp()` function calls
- Extracts translation keys from the code
- Compares them against the English translation file (en.json)
- Reports missing keys (used in code but not in en.json)
- Optionally shows unused keys (in en.json but not found in code)
- Ignores test files and comments to avoid false positives

**When to use:**

- Before committing code changes that add new UI text
- To find translation keys that are referenced but not defined
- To detect typos in translation key names
- As part of CI/CD to prevent missing translations

**Example output:**

```
Finding Missing Translation Keys
Scanning source code for translation key usage...

English translation keys: 414
Translation keys found in code: 206

✅ No missing translation keys found
```

### translation-helper.cjs

A comprehensive CLI tool for translation management.

### Installation

```bash
# Navigate to dashboard directory
cd packages/dashboard

# Script is already executable
node scripts/i18n/translation-helper.cjs <command>
```

### Commands

#### add - Add New Translation Keys

Add a translation key to all language files with TODO markers for non-English languages.

**Usage:**

```bash
node scripts/i18n/translation-helper.cjs add <key> <english-value>
```

**Examples:**

```bash
# Simple key
node scripts/i18n/translation-helper.cjs add common.save "Save"

# Nested key
node scripts/i18n/translation-helper.cjs add teams.members.title "Team Members"

# Key with parameters
node scripts/i18n/translation-helper.cjs add users.greeting "Hello, {name}!"

# Key with pluralization placeholder
node scripts/i18n/translation-helper.cjs add items.count "{count} items"
```

**What it does:**

- Creates the key in all 9 language files
- Sets the English translation directly
- Marks other languages with `TODO: translate` prefix
- Maintains proper nested JSON structure
- Preserves existing translations

**Example output in language files:**

```json
// en.json
{
  "teams": {
    "members": {
      "title": "Team Members"
    }
  }
}

// es.json
{
  "teams": {
    "members": {
      "title": "TODO: translate - Team Members"
    }
  }
}
```

#### check - Check Translation Completeness

Scan all language files for missing keys and untranslated content.

**Usage:**

```bash
# Check all languages
node scripts/i18n/translation-helper.cjs check

# Check specific language
node scripts/i18n/translation-helper.cjs check --lang es
```

**What it checks:**

- Keys present in English but missing in other languages
- Keys with "TODO: translate" markers
- Displays statistics for each language
- Lists all problematic keys

**Example output:**

```
Checking translations...

Spanish (es):
  Missing keys: 5
    - teams.members.addMember
    - teams.members.removeMember
  Untranslated (TODO markers): 3
    - teams.settings.title
    - teams.settings.description
  Coverage: 92%

Swedish (sv):
  Missing keys: 2
  Untranslated (TODO markers): 1
  Coverage: 97%

Summary: 2 languages need attention
```

#### sync - Sync Missing Keys

Copy structure from English to other languages, adding missing keys with TODO markers.

**Usage:**

```bash
# Sync all languages
node scripts/i18n/translation-helper.cjs sync

# Sync specific language
node scripts/i18n/translation-helper.cjs sync --lang sv
```

**What it does:**

- Compares each language file to English
- Adds any missing keys with TODO markers
- Preserves all existing translations
- Maintains nested structure
- Creates backup before syncing

**When to use:**

- After merging branches that added English translations
- When starting translation work on a specific language
- After detecting missing keys with `check` command
- To establish baseline for new translators

#### list - List Translation Keys

Display all translation keys in a specific section or the entire file.

**Usage:**

```bash
# List all keys in a section
node scripts/i18n/translation-helper.cjs list teams

# List nested section
node scripts/i18n/translation-helper.cjs list teams.invitations

# List root level
node scripts/i18n/translation-helper.cjs list
```

**What it shows:**

- All translation keys in the specified section
- English values for each key
- Hierarchical structure with indentation
- Nested key paths

**Example output:**

```
Translation keys in 'teams':

teams.title: Teams
teams.create: Create Team
teams.members
  teams.members.title: Team Members
  teams.members.addMember: Add Member
  teams.members.removeMember: Remove Member
teams.invitations
  teams.invitations.title: Invitations
  teams.invitations.accept: Accept Invitation

Total keys: 7
```

### Workflow Examples

#### Adding a New Feature

When implementing a new feature with user-facing strings:

```bash
# 1. Write your component using t() function
# Example: {t('media.upload.title')}

# 2. Add translation keys
node scripts/i18n/translation-helper.cjs add media.upload.title "Upload Media"
node scripts/i18n/translation-helper.cjs add media.upload.selectFiles "Select Files"
node scripts/i18n/translation-helper.cjs add media.upload.uploading "Uploading..."
node scripts/i18n/translation-helper.cjs add media.upload.success "Upload completed successfully"

# 3. Check that keys were added
node scripts/i18n/translation-helper.cjs list media.upload

# 4. Translate TODO-marked strings in other language files
# Edit src/i18n/locales/es.json, sv.json, etc.

# 5. Verify completeness
node scripts/i18n/translation-helper.cjs check
```

#### Fixing Translation Issues

When CI reports missing translations:

```bash
# 1. Check what's missing
node scripts/i18n/translation-helper.cjs check

# 2. Sync any missing structure
node scripts/i18n/translation-helper.cjs sync

# 3. Review TODO markers and translate
# Edit language files to replace "TODO: translate - ..." with actual translations

# 4. Verify fix
node scripts/i18n/translation-helper.cjs check
node scripts/check-i18n.cjs
```

#### After Merging Branches

After merging a branch that added English translations:

```bash
# 1. Sync all languages to pick up new keys
node scripts/i18n/translation-helper.cjs sync

# 2. Check what needs translation
node scripts/i18n/translation-helper.cjs check

# 3. Translate TODO-marked strings
# Focus on the languages your team supports

# 4. Create PR with translations
git add src/i18n/locales/
git commit -m "feat(i18n): translate new keys to Spanish and Swedish"
```

#### Reviewing Translation Status

Before a release:

```bash
# Check overall translation status
node scripts/i18n/translation-helper.cjs check

# Review specific language
node scripts/i18n/translation-helper.cjs check --lang es

# List all keys in a section to verify coverage
node scripts/i18n/translation-helper.cjs list teams
node scripts/i18n/translation-helper.cjs list media
```

## File Structure

```
packages/dashboard/
├── src/
│   └── i18n/
│       ├── locales/
│       │   ├── en.json      # Base language (source of truth)
│       │   ├── es.json      # Spanish translations
│       │   ├── sv.json      # Swedish translations
│       │   ├── de.json      # German translations
│       │   ├── fr.json      # French translations
│       │   ├── zh.json      # Chinese translations
│       │   ├── ar.json      # Arabic translations
│       │   ├── ko.json      # Korean translations
│       │   └── ja.json      # Japanese translations
│       ├── index.tsx        # i18n provider and hooks
│       └── types.ts         # TypeScript types
├── scripts/
│   ├── check-i18n.cjs       # CI validation script
│   └── i18n/
│       ├── translation-helper.cjs  # Main CLI tool
│       └── README.md              # This file
```

## Translation Key Conventions

### Naming Structure

Use dot notation for nested keys:

```
section.subsection.key
```

Examples:

```
common.save
common.cancel
teams.title
teams.members.addMember
teams.invitations.acceptSuccess
forms.labels.email
forms.placeholders.enterEmail
```

### Sections

Common sections used in the dashboard:

- `common.*` - Buttons, actions, generic terms
- `errors.*` - Error messages
- `forms.*` - Form labels, placeholders, validation
- `teams.*` - Team management
- `media.*` - Media management
- `playlists.*` - Playlist management
- `devices.*` - Device management
- `organizations.*` - Organization management
- `users.*` - User management

### Parameters

Use curly braces for parameters:

```json
{
  "users.greeting": "Hello, {name}!",
  "items.count": "{count} items",
  "teams.memberCount": "{count} members in {teamName}"
}
```

### Pluralization

For countable items, use the pluralization function `tp()` in code:

```typescript
tp('items.count', count);
```

Translation file structure:

```json
{
  "items": {
    "count": {
      "one": "1 item",
      "other": "{count} items"
    }
  }
}
```

## Best Practices

### DO:

- ✅ Always use the `translation-helper.cjs` tool for managing translations
- ✅ Run `find-missing-keys.cjs` before committing to detect missing keys
- ✅ Use nested keys for logical grouping
- ✅ Add English translations first, then translate to other languages
- ✅ Use TODO markers to track incomplete translations
- ✅ Run `check` command before committing translation changes
- ✅ Keep translation keys descriptive and context-specific
- ✅ Test with multiple locales, especially RTL (Arabic)

### DON'T:

- ❌ Manually edit JSON files without using the helper tool
- ❌ Leave TODO markers in production releases
- ❌ Use generic keys like "text1", "label2"
- ❌ Duplicate translations across sections
- ❌ Forget to add keys to all language files
- ❌ Use concatenation for dynamic messages (use parameters instead)
- ❌ Reference translation keys in code before adding them to en.json

## Workflow for Adding New Translations

1. **Add the key to English first:**

   ```bash
   node scripts/i18n/translation-helper.cjs add organization.messages.myNewKey "My new message"
   ```

2. **Verify the key exists in code:**

   ```bash
   node scripts/i18n/find-missing-keys.cjs
   ```

3. **Sync to all languages:**

   ```bash
   node scripts/i18n/translation-helper.cjs sync
   ```

4. **Check for missing translations:**

   ```bash
   node scripts/check-missing-translations.cjs
   ```

5. **Translate the TODO markers** in each language file

6. **Commit your changes**

## CI/CD Integration

The `check-i18n.cjs` script runs in CI to validate translations:

```bash
node scripts/check-i18n.cjs
```

This checks:

- No hardcoded user-facing strings in components
- All translations present in language files
- No syntax errors in JSON files

The helper tool complements this by:

- Managing translation files correctly
- Ensuring structure consistency
- Tracking incomplete translations

## Troubleshooting

### "Key already exists" error

The `add` command won't overwrite existing keys. If you need to update a translation:

1. Manually edit the English file
2. Run `sync` to update other languages with TODO markers
3. Translate the TODO-marked strings

### "Missing keys" reported by check

Run `sync` command to add missing keys from English to other languages.

### JSON syntax errors

The helper tool automatically formats JSON. If you encounter syntax errors:

1. Check for manual edits to JSON files
2. Run the tool again to reformat
3. Use a JSON validator if needed

### TODO markers not being translated

This is expected during development. TODO markers indicate work needed:

1. Review the list with `check` command
2. Edit language files to replace TODO markers with actual translations
3. Verify with `check` command again

## Related Documentation

- [AGENTS.md](../../../castmill/AGENTS.md) - Full i18n system documentation
- [src/i18n/README.md](../../src/i18n/README.md) - i18n API and usage in components
- [src/i18n/index.tsx](../../src/i18n/index.tsx) - i18n implementation

## Support

For issues or questions:

1. Check this README first
2. Review AGENTS.md for system architecture
3. Run `translation-helper.cjs` without arguments for help
4. Check existing language files for examples
