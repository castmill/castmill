# Onboarding Tour - Visual Design

## Component Layout

The onboarding tour is displayed as a modal overlay on top of the dashboard.

```
┌─────────────────────────────────────────────────────────────────┐
│                      DASHBOARD (dimmed)                          │
│                                                                   │
│    ┌──────────────────────────────────────────────────────┐    │
│    │  ┌──────────────────────────────────────────────┐ ×  │    │
│    │  │ Getting Started Tour                          │    │    │
│    │  │ 2 of 6 steps completed                        │    │    │
│    │  └──────────────────────────────────────────────┘    │    │
│    │                                                        │    │
│    │  [████████░░░░░░░░░░░░░░░░░░░░░░░░░░] 33%           │    │
│    │                                                        │    │
│    │  ┌──────────────────────────────────────────────┐    │    │
│    │  │  ⓷                                            │    │    │
│    │  │                                               │    │    │
│    │  │  Create Your First Playlist                   │    │    │
│    │  │                                               │    │    │
│    │  │  Organize your content into playlists. Add   │    │
│    │  │  media files and widgets to create engaging  │    │
│    │  │  content sequences. You can set display      │    │
│    │  │  durations and transitions for each item.    │    │
│    │  │                                               │    │
│    │  │  [ Go to Playlists ]  [ Mark as Complete ]   │    │
│    │  │                                               │    │
│    │  └──────────────────────────────────────────────┘    │
│    │                                                        │    │
│    │  [ ← Back ]     ● ● ● ○ ○ ○     [ Skip → ]          │    │
│    └──────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Visual Elements

### 1. Overlay

- Semi-transparent dark background (rgba(0, 0, 0, 0.6))
- Covers entire viewport
- Z-index: 10000 (appears on top of everything)
- Fade-in animation (0.3s)

### 2. Modal Dialog

- Dark theme background (#211d32)
- Rounded corners (1em border-radius)
- Drop shadow for depth
- Slide-up animation (0.3s)
- Max width: 42em
- Centered on screen
- Responsive: 90% width on mobile

### 3. Header Section

- Title: "Getting Started Tour" (1.75em, bold)
- Progress text: "X of Y steps completed" (0.9em, secondary color)
- Close button (×): Top-right corner, large and clickable
- Border bottom separator

### 4. Progress Bar

- Full width horizontal bar
- Background: Dark input color (#151320)
- Fill: Blue gradient (#007bff → #4a90e2)
- Height: 0.5em
- Smooth animation on progress changes

### 5. Step Content Area

- **Step Number Circle**:
  - 3em diameter circle
  - Dark background with border
  - Number or checkmark (✓) if completed
  - Checkmark is green (#28a745)

- **Step Title**: 1.5em, bold, white text

- **Step Description**:
  - Regular weight
  - Secondary color (#a4a3b7)
  - Line height: 1.6 for readability
  - Multiple lines supported

### 6. Action Buttons (for incomplete steps)

- **Primary Button** "Go to [Feature]":
  - Blue background (#007bff)
  - White text
  - Hover: Darker blue + shadow
  - Padding: 0.75em x 1.5em

- **Secondary Button** "Mark as Complete":
  - Gray background (#6c757d)
  - White text
  - Hover: Darker gray

### 7. Completed Step Badge

- Green-tinted background
- Green border
- Checkmark icon + "Completed" text
- Displayed instead of action buttons

### 8. Footer Section

- Border top separator
- Three-column layout:
  - Left: Back button
  - Center: Dot navigation
  - Right: Skip/Finish button

- **Navigation Buttons**:
  - Transparent background
  - Border: 1px solid #555
  - Hover: Blue tinted background
  - Arrows: ← →

- **Dot Indicators**:
  - Small circles (0.75em diameter)
  - Inactive: Dark gray
  - Active: Blue, larger (scale 1.3)
  - Completed: Green
  - Clickable to jump to steps

## Color Scheme

### Primary Colors

- **Background**: #211d32 (dark purple)
- **Input Background**: #151320 (darker purple)
- **Text Primary**: #ffffff (white)
- **Text Secondary**: #a4a3b7 (light gray)
- **Label**: #577cbb (muted blue)

### Accent Colors

- **Primary Blue**: #007bff
- **Primary Blue Hover**: #0056b3
- **Border**: #555 (gray)
- **Border Hover**: #b0b0b0
- **Border Focus**: #4a90e2

### Status Colors

- **Success Green**: #28a745
- **Error Red**: #ff4200
- **Secondary Gray**: #6c757d

## Responsive Design

### Desktop (>768px)

- Modal: 42em max width
- Buttons: Side by side
- Full padding (2em)
- All features visible

### Tablet (768px - 480px)

- Modal: 90% width
- Buttons: May wrap
- Reduced padding

### Mobile (<480px)

- Modal: 95% width
- Buttons: Stack vertically, full width
- Compact padding (1.5em)
- Smaller font sizes
- Touch-friendly button sizes

## Animations

### Modal Appearance

1. Overlay fades in (0 → 1 opacity)
2. Modal slides up 20px while fading in
3. Duration: 0.3s
4. Easing: ease

### Progress Bar

- Width changes smoothly (0.3s transition)
- Gradient animation subtle

### Button Interactions

- Hover: Background color transition (0.2s)
- Active: Scale down slightly (0.98)
- Disabled: Reduced opacity (0.6)

### Step Navigation

- Dots: Scale animation on hover/active
- Checkmark: Appears with fade

## Accessibility

- **Keyboard Support**:
  - ESC key closes the modal
  - Tab navigation through buttons
  - Enter activates buttons

- **ARIA Labels**:
  - Close button: aria-label="Close"
  - Dot buttons: aria-label="Go to step X"

- **Screen Reader Friendly**:
  - Progress announced
  - Step completion states
  - Clear button labels

## States

### Loading State

- Buttons disabled
- Loading text instead of button label
- Reduced opacity

### Error State

- Error message in red box
- Retry action available

### Completed State

- Green success badge
- All dots green
- "Congratulations" message
- Finish button prominent

### Dismissed State

- Modal closes smoothly
- Toast notification confirms dismissal
- Can be reopened from settings

## Dark Theme Integration

The onboarding tour seamlessly integrates with the dashboard's dark theme:

- No harsh white backgrounds
- Consistent color palette
- Comfortable for extended viewing
- Professional enterprise look
