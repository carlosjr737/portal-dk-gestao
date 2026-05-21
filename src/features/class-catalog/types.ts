export type CatalogStatus = "active" | "inactive";

export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  status: CatalogStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CatalogOption = {
  id: string;
  name: string;
};
