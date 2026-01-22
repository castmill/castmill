# Onboarding Tour System

This document describes the modular onboarding system implemented in the Castmill dashboard.

## Overview

The onboarding tour is a step-by-step guided experience that helps new users understand and use key features of the Castmill digital signage platform. The system is designed to be:

- **Modular**: Easy to add or remove steps
- **Persistent**: Tracks progress in the user's account
- **Localized**: Supports all 9 languages (en, es, de, fr, sv, ar, zh, ja, ko)
- **Non-intrusive**: Can be dismissed and resumed later
- **Flexible**: Steps can be marked as optional or required

## Architecture

### Components

#### 1. OnboardingTour Component

**Location**: `src/components/onboarding-tour/onboarding-tour.tsx`

The main UI component that displays the onboarding steps. Features:

- Progress bar showing completion status
- Step navigation (next, previous, skip)
- Direct action buttons to navigate to relevant pages
- Manual step completion
- Dismiss/close functionality
- Keyboard support (ESC to close)

**Props**:

```typescript
interface OnboardingTourProps {
  userId: string;
  initialProgress: OnboardingProgress;
  onClose: () => void;
  onComplete: () => void;
}
```

#### 2. OnboardingService

**Location**: `src/services/onboarding.service.ts`

Service layer for managing onboarding progress via API. Methods:

- `getProgress(userId)`: Fetch user's current progress
- `updateProgress(userId, progress)`: Update progress
- `completeStep(userId, step)`: Mark a step as complete
- `dismissTour(userId)`: Dismiss the tour
- `resetProgress(userId)`: Reset all progress

### Data Models

#### OnboardingProgress Interface

**Location**: `src/interfaces/onboarding-progress.interface.ts`

```typescript
export interface OnboardingProgress {
  completed_steps: OnboardingStep[];
  current_step?: OnboardingStep | null;
  is_completed: boolean;
  dismissed: boolean;
}
```

#### OnboardingStep Enum

```typescript
export enum OnboardingStep {
  UploadMedia = 'upload_media',
  CreatePlaylist = 'create_playlist',
  CreateChannel = 'create_channel',
  RegisterDevice = 'register_device',
  AssignChannel = 'assign_channel',
  AdvancedPlaylist = 'advanced_playlist',
}
```

#### OnboardingStepConfig Interface

```typescript
export interface OnboardingStepConfig {
  id: OnboardingStep;
  titleKey: string;
  descriptionKey: string;
  actionKey: string;
  targetPath?: string;
  targetSelector?: string;
  order: number;
  optional?: boolean;
}
```

### Configuration

#### Step Configuration

**Location**: `src/config/onboarding-steps.ts`

The `ONBOARDING_STEPS` array defines all available steps. To add a new step:

```typescript
{
  id: OnboardingStep.NewFeature,
  titleKey: 'onboardingTour.steps.newFeature.title',
  descriptionKey: 'onboardingTour.steps.newFeature.description',
  actionKey: 'onboardingTour.steps.newFeature.action',
  targetPath: '/org/:orgId/new-feature',
  targetSelector: '[data-onboarding="new-feature"]',
  order: 7,
  optional: true,
}
```

**Helper Functions**:

- `getNextStep(completedSteps)`: Returns the next incomplete step
- `getStepConfig(stepId)`: Gets configuration for a specific step
- `isOnboardingComplete(completedSteps)`: Checks if all required steps are done

## Internationalization

All user-facing text is localized in 9 languages. Translation keys are in:
`src/i18n/locales/*.json`

### Translation Structure

```json
{
  "onboardingTour": {
    "title": "Getting Started Tour",
    "progressText": "{{current}} of {{total}} steps completed",
    "steps": {
      "uploadMedia": {
        "title": "Upload Your First Media",
        "description": "Start by uploading images, videos...",
        "action": "Go to Media Library"
      }
      // ... more steps
    }
  }
}
```

## Integration

The onboarding tour is integrated in `src/components/protected-route.tsx`:

1. **Load Progress**: After user authentication and addon loading, fetch onboarding progress
2. **Show Tour**: Display tour if not dismissed and not completed
3. **Handle Events**: Close and completion callbacks update state

```typescript
const loadOnboardingTour = async () => {
  const progress = await OnboardingService.getProgress(user.id);
  if (!progress.dismissed && !progress.is_completed) {
    setOnboardingProgress(progress);
    setShowOnboardingTour(true);
  }
};
```

## Styling

**Location**: `src/components/onboarding-tour/onboarding-tour.scss`

The styling follows the dashboard's dark theme with:

- Overlay with semi-transparent background
- Modal dialog with animations (fade in, slide up)
- Progress bar with gradient
- Responsive design for mobile devices
- Step indicators with completion states

## Backend Requirements

The onboarding system requires the following backend API endpoints:

### 1. Get Onboarding Progress

```
GET /dashboard/users/:userId/onboarding-progress
Response: { data: OnboardingProgress }
```

### 2. Update Onboarding Progress

```
PUT /dashboard/users/:userId/onboarding-progress
Body: { completed_steps, current_step, is_completed, dismissed }
Response: { data: OnboardingProgress }
```

### 3. Complete Step

```
POST /dashboard/users/:userId/onboarding-progress/complete-step
Body: { step: string }
Response: { data: OnboardingProgress }
```

### 4. Dismiss Tour

```
POST /dashboard/users/:userId/onboarding-progress/dismiss
Response: { data: OnboardingProgress }
```

### 5. Reset Progress

```
POST /dashboard/users/:userId/onboarding-progress/reset
Response: { data: OnboardingProgress }
```

## Adding New Steps

To add a new onboarding step:

1. **Add enum value** in `src/interfaces/onboarding-progress.interface.ts`:

```typescript
export enum OnboardingStep {
  // ... existing steps
  NewFeature = 'new_feature',
}
```

2. **Add step configuration** in `src/config/onboarding-steps.ts`:

```typescript
{
  id: OnboardingStep.NewFeature,
  titleKey: 'onboardingTour.steps.newFeature.title',
  descriptionKey: 'onboardingTour.steps.newFeature.description',
  actionKey: 'onboardingTour.steps.newFeature.action',
  targetPath: '/org/:orgId/new-feature',
  order: 7,
  optional: false,
}
```

3. **Add translations** to all locale files in `src/i18n/locales/`:

```json
{
  "onboardingTour": {
    "steps": {
      "newFeature": {
        "title": "New Feature Title",
        "description": "Description of what to do...",
        "action": "Button text"
      }
    }
  }
}
```

4. **Add data-onboarding attribute** to target element (optional):

```tsx
<button data-onboarding="new-feature">Action</button>
```

## User Experience Flow

1. **First Login**: User completes organization onboarding dialog
2. **Tour Appears**: Onboarding tour modal appears after dashboard loads
3. **Step Through**: User can:
   - Click action button to navigate to feature
   - Mark step as complete manually
   - Skip to next step
   - Use dots to jump to any step
   - Dismiss tour (can be resumed later)
4. **Completion**: After all required steps, tour completes automatically

## Testing

To test the onboarding tour:

1. Create a fresh user account
2. Complete organization setup
3. Verify tour appears after login
4. Test navigation buttons
5. Test step completion
6. Test dismiss functionality
7. Verify progress persistence across sessions
8. Test in different languages

## Future Enhancements

Potential improvements:

- Spotlight highlighting of specific UI elements
- Interactive walkthroughs with element highlighting
- Video tutorials embedded in steps
- Personalized onboarding paths based on user role
- Analytics to track which steps users struggle with
- Tooltips that appear contextually on pages
