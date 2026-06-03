export type RoomRecord = {
  id: string;
  name: string;
  slug: string;
  capacity: number | null;
  color: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};
