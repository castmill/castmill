import {
  OnboardingStep,
  OnboardingStepConfig,
} from '../interfaces/onboarding-progress.interface';

/**
 * Configuration for onboarding steps
 * This modular configuration allows easy addition of new steps
 */
export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: OnboardingStep.FindGuide,
    titleKey: 'onboardingTour.steps.findGuide.title',
    descriptionKey: 'onboardingTour.steps.findGuide.description',
    actionKey: 'onboardingTour.steps.findGuide.action',
    targetSelector: '[data-onboarding="getting-started"]',
    order: 1,
  },
  {
    id: OnboardingStep.ChooseLanguage,
    titleKey: 'onboardingTour.steps.chooseLanguage.title',
    descriptionKey: 'onboardingTour.steps.chooseLanguage.description',
    actionKey: 'onboardingTour.steps.chooseLanguage.action',
    targetSelector: '[data-onboarding="language-selector"]',
    order: 2,
  },
  {
    id: OnboardingStep.UploadMedia,
    titleKey: 'onboardingTour.steps.uploadMedia.title',
    descriptionKey: 'onboardingTour.steps.uploadMedia.description',
    actionKey: 'onboardingTour.steps.uploadMedia.action',
    targetPath: '/org/:orgId/content/medias',
    targetSelector: '[data-onboarding="upload-media"]',
    order: 3,
    docsUrl: 'https://docs.castmill.com/content/medias',
  },
  {
    id: OnboardingStep.CreatePlaylist,
    titleKey: 'onboardingTour.steps.createPlaylist.title',
    descriptionKey: 'onboardingTour.steps.createPlaylist.description',
    actionKey: 'onboardingTour.steps.createPlaylist.action',
    targetPath: '/org/:orgId/content/playlists',
    targetSelector: '[data-onboarding="add-playlist"]',
    order: 4,
    docsUrl: 'https://docs.castmill.com/content/playlists',
  },
  {
    id: OnboardingStep.CreateChannel,
    titleKey: 'onboardingTour.steps.createChannel.title',
    descriptionKey: 'onboardingTour.steps.createChannel.description',
    actionKey: 'onboardingTour.steps.createChannel.action',
    targetPath: '/org/:orgId/channels',
    targetSelector: '[data-onboarding="create-channel"]',
    order: 5,
    docsUrl: 'https://docs.castmill.com/content/channels',
  },
  {
    id: OnboardingStep.RegisterDevice,
    titleKey: 'onboardingTour.steps.registerDevice.title',
    descriptionKey: 'onboardingTour.steps.registerDevice.description',
    actionKey: 'onboardingTour.steps.registerDevice.action',
    targetPath: '/org/:orgId/devices',
    targetSelector: '[data-onboarding="register-device"]',
    order: 6,
    docsUrl: 'https://docs.castmill.com/devices',
  },
  {
    id: OnboardingStep.AssignChannel,
    titleKey: 'onboardingTour.steps.assignChannel.title',
    descriptionKey: 'onboardingTour.steps.assignChannel.description',
    actionKey: 'onboardingTour.steps.assignChannel.action',
    targetPath: '/org/:orgId/devices',
    targetSelector: '[data-onboarding="assign-channel"]',
    order: 7,
  },
  {
    id: OnboardingStep.AdvancedPlaylist,
    titleKey: 'onboardingTour.steps.advancedPlaylist.title',
    descriptionKey: 'onboardingTour.steps.advancedPlaylist.description',
    actionKey: 'onboardingTour.steps.advancedPlaylist.action',
    targetPath: '/org/:orgId/content/layouts',
    targetSelector: '[data-onboarding="advanced-playlist"]',
    order: 8,
    optional: true,
  },
  {
    id: OnboardingStep.CreateTagGroup,
    titleKey: 'onboardingTour.steps.createTagGroup.title',
    descriptionKey: 'onboardingTour.steps.createTagGroup.description',
    actionKey: 'onboardingTour.steps.createTagGroup.action',
    targetPath: '/org/:orgId/tags',
    targetSelector: '[data-onboarding="create-tag-group"]',
    order: 9,
    docsUrl: 'https://docs.castmill.com/content/tags',
  },
  {
    id: OnboardingStep.TagContent,
    titleKey: 'onboardingTour.steps.tagContent.title',
    descriptionKey: 'onboardingTour.steps.tagContent.description',
    actionKey: 'onboardingTour.steps.tagContent.action',
    targetPath: '/org/:orgId/content/medias',
    targetSelector: '[data-onboarding="tag-content"]',
    order: 10,
  },
  {
    id: OnboardingStep.ExploreTreeView,
    titleKey: 'onboardingTour.steps.exploreTreeView.title',
    descriptionKey: 'onboardingTour.steps.exploreTreeView.description',
    actionKey: 'onboardingTour.steps.exploreTreeView.action',
    targetPath: '/org/:orgId/content/medias',
    targetSelector: '[data-onboarding="tree-view-toggle"]',
    order: 11,
  },
];

/**
 * Get the next onboarding step based on completed steps
 */
export function getNextStep(
  completedSteps: OnboardingStep[]
): OnboardingStep | null {
  const nextStep = ONBOARDING_STEPS.find(
    (step) => !completedSteps.includes(step.id)
  );
  return nextStep ? nextStep.id : null;
}

/**
 * Get step configuration by step ID
 */
export function getStepConfig(
  stepId: OnboardingStep
): OnboardingStepConfig | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === stepId);
}

/**
 * Check if all required onboarding steps are complete
 */
export function isOnboardingComplete(
  completedSteps: OnboardingStep[]
): boolean {
  const requiredSteps = ONBOARDING_STEPS.filter((step) => !step.optional);
  return requiredSteps.every((step) => completedSteps.includes(step.id));
}
