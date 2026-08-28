# Quote of the Day Widget

An elegant digital signage widget that displays inspirational quotes with beautiful typography.

## Features

- **Elegant Design**: Warm gradient background with decorative quote marks
- **Beautiful Typography**: Uses classic serif fonts for quotes, clean sans-serif for attribution
- **Configurable**: Customizable text sizes and colors
- **Responsive**: Scales beautifully across different screen sizes using viewport units

## File Structure

```
quote-of-the-day/
├── widget.json                 # Widget definition
├── README.md
└── assets/
    ├── icons/
    │   ├── quote-icon.svg      # Widget icon (64x64)
    │   └── quote-mark.svg      # Decorative quotation marks
    └── images/
        └── gradient-bg.svg     # Elegant gradient background
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `font_size` | select | `5vh` | Quote text size (Small/Medium/Large/Extra Large) |
| `text_color` | color | `#2c3e50` | Quote text color |
| `author_color` | color | `#7f8c8d` | Author attribution color |
| `display_duration` | number | `15` | Seconds per quote (for future rotation feature) |

## Data Schema

| Field | Type | Description |
|-------|------|-------------|
| `quote` | string | The quote text |
| `author` | string | Quote author name |
| `title` | string | Author's title or context (optional) |
| `category` | string | Quote category (e.g., "Inspiration", "Leadership") |

## Typography

The widget uses elegant system fonts with beautiful fallbacks:
- **Quote text**: Georgia, Times New Roman (serif) - Classic, elegant serif
- **Author name**: Helvetica Neue, Arial (sans-serif) - Clean, modern sans-serif

## Usage

### Creating the ZIP Package

```bash
cd examples/custom-widgets/quote-of-the-day
zip -r ../quote-of-the-day.zip .
```

### Uploading to Castmill

1. Navigate to Organization Settings → Widgets
2. Click "Upload Widget"
3. Select `quote-of-the-day.zip`
4. The widget will be validated and added to your organization

## Sample Quotes

The widget includes default sample data:

> "The only way to do great work is to love what you do."
> — Steve Jobs, Co-founder of Apple

## License

MIT - Part of the Castmill platform
