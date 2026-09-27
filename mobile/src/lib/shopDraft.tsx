import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import { dayIso } from "./dates";
import {
  computeEntry,
  EGGS_PER_TRAY,
  isEgg,
  isYoghurt,
  packPieceCount,
  yoghurtFlavours,
  type EntryResult,
} from "./products";
import { fetchCarriedBalances } from "./stock";
import { supabase, type Product } from "./supabase";
import {
  cupCashTotal,
  cupsBySize,
  fetchCarriedYoghurtCups,
  yoghurtCupPresets,
  yoghurtCupSales,
  type CupRow,
  type CupSale,
} from "./yoghurt";

export type Count = { primary: string; secondary: string };

type Money = { mpesa: string; notes: string; coins: string };

type Ctx = {
  date: string;
  setDate: (iso: string) => void;
  loading: boolean;
  products: Product[];
  /** Opening stock per product, in the product's counting unit. */
  openings: Map<number, number>;
  /** Where each opening came from, for the note under each product. */
  carryNotes: Map<number, string>;
  counts: Record<number, Count>;
  setCount: (productId: number, patch: Partial<Count>) => void;
  results: Map<number, EntryResult>;
  productCash: number;

  cupRows: Record<string, CupRow>;
  setCupRow: (size: string, patch: Partial<CupRow>) => void;
  cupSales: CupSale[];
  cupCash: number;

  flavours: Record<string, string>;
  setFlavour: (flavour: string, value: string) => void;

  money: Money;
  setMoney: (patch: Partial<Money>) => void;
  received: number;
  expected: number;
  difference: number;

  firstError: { name: string; reason: string; opening: number } | null;
  reload: () => void;
  save: () => Promise<{ ok: boolean; message: string }>;
};

const ShopDraftContext = createContext<Ctx | null>(null);

export function ShopDraftProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const shopId = user?.shop_id ?? null;

  const [date, setDate] = useState(dayIso());
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [openings, setOpenings] = useState<Map<number, number>>(new Map());
  const [carryNotes, setCarryNotes] = useState<Map<number, string>>(new Map());
  const [counts, setCounts] = useState<Record<number, Count>>({});
  const [cupRows, setCupRows] = useState<Record<string, CupRow>>({});
  const [carriedCups, setCarriedCups] = useState<Map<string, number>>(new Map());
  const [morningCups, setMorningCups] = useState<Map<string, number>>(new Map());
  const [flavours, setFlavours] = useState<Record<string, string>>({});
  const [money, setMoneyState] = useState<Money>({ mpesa: "", notes: "", coins: "" });

  const reload = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);

    const [assigned, todayRows, carried, details, cupsCarried] = await Promise.all([
      supabase.from("shop_products").select("product_id, products(*)").eq("shop_id", shopId),
      supabase
        .from("daily_stock_entries")
        .select("product_id, quantity_in")
        .eq("shop_id", shopId)
        .eq("entry_date", date),
      fetchCarriedBalances(shopId, date),
      supabase
        .from("closing_details")
        .select("mpesa_amount, cash_notes, cash_coins, yoghurt_cups, yoghurt_flavours")
        .eq("shop_id", shopId)
        .eq("entry_date", date)
        .maybeSingle(),
      fetchCarriedYoghurtCups(shopId, date),
    ]);

    const list = ((assigned.data as unknown as { products: Product }[]) || [])
      .map((row) => row.products)
      .filter((p) => p && p.is_active !== false)
      .sort(
        (a, b) =>
          (a.category || "").localeCompare(b.category || "") ||
          a.name.localeCompare(b.name)
      );

    const addedByProduct = new Map(
      ((todayRows.data as { product_id: number; quantity_in: number | null }[]) || []).map(
        (row) => [row.product_id, Number(row.quantity_in ?? 0)]
      )
    );

    const nextOpenings = new Map<number, number>();
    const nextNotes = new Map<number, string>();

    list.forEach((product) => {
      const added = addedByProduct.get(product.product_id) ?? 0;
      const carry = carried.get(product.product_id);
      const priorRemaining = carry?.remaining ?? 0;
      const gapStockIn = carry?.gapStockIn ?? 0;

      // Remaining counts are stored in pieces/ml; egg stock-in is booked in trays.
      const egg = isEgg(product);
      const carryTotal = egg
        ? priorRemaining + gapStockIn * EGGS_PER_TRAY
        : priorRemaining + gapStockIn;
      const opening = egg ? carryTotal + added * EGGS_PER_TRAY : carryTotal + added;

      nextOpenings.set(product.product_id, opening);
      nextNotes.set(
        product.product_id,
        !carry
          ? "No earlier balance — opening is this morning's stock-in only."
          : carry.noCount
            ? "Carried from stock-in (no closing count saved yet)."
            : `Carried from the ${carry.date} count${
                gapStockIn ? ", plus stock added since" : ""
              }.`
      );
    });

    const payload = details.data?.yoghurt_cups;
    const savedClosing: CupRow[] = Array.isArray(payload) ? payload : payload?.closing || [];
    const nextCupRows: Record<string, CupRow> = {};
    yoghurtCupPresets.forEach((preset) => {
      const found = savedClosing.find((c) => c.size === preset.size);
      nextCupRows[preset.size] = {
        size: preset.size,
        price: preset.price,
        sealed: found?.sealed ?? "",
        unsealed: found?.unsealed ?? "",
      };
    });

    const nextFlavours: Record<string, string> = {};
    yoghurtFlavours.forEach((flavour) => {
      const found = (details.data?.yoghurt_flavours || []).find(
        (f: { flavour: string }) => f.flavour === flavour
      );
      nextFlavours[flavour] = found?.remaining ?? "";
    });

    setProducts(list);
    setOpenings(nextOpenings);
    setCarryNotes(nextNotes);
    setCounts({});
    setCupRows(nextCupRows);
    setCarriedCups(cupsCarried);
    setMorningCups(cupsBySize(Array.isArray(payload) ? [] : payload?.stockIn || []));
    setFlavours(nextFlavours);
    setMoneyState({
      mpesa: details.data?.mpesa_amount ? String(details.data.mpesa_amount) : "",
      notes: details.data?.cash_notes ? String(details.data.cash_notes) : "",
      coins: details.data?.cash_coins ? String(details.data.cash_coins) : "",
    });
    setLoading(false);
  }, [shopId, date]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setCount = useCallback((productId: number, patch: Partial<Count>) => {
    setCounts((prev) => {
      const existing: Count = prev[productId] ?? { primary: "", secondary: "" };
      return { ...prev, [productId]: { ...existing, ...patch } };
    });
  }, []);

  const setCupRow = useCallback((size: string, patch: Partial<CupRow>) => {
    setCupRows((prev) => ({ ...prev, [size]: { ...prev[size], ...patch } }));
  }, []);

  const setFlavour = useCallback((flavour: string, value: string) => {
    setFlavours((prev) => ({ ...prev, [flavour]: value }));
  }, []);

  const setMoney = useCallback((patch: Partial<Money>) => {
    setMoneyState((prev) => ({ ...prev, ...patch }));
  }, []);

  const results = useMemo(() => {
    const map = new Map<number, EntryResult>();
    products.forEach((product) => {
      if (isYoghurt(product)) return;
      const count = counts[product.product_id] ?? { primary: "", secondary: "" };
      map.set(
        product.product_id,
        computeEntry(product, openings.get(product.product_id) ?? 0, count)
      );
    });
    return map;
  }, [products, counts, openings]);

  const productCash = useMemo(() => {
    let total = 0;
    results.forEach((result) => {
      if (result.kind === "ok") total += result.cash;
    });
    return total;
  }, [results]);

  const cupSales = useMemo(
    () =>
      yoghurtCupSales(
        new Map(Object.entries(cupRows)),
        carriedCups,
        morningCups
      ),
    [cupRows, carriedCups, morningCups]
  );

  const cupCash = useMemo(() => cupCashTotal(cupSales), [cupSales]);

  const firstError = useMemo(() => {
    for (const product of products) {
      const result = results.get(product.product_id);
      if (result?.kind === "error") {
        return { name: product.name, reason: result.reason, opening: result.opening };
      }
    }
    return null;
  }, [products, results]);

  const received =
    Number(money.mpesa || 0) + Number(money.notes || 0) + Number(money.coins || 0);
  const expected = productCash + cupCash;

  const save = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!shopId || !user) return { ok: false, message: "No shop is linked to this login." };
    if (firstError) {
      return {
        ok: false,
        message: `${firstError.name}: ${firstError.reason} Opening was ${firstError.opening}.`,
      };
    }

    const entries: Record<string, unknown>[] = [];
    products.forEach((product) => {
      if (isYoghurt(product)) return;
      const result = results.get(product.product_id);
      if (!result || result.kind !== "ok") return;
      entries.push({
        shop_id: shopId,
        product_id: product.product_id,
        entry_date: date,
        quantity_out: result.sold,
        secondary_quantity_out: result.remaining,
        sales_amount: result.cash,
        quantity_out_by_user_id: user.user_id,
      });
    });

    const flavourEntries = yoghurtFlavours
      .map((flavour) => ({ flavour, remaining: flavours[flavour] ?? "" }))
      .filter((entry) => entry.remaining !== "");
    const cupsSold = cupSales.reduce((total, sale) => total + sale.sold, 0);
    const yoghurt = products.find(isYoghurt);

    if (yoghurt && (flavourEntries.length > 0 || cupCash > 0)) {
      const flavourTotal = flavourEntries.reduce(
        (total, entry) => total + Number(entry.remaining),
        0
      );
      entries.push({
        shop_id: shopId,
        product_id: yoghurt.product_id,
        entry_date: date,
        quantity_out: cupCash > 0 ? cupsSold : null,
        secondary_quantity_out: flavourEntries.length ? flavourTotal : null,
        sales_amount: cupCash > 0 ? cupCash : null,
        quantity_out_by_user_id: user.user_id,
      });
    }

    const hasMoney = money.mpesa !== "" || money.notes !== "" || money.coins !== "";
    if (entries.length === 0 && !hasMoney) {
      return { ok: false, message: "Enter at least one value before submitting." };
    }

    if (entries.length > 0) {
      const { error } = await supabase
        .from("daily_stock_entries")
        .upsert(entries, { onConflict: "shop_id,product_id,entry_date" });
      if (error) {
        return { ok: false, message: "Unable to save the stock counts. Try again." };
      }
    }

    const closingCups = Object.values(cupRows).filter(
      (cup) => cup.sealed !== "" || cup.unsealed !== ""
    );
    const { data: existing } = await supabase
      .from("closing_details")
      .select("yoghurt_cups")
      .eq("shop_id", shopId)
      .eq("entry_date", date)
      .maybeSingle();
    const payload = existing?.yoghurt_cups;
    const keptStockIn = Array.isArray(payload) ? [] : payload?.stockIn || [];

    const { error: closingError } = await supabase.from("closing_details").upsert(
      {
        shop_id: shopId,
        entry_date: date,
        mpesa_amount: Number(money.mpesa || 0),
        cash_notes: Number(money.notes || 0),
        cash_coins: Number(money.coins || 0),
        yoghurt_cups: { stockIn: keptStockIn, closing: closingCups },
        yoghurt_flavours: flavourEntries,
      },
      { onConflict: "shop_id,entry_date" }
    );

    if (closingError) {
      return {
        ok: false,
        message: "Stock saved, but the closing details could not be sent.",
      };
    }

    await reload();
    return { ok: true, message: "Closing balance submitted to the owner." };
  }, [
    shopId,
    user,
    firstError,
    products,
    results,
    date,
    flavours,
    cupSales,
    cupCash,
    cupRows,
    money,
    reload,
  ]);

  const value: Ctx = {
    date,
    setDate,
    loading,
    products,
    openings,
    carryNotes,
    counts,
    setCount,
    results,
    productCash,
    cupRows,
    setCupRow,
    cupSales,
    cupCash,
    flavours,
    setFlavour,
    money,
    setMoney,
    received,
    expected,
    difference: received - expected,
    firstError,
    reload,
    save,
  };

  return <ShopDraftContext.Provider value={value}>{children}</ShopDraftContext.Provider>;
}

export function useShopDraft(): Ctx {
  const ctx = useContext(ShopDraftContext);
  if (!ctx) throw new Error("useShopDraft must be used inside ShopDraftProvider");
  return ctx;
}

/** How many products still have nothing entered. */
export function pendingCount(ctx: Ctx): number {
  let pending = 0;
  ctx.products.forEach((product) => {
    if (isYoghurt(product)) return;
    const result = ctx.results.get(product.product_id);
    if (!result || result.kind === "empty") pending += 1;
  });
  return pending;
}

export function countedLabel(product: Product): { primary: string; secondary?: string } {
  if (isEgg(product)) {
    return { primary: "Trays left", secondary: "Loose pieces left" };
  }
  const packSize = packPieceCount(product);
  if (packSize) {
    return { primary: "Packs left", secondary: "Loose pieces left" };
  }
  return { primary: `Remaining (${product.unit_label})` };
}
