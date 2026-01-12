# MediaPicker Component

A reusable, feature-rich media picker component with infinite scrolling, search, and filtering capabilities.

## Features

- ✅ **Infinite Scroll** - Automatically loads more items as you scroll
- ✅ **Debounced Search** - Real-time search with 500ms debounce
- ✅ **Customizable Filtering** - Filter media by type (images, videos, etc.)
- ✅ **Dark Theme** - Matches Castmill dashboard design
- ✅ **Responsive Grid** - Auto-adjusting columns based on container width
- ✅ **Loading States** - Clear feedback during data fetching
- ✅ **Custom Scrollbar** - Styled scrollbar for better UX
- ✅ **Item Counter** - Shows "X of Y" items loaded

## Usage

```tsx
import { MediaPicker, MediaItem } from '@castmill/ui-common';

function MyComponent() {
  const [showPicker, setShowPicker] = createSignal(false);

  // Define your fetch function
  const fetchMedia = async (
    page: number,
    pageSize: number,
    search?: string
  ): Promise<{ data: MediaItem[]; count: number }> => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (search) {
      params.set('search', search);
    }

    const response = await fetch(`/api/medias?${params}`);
    return await response.json();
  };

  const handleSelect = (mediaId: number) => {
    console.log('Selected media:', mediaId);
    setShowPicker(false);
  };

  return (
    <>
      <Button onClick={() => setShowPicker(true)}>Select Media</Button>

      <MediaPicker
        show={showPicker()}
        onClose={() => setShowPicker(false)}
        onSelect={handleSelect}
        fetchMedia={fetchMedia}
      />
    </>
  );
}
```

## Props

| Prop                | Type                                                  | Required | Default                 | Description                     |
| ------------------- | ----------------------------------------------------- | -------- | ----------------------- | ------------------------------- |
| `show`              | `boolean`                                             | ✅       | -                       | Whether the picker is visible   |
| `onClose`           | `() => void`                                          | ✅       | -                       | Callback when picker is closed  |
| `onSelect`          | `(mediaId: number) => void`                           | ✅       | -                       | Callback when media is selected |
| `fetchMedia`        | `(page, pageSize, search?) => Promise<{data, count}>` | ✅       | -                       | Function to fetch media         |
| `selectedMediaId`   | `number`                                              | ❌       | -                       | Currently selected media ID     |
| `title`             | `string`                                              | ❌       | `"Select Media"`        | Modal title                     |
| `description`       | `string`                                              | ❌       | `"Choose a media file"` | Modal description               |
| `filterFn`          | `(media: MediaItem) => boolean`                       | ❌       | Images only             | Function to filter media        |
| `pageSize`          | `number`                                              | ❌       | `30`                    | Number of items per page        |
| `searchPlaceholder` | `string`                                              | ❌       | `"Search..."`           | Search input placeholder        |
| `loadingText`       | `string`                                              | ❌       | `"Loading..."`          | Loading indicator text          |
| `noMediaText`       | `string`                                              | ❌       | `"No media available"`  | Empty state text                |
| `cancelLabel`       | `string`                                              | ❌       | `"Cancel"`              | Cancel button label             |
| `selectLabel`       | `string`                                              | ❌       | `"Select"`              | Select button label             |

## Examples

### Filter for Images Only (Default)

```tsx
<MediaPicker
  show={show()}
  onClose={handleClose}
  onSelect={handleSelect}
  fetchMedia={fetchMedia}
  // filterFn is optional - defaults to images only
/>
```

### Filter for Videos

```tsx
<MediaPicker
  show={show()}
  onClose={handleClose}
  onSelect={handleSelect}
  fetchMedia={fetchMedia}
  filterFn={(media) => media.mimetype?.startsWith('video/')}
  title="Select Video"
  description="Choose a video file"
/>
```

### Custom Labels (i18n)

```tsx
<MediaPicker
  show={show()}
  onClose={handleClose}
  onSelect={handleSelect}
  fetchMedia={fetchMedia}
  title={t('media.selectTitle')}
  description={t('media.selectDescription')}
  searchPlaceholder={t('common.search')}
  loadingText={t('common.loading')}
  noMediaText={t('media.noMediaAvailable')}
  cancelLabel={t('common.cancel')}
  selectLabel={t('common.select')}
/>
```

### With Pre-selected Media

```tsx
<MediaPicker
  show={show()}
  onClose={handleClose}
  onSelect={handleSelect}
  fetchMedia={fetchMedia}
  selectedMediaId={currentMediaId()}
/>
```

## Infinite Scroll Behavior

The component automatically loads more items when the user scrolls to 80% of the grid height. This provides a smooth, seamless experience as users browse through large media libraries.

**Technical Details:**

- Triggers when scroll position > 80%
- Loads next page automatically
- Shows "Loading more..." indicator at bottom
- Stops loading when all items are fetched

## Customization

The component uses CSS modules for styling. You can override styles by targeting the class names:

```scss
// In your component's SCSS
:global {
  .mediaPicker {
    // Override styles here
  }
}
```

## Performance Notes

- Search is debounced at 500ms to reduce API calls
- Infinite scroll loads pages on-demand
- Images are lazy-loaded by the browser
- Grid layout is optimized with CSS Grid

## Accessibility

- Keyboard navigation supported (Esc to close)
- Clear focus states on interactive elements
- Semantic HTML structure
- Screen reader friendly labels

## Browser Support

Works in all modern browsers that support:

- CSS Grid
- CSS Custom Properties
- ES6+ JavaScript
