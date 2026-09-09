import { OnboardingProgress } from './onboarding-progress.interface';

export interface User {
  id: string;
  name: string;
  email: string;
  insertedAt: string;
  updatedAt: string;
  onboarding_progress?: OnboardingProgress;
}
