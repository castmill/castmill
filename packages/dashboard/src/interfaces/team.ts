export interface Team {
  id: number;
  name: string;
  members: string[];
  organizationId: string;
  updatedAt: string;
  insertedAt: string;
}

export interface JsonTeam {
  id: number;
  name: string;
  members: string[];
  organization_id: string;
  inserted_at: string;
  updated_at: string;
}
