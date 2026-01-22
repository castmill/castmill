import { baseUrl } from '../env';
import {
  OnboardingProgress,
  OnboardingStep,
} from '../interfaces/onboarding-progress.interface';

export const OnboardingService = {
  /**
   * Get user's onboarding progress
   */
  async getProgress(userId: string): Promise<OnboardingProgress> {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/onboarding-progress`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return (await response.json())?.data as OnboardingProgress;
    } else if (response.status === 404) {
      // No progress yet, return default
      return {
        completed_steps: [],
        current_step: null,
        is_completed: false,
        dismissed: false,
      };
    } else {
      throw new Error('Failed to fetch onboarding progress');
    }
  },

  /**
   * Update user's onboarding progress
   */
  async updateProgress(
    userId: string,
    progress: Partial<OnboardingProgress>
  ): Promise<OnboardingProgress> {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/onboarding-progress`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progress),
      }
    );

    if (response.status === 200) {
      return (await response.json())?.data as OnboardingProgress;
    } else {
      throw new Error('Failed to update onboarding progress');
    }
  },

  /**
   * Mark a step as completed
   */
  async completeStep(
    userId: string,
    step: OnboardingStep
  ): Promise<OnboardingProgress> {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/onboarding-progress/complete-step`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ step }),
      }
    );

    if (response.status === 200) {
      return (await response.json())?.data as OnboardingProgress;
    } else {
      throw new Error('Failed to complete onboarding step');
    }
  },

  /**
   * Dismiss the onboarding tour
   */
  async dismissTour(userId: string): Promise<OnboardingProgress> {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/onboarding-progress/dismiss`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return (await response.json())?.data as OnboardingProgress;
    } else {
      throw new Error('Failed to dismiss onboarding tour');
    }
  },

  /**
   * Reset onboarding progress
   */
  async resetProgress(userId: string): Promise<OnboardingProgress> {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/onboarding-progress/reset`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return (await response.json())?.data as OnboardingProgress;
    } else {
      throw new Error('Failed to reset onboarding progress');
    }
  },
};
