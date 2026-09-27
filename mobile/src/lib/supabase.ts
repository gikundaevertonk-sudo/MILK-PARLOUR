import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vprjqxvfmpmpflovzzug.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwcmpxeHZmbXBtcGZsb3Z6enVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMjI0NDMsImV4cCI6MjEwMzY5ODQ0M30.otbND1EPFT-nw9vbF3qPjvSzSXUr0GOc9CZosWtyMig";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export type Role = "Owner" | "Shop" | "Controller";

export type User = {
  user_id: number;
  display_name: string;
  username: string;
  role: Role;
  shop_id: number | null;
};

export type Product = {
  product_id: number;
  name: string;
  category: string | null;
  unit_label: string;
  unit_price: number | null;
  is_active?: boolean;
  track_quantity_in?: boolean;
};

export type StockEntry = {
  product_id: number;
  entry_date: string;
  quantity_in: number | null;
  quantity_out: number | null;
  secondary_quantity_out: number | null;
  sales_amount: number | null;
};

export type Shop = {
  shop_id: number;
  name: string;
  location?: string | null;
};
