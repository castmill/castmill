export interface Credential {
  id: string;
  name: string;
  inserted_at: string;
  updated_at: string;
}

export interface EmailVerificationState {
  pendingEmail?: string;
  verificationSent: boolean;
  isVerifying: boolean;
}
