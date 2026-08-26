# Organization Logo Feature - UI Mockups

## 1. Organization Settings Page - Logo Section

```
┌─────────────────────────────────────────────────────────────┐
│ Organization Settings                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Name: [My Organization                    ] [Update ✓]      │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Logo Settings                                           │ │
│ │                                                         │ │
│ │ Choose a media file to use as your organization logo.  │ │
│ │ It will be displayed in the top bar.                   │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │                                                     │ │ │
│ │ │              [Organization Logo Preview]            │ │ │
│ │ │                   (max 8em height)                  │ │ │
│ │ │                                                     │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ [Select Logo]  [Remove Logo]                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 2. Logo Selector Modal

```
┌───────────────────────────────────────────────────────────────┐
│ Select Logo                                            [X]    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   [img]  │  │   [img]  │  │   [img]  │  │   [img]  │     │
│  │          │  │          │  │  ✓ ACTIVE│  │          │     │
│  │ Logo 1   │  │ Banner 2 │  │ MyLogo   │  │ Icon 4   │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   [img]  │  │   [img]  │  │   [img]  │  │   [img]  │     │
│  │          │  │          │  │          │  │          │     │
│  │ Logo 5   │  │ Brand 6  │  │ Image 7  │  │ Pic 8    │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                          [Cancel]  [Save]     │
└───────────────────────────────────────────────────────────────┘
```

## 3. Topbar with Organization Logo

**Before (no logo):**

```
┌─────────────────────────────────────────────────────────────────┐
│ [Castmill Logo]  🔍  ❓Help  🔔  [EN ▼]  [User Name ▼]         │
└─────────────────────────────────────────────────────────────────┘
```

**After (with logo):**

```
┌─────────────────────────────────────────────────────────────────┐
│ [Castmill Logo] │ [Org Logo]  🔍  ❓Help  🔔  [EN ▼]  [User ▼] │
└─────────────────────────────────────────────────────────────────┘
```

The organization logo appears after a vertical separator (│), with:

- Maximum height: 3em
- Maximum width: 10em
- Object-fit: contain (maintains aspect ratio)
- Updates automatically when switching organizations

## 4. Empty State (No Logo Selected)

```
┌─────────────────────────────────────────────────────────────┐
│ Logo Settings                                              │
│                                                            │
│ Choose a media file to use as your organization logo.     │
│ It will be displayed in the top bar.                      │
│                                                            │
│ ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│                                                            │
│ │              No logo selected                        │ │
│                                                            │
│ └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                                            │
│ [Select Logo]                                             │
└─────────────────────────────────────────────────────────────┘
```

## Color Scheme

- Border color: `var(--border-color, #ddd)`
- Background light: `var(--background-light, #f9f9f9)`
- Primary color (selection): `var(--primary-color, #007bff)`
- Text secondary: `var(--text-secondary, #666)`
- Separator color: `var(--separator-color)`

## Responsive Behavior

- Media grid uses CSS Grid with `auto-fill` and `minmax(10em, 1fr)`
- Logo preview container has `min-height: 8em` for consistent spacing
- Topbar logo respects maximum dimensions while maintaining aspect ratio
- Modal has max-height for media grid (25em) with scroll overflow
