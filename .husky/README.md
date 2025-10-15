# Git Hooks with Husky

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Pre-commit Hook

The pre-commit hook automatically formats your code and validates translations before each commit using `lint-staged`. This ensures:

- **JavaScript/TypeScript files** are formatted with Prettier
- **Elixir files** in `packages/castmill/` are formatted with `mix format`
- **Translation files** (i18n) are validated for completeness (100% coverage required)
- **Only staged files** are checked (fast and efficient)

### What gets formatted and validated?

- `**/*.{js,jsx,ts,tsx,css,md}` - All JS/TS frontend code
- `**/*.json` - All JSON files (formatted with Prettier)
- `packages/dashboard/src/i18n/locales/*.json` - Translation files (formatted + coverage validated)
- `packages/castmill/**/*.{ex,exs}` - All Elixir backend code

### How it works

1. You stage files: `git add .`
2. You commit: `git commit -m "your message"`
3. **Husky intercepts** the commit
4. **lint-staged** processes staged files:
   - Formats code with Prettier/mix format
   - If i18n files changed: validates 100% translation coverage
5. **If validation fails**: commit is blocked with error details
6. **If all passes**: formatted files are added and commit completes

### Translation Coverage Validation

When you modify any translation file in `packages/dashboard/src/i18n/locales/`:

- **Automatic check** runs to verify all 9 languages are 100% complete
- **Fails if**: Missing keys, untranslated strings, or incomplete coverage
- **Shows**: Detailed report of what's missing in which language

Example output:
```
Checking all languages against English reference...

Language    Coverage    Missing    Untranslated    Status
----------------------------------------------------------
ES          100%        0          0               ✓ Complete
DE          98.5%       2          3               ⚠ Incomplete
```

If any language shows ⚠ Incomplete, the commit will be blocked.

### Bypassing the hook (emergency only)

If you absolutely need to skip the pre-commit hook:

```bash
git commit -m "your message" --no-verify
```

⚠️ **Use sparingly!** This should only be used in emergencies.

### Manual formatting and validation

You can still manually format code and check translations:

```bash
# Format all frontend packages
yarn format:all

# Format Elixir code
cd packages/castmill && mix format

# Check formatting without changing files
yarn format:check:all

# Check translation coverage manually
yarn check-translations
```

### Benefits

✅ Never forget to format code again  
✅ Never commit incomplete translations  
✅ Consistent code style across the team  
✅ 100% translation coverage enforced automatically  
✅ Cleaner git diffs  
✅ Faster PR reviews  
✅ No more "fix formatting" or "add missing translations" commits  

### Troubleshooting

**Hook not running?**
- Check if `.husky/pre-commit` is executable: `ls -la .husky/pre-commit`
- Re-run: `chmod +x .husky/pre-commit`

**Mix format failing?**
- Ensure you're in the right directory
- Check Elixir is installed: `elixir --version`
- Try manually: `cd packages/castmill && mix format`

**Translation check failing?**
- See which language is incomplete in the error message
- Run manually to see details: `yarn check-translations`
- Fix missing translations in `packages/dashboard/src/i18n/locales/[language].json`
- All 9 languages (en, es, sv, de, fr, zh, ar, ko, ja) must be 100% complete

**Want to see what will be formatted?**
```bash
npx lint-staged --dry-run
```
