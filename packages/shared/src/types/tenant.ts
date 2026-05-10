export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
