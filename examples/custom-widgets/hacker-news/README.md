# Hacker News Feed Widget

A custom Castmill widget that displays the latest stories from Hacker News with a beautiful dark orange-themed design.

## 📦 Package Contents

```
hacker-news/
├── widget.json              # Widget definition with template and schemas
├── README.md                # This file
└── assets/
    ├── icons/
    │   ├── hn-logo.svg      # Y Combinator logo (5vh × 5vh)
    │   ├── upvote.svg       # Upvote arrow icon
    │   ├── comment.svg      # Comment bubble icon
    │   └── external-link.svg # External link icon
    ├── images/
    │   └── background.svg   # Dark gradient background (1920×1080)
    └── styles/
        └── hn-theme.css     # Color theme and utility classes
```

## 🎨 Design Features

- **Dark gradient background** with subtle grid pattern
- **HN orange branding** (#ff6600) throughout
- **Card-based layout** with accent borders
- **Auto-scrolling** news stories
- **Story metadata**: score, comments, time, source

## 🔧 Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scroll_speed` | number | 30 | Pixels per second (10-100) |
| `max_items` | number | 20 | Maximum stories to display (5-30) |

## 📡 Data Integration

This widget is designed to work with the **RSS fetcher** integration:

```json
{
  "integration": {
    "type": "PULL",
    "fetcher": "rss",
    "config": {
      "feed_url": "https://hnrss.org/frontpage",
      "refresh_interval": 300
    }
  }
}
```

### Expected Data Format

The RSS fetcher provides items with these fields:
- `title` - Story headline
- `pubDate_formatted` - Human-readable time (e.g., "2 hours ago")
- `source` - Domain name of the linked article
- `score` - HN points (optional)
- `comments` - Comment count (optional)

## 📥 Installation

### Option 1: Upload as ZIP

1. Create a ZIP file of this entire `hacker-news/` directory
2. Navigate to **Dashboard → Widgets → Upload Widget**
3. Select the ZIP file
4. The widget will be validated and installed

```bash
# Create the ZIP file
cd examples/custom-widgets
zip -r hacker-news.zip hacker-news/
```

### Option 2: Upload JSON Only

If you don't need custom assets:
1. Navigate to **Dashboard → Widgets → Upload Widget**
2. Select just the `widget.json` file
3. Asset references will need to be removed or use absolute URLs

## 🎯 Asset References

Assets are referenced in the template using the `{{asset:category.name}}` syntax:

```json
{
  "type": "image",
  "opts": {
    "src": "{{asset:icons.logo}}"
  }
}
```

At runtime, these placeholders are resolved to the actual asset URLs based on the storage backend configuration.

## 🖼️ Preview

The widget displays:
- Header with HN logo and "Top Stories" label
- Scrolling list of story cards
- Each card shows: title, score, comments, time, source
- Footer with website URL and Castmill branding

## 📝 Customization

To create a variant (e.g., different HN feed):

1. Copy this directory
2. Modify `widget.json`:
   - Change `name` and `slug`
   - Update `integration.config.feed_url` to use:
     - `https://hnrss.org/newest` - Newest stories
     - `https://hnrss.org/best` - Best stories
     - `https://hnrss.org/ask` - Ask HN
     - `https://hnrss.org/show` - Show HN
3. Optionally modify colors in the template

## ⚠️ Schema Reference

When creating custom widgets, be aware of the schema validation rules:

### Valid Schema Types

| Type | Description | Example |
|------|-------------|--------|
| `string` | Text values | `"title": "string"` |
| `number` | Numeric values | `"score": "number"` |
| `boolean` | True/false | `"enabled": "boolean"` |
| `url` | URL strings | `"link": "url"` |
| `color` | Color values (hex, rgba) | `"bg": "color"` |
| `list` | Array of items | See below |
| `map` | Nested object | See below |
| `ref` | Reference to another entity | `"media": {"type": "ref", "collection": "medias"}` |

### List Schema (for arrays)

```json
"items": {
  "type": "list",
  "items": {
    "type": "map",
    "schema": {
      "title": "string",
      "score": "string"
    }
  }
}
```

**⚠️ Important:** Use `"type": "list"` NOT `"type": "array"`

### Allowed Field Attributes

- `type` (required)
- `required` (optional, boolean)
- `default` (optional)
- `description` (optional)
- `min`, `max` (optional, for numbers)
- `order` (optional, for UI ordering)
- `enum` (optional, for string enums)

**⚠️ Important:** `label` is NOT a valid attribute. Use `description` instead.

## 📄 License

MIT License - Feel free to use and modify for your own widgets.

---

**Created for Castmill Digital Signage Platform**
aaa