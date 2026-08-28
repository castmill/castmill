# Widget Icon Upload Guide

This guide explains how to include custom icons in your widget JSON files.

## Icon Support

Widgets can include an `icon` field in their JSON definition. The icon will be displayed in the widgets table and can help visually identify different widget types.

## Icon Formats

The `icon` field supports three formats:

### 1. Base64-Encoded Image (Recommended)
Include a base64-encoded image directly in the JSON:

```json
{
  "name": "My Custom Widget",
  "icon": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...",
  "template": { ... }
}
```

**Advantages:**
- Self-contained (no external dependencies)
- Works offline
- No CORS issues

**Best Practices:**
- Use PNG format for transparency support
- Recommended size: 512x512 pixels (square)
- Keep file size reasonable (< 50KB recommended)
- Compress images before encoding

### 2. URL to External Image
Reference an image hosted on a server:

```json
{
  "name": "My Custom Widget",
  "icon": "https://example.com/icons/my-widget-icon.png",
  "template": { ... }
}
```

**Advantages:**
- Smaller JSON file size
- Easy to update icon without changing JSON

**Considerations:**
- Requires network access
- May have CORS restrictions
- Icon availability depends on external server

### 3. Relative Path
Use a path to a local image:

```json
{
  "name": "My Custom Widget",
  "icon": "/static/icons/my-widget.png",
  "template": { ... }
}
```

### 4. Emoji/Unicode (Simple Fallback)
Use a simple emoji or unicode character:

```json
{
  "name": "My Custom Widget",
  "icon": "🎨",
  "template": { ... }
}
```

## Converting an Image to Base64

### Using Command Line (macOS/Linux)
```bash
base64 -i icon.png | tr -d '\n' > icon-base64.txt
```

Then wrap the output with the data URI prefix:
```
data:image/png;base64,<paste-base64-here>
```

### Using Online Tools
1. Visit a base64 image encoder (e.g., https://www.base64-image.de/)
2. Upload your icon image
3. Copy the generated data URI
4. Paste into your widget JSON

### Using Node.js
```javascript
const fs = require('fs');

const imageBuffer = fs.readFileSync('icon.png');
const base64Image = imageBuffer.toString('base64');
const dataUri = `data:image/png;base64,${base64Image}`;

console.log(dataUri);
```

### Using Python
```python
import base64

with open('icon.png', 'rb') as image_file:
    encoded = base64.b64encode(image_file.read()).decode('utf-8')
    data_uri = f'data:image/png;base64,{encoded}'
    print(data_uri)
```

## Icon Specifications

### Recommended Dimensions
- **Size:** 512x512 pixels (square)
- **Aspect Ratio:** 1:1 (square)
- **Format:** PNG (for transparency) or SVG
- **File Size:** < 50KB for base64 encoding

### Supported Formats
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- SVG (`.svg`)
- WebP (`.webp`)
- GIF (`.gif`)

## Example Widget with Icon

```json
{
  "name": "Image Gallery Widget",
  "description": "Displays a gallery of images with transitions",
  "icon": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIj48cGF0aCBkPSJNMjEgMTl2MWMwIDEuMTAtLjkgMi0yIDJINWMtMS4xIDAtMi0uOS0yLTJ2LTFoMTh6bTAtMkg1di03bDMuNSAzLjVjLjY0LjY0IDEuNjguNjQgMi4zMiAwTDE0IDEwLjVsNSA1di0xaDJ6TTIxIDVjMS4xIDAgMiAuOSAyIDJ2MTJjMCAuNTUtLjIyIDEuMDUtLjU4IDEuNDJMMjAgMThWN0g2bC0xLTFjLS4wNC0uMDYtLjA4LS4xMS0uMTMtLjE3LS4zNy0uMzctLjktLjU4LTEuNDItLjU4aDJjLjItLjcxLjc4LTEuMjEgMS41NS0xLjIxaDEzeiIvPjwvc3ZnPg==",
  "template": {
    "type": "image",
    "name": "gallery",
    "opts": {
      "url": { "key": "options.images.files[@target].uri" }
    }
  },
  "options_schema": {
    "images": {
      "type": "ref",
      "required": true,
      "multiple": true,
      "collection": "medias|type:image"
    },
    "transition": {
      "type": "select",
      "default": "fade",
      "options": ["fade", "slide", "zoom"]
    }
  }
}
```

## Fallback Behavior

If no icon is specified or the image fails to load, the system will display a default package emoji (📦) as a fallback.

## Tips

1. **Optimize Images:** Compress images before encoding to keep JSON file size manageable
2. **Test Loading:** Verify that URL-based icons are accessible from the deployment environment
3. **Use SVG:** For simple icons, SVG provides the best quality-to-size ratio
4. **Consistency:** Use consistent icon sizes across all your widgets for a professional look
5. **Accessibility:** Choose icons that clearly represent the widget's function

## Troubleshooting

### Icon Not Displaying
- Verify the base64 string is complete and properly formatted
- Check that the data URI prefix is correct (`data:image/png;base64,` or similar)
- Ensure URL-based icons are accessible (no CORS issues)
- Check browser console for loading errors

### Icon Appears Distorted
- Use square images (1:1 aspect ratio)
- Ensure proper image format specification in data URI
- Check that the image file is not corrupted

### JSON File Too Large
- Compress the image before encoding
- Use a smaller image size (e.g., 256x256 instead of 512x512)
- Consider using a URL reference instead of base64
- Use WebP format for better compression
