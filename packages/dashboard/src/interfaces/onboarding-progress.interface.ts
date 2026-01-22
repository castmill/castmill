/**
 * Interface for tracking user onboarding progress
 */

export enum OnboardingStep {
  FindGuide = 'find_guide',
  ChooseLanguage = 'choose_language',
  UploadMedia = 'upload_media',
  CreatePlaylist = 'create_playlist',
  CreateChannel = 'create_channel',
  RegisterDevice = 'register_device',
  AssignChannel = 'assign_channel',
  AdvancedPlaylist = 'advanced_playlist',
}

export interface OnboardingProgress {
  completed_steps: OnboardingStep[];
  current_step?: OnboardingStep | null;
  is_completed: boolean;
  dismissed: boolean;
}

export interface OnboardingStepConfig {
  id: OnboardingStep;
  titleKey: string;
  descriptionKey: string;
  actionKey: string;
  targetPath?: string;
  targetSelector?: string;
  order: number;
  optional?: boolean;
  docsUrl?: string;
}
