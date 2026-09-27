import { CUPS_PER_SEALED_PACK } from "./products";
import { supabase } from "./supabase";

export type CupSize = { size: string; price: number };

export const yoghurtCupPresets: CupSize[] = [
  { size: "200 ml", price: 50 },
  { size: "250 ml", price: 60 },
  { size: "300 ml", price: 70 },
  { size: "500 ml", price: 100 },
  { size: "1000 ml", price: 190 },
];

export type CupRow = {
  size: string;
  price?: number | string;
  sealed: string;
  unsealed: string;
};

export function cupCount(entry?: Partial<CupRow> | null): number {
  if (!entry) return 0;
  return (
    Number(entry.sealed || 0) * CUPS_PER_SEALED_PACK + Number(entry.unsealed || 0)
  );
}

export function cupsBySize(rows: CupRow[] | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  (rows || []).forEach((entry) => {
    if (entry && entry.size) map.set(entry.size, cupCount(entry));
  });
  return map;
}

function hasCount(rows: CupRow[]): boolean {
  return rows.some(
    (cup) => (cup.sealed ?? "") !== "" || (cup.unsealed ?? "") !== ""
  );
}

type CupsPayload = { closing?: CupRow[]; stockIn?: CupRow[] } | CupRow[] | null;

function closingOf(cups: CupsPayload): CupRow[] {
  if (Array.isArray(cups)) return cups;
  return cups?.closing || [];
}

function stockInOf(cups: CupsPayload): CupRow[] {
  if (Array.isArray(cups)) return [];
  return cups?.stockIn || [];
}

/**
 * Cups carried into the selected day per size, same rule as stock: the cups left
 * at the most recent earlier closing count, plus every cup stock-in booked on the
 * days since - so "what was there initially + everything added" is never dropped.
 */
export async function fetchCarriedYoghurtCups(
  shopId: number,
  beforeDateIso: string
): Promise<Map<string, number>> {
  const carried = new Map<string, number>();
  const { data, error } = await supabase
    .from("closing_details")
    .select("entry_date, yoghurt_cups")
    .eq("shop_id", shopId)
    .lt("entry_date", beforeDateIso)
    .order("entry_date", { ascending: false });
  if (error || !data || data.length === 0) return carried;

  const anchorIndex = data.findIndex((row) => hasCount(closingOf(row.yoghurt_cups)));
  const gapRows = anchorIndex === -1 ? data : data.slice(0, anchorIndex);

  yoghurtCupPresets.forEach((preset) => {
    const base =
      anchorIndex === -1
        ? 0
        : cupCount(
            closingOf(data[anchorIndex].yoghurt_cups).find(
              (cup) => cup.size === preset.size
            )
          );
    const added = gapRows.reduce((sum, row) => {
      const cup = stockInOf(row.yoghurt_cups).find((e) => e.size === preset.size);
      return sum + (cup ? cupCount(cup) : 0);
    }, 0);
    if (base + added !== 0) carried.set(preset.size, base + added);
  });

  return carried;
}

export type CupSale = {
  size: string;
  price: number;
  opening: number;
  left: number;
  sold: number;
  cash: number;
  counted: boolean;
};

/**
 * Per cup size: (opening - cups left) * price.
 * opening = cups carried in + cups the owner booked in that morning.
 */
export function yoghurtCupSales(
  closingRows: Map<string, CupRow>,
  carried: Map<string, number>,
  morning: Map<string, number>
): CupSale[] {
  return yoghurtCupPresets.map((preset) => {
    const row = closingRows.get(preset.size);
    const counted =
      !!row && ((row.sealed ?? "") !== "" || (row.unsealed ?? "") !== "");
    const opening =
      (carried.get(preset.size) || 0) + (morning.get(preset.size) || 0);
    const left = counted ? cupCount(row) : 0;
    const sold = counted ? Math.max(opening - left, 0) : 0;
    return {
      size: preset.size,
      price: preset.price,
      opening,
      left,
      sold,
      cash: sold * preset.price,
      counted,
    };
  });
}

export function cupCashTotal(sales: CupSale[]): number {
  return sales.reduce((total, entry) => total + entry.cash, 0);
}
