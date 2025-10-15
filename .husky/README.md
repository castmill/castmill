# Git Hooks with Husky

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Pre-commit Hook

The pre-commit hook automatically formats your code before each commit using `lint-staged`. This ensures:

- **JavaScript/TypeScript files** are formatted with Prettier
- **Elixir files** in `packages/castmill/` are formatted with `mix format`
- **Only staged files** are formatted (fast and efficient)

### What gets formatted?

- `**/*.{js,jsx,ts,tsx,json,css,md}` - All JS/TS frontend code
- `packages/castmill/**/*.{ex,exs}` - All Elixir backend code

### How it works

1. You stage files: `git add .`
2. You commit: `git commit -m "your message"`
3. **Husky intercepts** the commit
4. **lint-staged** formats only the staged files
5. **Formatted files** are added to the commit
6. **Commit completes** with properly formatted code

### Bypassing the hook (emergency only)

If you absolutely need to skip the pre-commit hook:

```bash
git commit -m "your message" --no-verify
```

⚠️ **Use sparingly!** This should only be used in emergencies.

### Manual formatting

You can still manually format code:

```bash
# Format all frontend packages
yarn format:all

# Format Elixir code
cd packages/castmill && mix format

# Check formatting without changing files
yarn format:check:all
```

### Benefits

✅ Never forget to format code again  
✅ Consistent code style across the team  
✅ Cleaner git diffs  
✅ Faster PR reviews  
✅ No more "fix formatting" commits  

### Troubleshooting

**Hook not running?**
- Check if `.husky/pre-commit` is executable: `ls -la .husky/pre-commit`
- Re-run: `chmod +x .husky/pre-commit`

**Mix format failing?**
- Ensure you're in the right directory
- Check Elixir is installed: `elixir --version`
- Try manually: `cd packages/castmill && mix format`

**Want to see what will be formatted?**
```bash
npx lint-staged --dry-run
```
