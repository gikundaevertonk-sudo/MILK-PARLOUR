import { supabase } from "./supabase";

export type Carried = {
  /** Most recent saved remaining count. */
  remaining: number;
  /** Stock-in booked on the unclosed days since that count. */
  gapStockIn: number;
  /** Date the count came from. */
  date: string;
  /** True when no closing count has ever been saved for this product. */
  noCount?: boolean;
};

/**
 * Carry-forward opening stock per product for a given day:
 *   most recent saved remaining count + any stock-in booked on the days between
 *   that count and the selected day.
 *
 * Keeps the leftover reflecting as the new opening stock the moment a closing
 * balance is saved (no stock-in needed), and stops a missed closing from
 * dropping stock-in that happened on the skipped days.
 */
export async function fetchCarriedBalances(
  shopId: number,
  beforeDateIso: string
): Promise<Map<number, Carried>> {
  const carried = new Map<number, Carried>();
  const { data, error } = await supabase
    .from("daily_stock_entries")
    .select("product_id, quantity_in, secondary_quantity_out, entry_date")
    .eq("shop_id", shopId)
    .lt("entry_date", beforeDateIso)
    .order("entry_date", { ascending: false });
  if (error || !data) return carried;

  const rowsByProduct = new Map<number, typeof data>();
  data.forEach((row) => {
    const list = rowsByProduct.get(row.product_id);
    if (list) list.push(row);
    else rowsByProduct.set(row.product_id, [row]);
  });

  rowsByProduct.forEach((rows, productId) => {
    // rows are newest-first; the anchor is the latest day that has a saved count.
    const anchorIndex = rows.findIndex((row) => row.secondary_quantity_out != null);
    if (anchorIndex === -1) {
      // No closing count has ever been saved: fall back to the total stock-in.
      const stockInOnly = rows.reduce((sum, row) => sum + Number(row.quantity_in ?? 0), 0);
      if (stockInOnly !== 0) {
        carried.set(productId, {
          remaining: 0,
          gapStockIn: stockInOnly,
          date: rows[rows.length - 1].entry_date,
          noCount: true,
        });
      }
      return;
    }
    const anchor = rows[anchorIndex];
    // Rows newer than the anchor are days with no closing count of their own;
    // any stock-in booked on them still belongs in the opening balance.
    const gapStockIn = rows
      .slice(0, anchorIndex)
      .reduce((sum, row) => sum + Number(row.quantity_in ?? 0), 0);
    carried.set(productId, {
      remaining: Number(anchor.secondary_quantity_out),
      gapStockIn,
      date: anchor.entry_date,
    });
  });

  return carried;
}
