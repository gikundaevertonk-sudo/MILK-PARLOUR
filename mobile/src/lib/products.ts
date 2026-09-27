import type { Product } from "./supabase";

export const EGGS_PER_TRAY = 30;
export const TWIN_PIECES_PER_PACK = 2;
export const SIMBA_PIECES_PER_PACK = 18;
export const CUPS_PER_SEALED_PACK = 25;

export const yoghurtFlavours = [
  "Strawberry",
  "Vanilla",
  "Blueberry",
  "Pineapple",
  "Chocolate",
];

export function isLiquid(product: Product): boolean {
  return (product.unit_label || "").toLowerCase() === "ml";
}

export function isYoghurt(product: Product): boolean {
  return (product.category || "").toLowerCase() === "yoghurt";
}

export function isEgg(product: Product): boolean {
  const category = (product.category || "").toLowerCase();
  const name = (product.name || "").toLowerCase();
  return category === "eggs" || category === "trays" || name === "eggs";
}

/** Pieces per pack for products sold by pack, or 0 when not a pack product. */
export function packPieceCount(product: Product): number {
  const name = (product.name || "").toLowerCase();
  if (name.includes("twin")) return TWIN_PIECES_PER_PACK;
  if (name.includes("simba") && (name.includes("ice cream") || name.includes("stick"))) {
    return SIMBA_PIECES_PER_PACK;
  }
  return 0;
}

export function piecePrice(product: Product, packSize: number): number {
  const name = (product.name || "").toLowerCase();
  if (name.includes("simba")) return Number(product.unit_price ?? 0);
  if (name.includes("twin")) return 30;
  return Number(product.unit_price ?? 0) / packSize;
}

export function eggPiecePrice(product: Product): number {
  return Number(product.unit_price ?? 0) / EGGS_PER_TRAY;
}

export function trimNumber(value: number): number {
  return Number(value.toFixed(2));
}

export function formatPackPieces(value: number | null, packSize: number): string {
  if (value == null) return "";
  const pieces = Number(value);
  const packs = Math.floor(pieces / packSize);
  const loose = pieces % packSize;
  const loosePart = loose ? ` + ${loose} piece${loose === 1 ? "" : "s"}` : "";
  return `${packs} pack${packs === 1 ? "" : "s"}${loosePart} (${pieces} pieces)`;
}

export type EntryInput = {
  /** Eggs: trays. Pack products: packs. Everything else: the single remaining value. */
  primary: string;
  /** Eggs: loose pieces. Pack products: loose pieces. Unused otherwise. */
  secondary: string;
};

export type EntryResult =
  | { kind: "empty" }
  | { kind: "error"; opening: number; reason: string }
  | { kind: "ok"; sold: number; remaining: number; cash: number };

/**
 * Turn what the attendant typed (always what is REMAINING) into sold + cash.
 * Mirrors computeProductResult() in the web app.
 */
export function computeEntry(
  product: Product,
  opening: number,
  input: EntryInput
): EntryResult {
  const { primary, secondary } = input;

  if (isEgg(product)) {
    if (primary === "" && secondary === "") return { kind: "empty" };
    const trays = Number(primary || 0);
    const loose = Number(secondary || 0);
    if (!Number.isFinite(trays) || !Number.isFinite(loose) || trays < 0 || loose < 0) {
      return { kind: "error", opening, reason: "Enter valid, non-negative numbers." };
    }
    const remaining = trays * EGGS_PER_TRAY + loose;
    const sold = opening - remaining;
    if (sold < 0) {
      return { kind: "error", opening, reason: "More left than the opening stock." };
    }
    return { kind: "ok", sold, remaining, cash: sold * eggPiecePrice(product) };
  }

  const packPieces = packPieceCount(product);
  if (packPieces) {
    if (primary === "" && secondary === "") return { kind: "empty" };
    const packs = Number(primary || 0);
    const loose = Number(secondary || 0);
    if (!Number.isFinite(packs) || !Number.isFinite(loose) || packs < 0 || loose < 0) {
      return { kind: "error", opening, reason: "Enter valid, non-negative numbers." };
    }
    const remaining = packs * packPieces + loose;
    const sold = opening - remaining;
    if (sold < 0) {
      return { kind: "error", opening, reason: "More left than the opening stock." };
    }
    return {
      kind: "ok",
      sold,
      remaining,
      cash: sold * piecePrice(product, packPieces),
    };
  }

  if (primary === "") return { kind: "empty" };
  const value = Number(primary);
  if (!Number.isFinite(value) || value < 0) {
    return { kind: "error", opening, reason: "Enter a valid, non-negative number." };
  }
  const sold = opening - value;
  if (sold < 0) {
    return { kind: "error", opening, reason: "More left than the opening stock." };
  }
  const price = Number(product.unit_price ?? 0);
  // Yoghurt earns nothing per ml - its money comes from cup sales.
  const cash = isYoghurt(product)
    ? 0
    : isLiquid(product)
      ? (sold / 1000) * price
      : sold * price;
  return { kind: "ok", sold, remaining: value, cash };
}

/** How the "Opening stock" line should read for a product. */
export function openingUnit(product: Product): string {
  if (isEgg(product) || packPieceCount(product)) return "pieces";
  return product.unit_label;
}

export function priceNote(product: Product): string {
  if (isEgg(product)) {
    return `1 tray = ${EGGS_PER_TRAY} pieces · ${eggPiecePrice(product).toFixed(2)} per piece`;
  }
  const packPieces = packPieceCount(product);
  if (packPieces) {
    const per = piecePrice(product, packPieces);
    return `1 pack = ${packPieces} pieces · ${per.toFixed(2)} per piece`;
  }
  if (isYoghurt(product)) return "Cash is counted from cup sales";
  if (isLiquid(product)) return `${product.unit_price ?? "not set"} per 1000 ml`;
  return `${product.unit_price ?? "not set"} per ${product.unit_label}`;
}
