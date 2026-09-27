import { useEffect, useState } from "react";
import { supabase, type Shop } from "./supabase";

/** Loads every shop and keeps a selected one, defaulting to the first. */
export function useShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase
      .from("shops")
      .select("shop_id, name, location")
      .order("name")
      .then(({ data }) => {
        if (!alive) return;
        const list = (data as Shop[]) || [];
        setShops(list);
        setShopId((current) => current ?? list[0]?.shop_id ?? null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { shops, shopId, setShopId, loading };
}
