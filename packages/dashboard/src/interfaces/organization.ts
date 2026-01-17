export interface Organization {
  id: string;
  name: string;
  logo_media_id?: number | null;
  onboarding_completed?: boolean;
  created_at: string;
  updated_at: string;
}
