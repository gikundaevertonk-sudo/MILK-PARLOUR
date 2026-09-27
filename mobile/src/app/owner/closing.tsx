import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { DateField, ShopPicker } from "@/components/pickers";
import { Card, Empty, StatRow } from "@/components/ui";
import { dayIso } from "@/lib/dates";
import {
  formatPackPieces,
  isYoghurt,
  packPieceCount,
  priceNote,
} from "@/lib/products";
import { fetchCarriedBalances } from "@/lib/stock";
import { supabase, type Product, type StockEntry } from "@/lib/supabase";
import { colors, font, spacing } from "@/lib/theme";
import { useShops } from "@/lib/useShops";
import {
  cupCashTotal,
  cupsBySize,
  fetchCarriedYoghurtCups,
  yoghurtCupSales,
  type CupRow,
  type CupSale,
} from "@/lib/yoghurt";

type Line = {
  product: Product;
  opening: number;
  added: number;
  sold: number | null;
  remaining: number | null;
  sales: number | null;
};

export default function ClosingBalances() {
  const { shops, shopId, setShopId } = useShops();
  const [date, setDate] = useState(dayIso());
  const [lines, setLines] = useState<Line[]>([]);
  const [cups, setCups] = useState<CupSale[]>([]);
  const [flavours, setFlavours] = useState<{ flavour: string; remaining: string }[]>([]);
  const [money, setMoney] = useState({ mpesa: 0, notes: 0, coins: 0 });
  const [expected, setExpected] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);

    const [assigned, entries, carried, details, carriedCups] = await Promise.all([
      supabase
        .from("shop_products")
        .select("product_id, products(*)")
        .eq("shop_id", shopId),
      supabase
        .from("daily_stock_entries")
        .select(
          "product_id, quantity_in, quantity_out, secondary_quantity_out, sales_amount"
        )
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

    const byProduct = new Map(
      ((entries.data as StockEntry[]) || []).map((e) => [e.product_id, e])
    );

    const products = ((assigned.data as unknown as { products: Product }[]) || [])
      .map((row) => row.products)
      .filter(Boolean)
      .sort(
        (a, b) =>
          (a.category || "").localeCompare(b.category || "") ||
          a.name.localeCompare(b.name)
      );

    let salesTotal = 0;
    const built: Line[] = products.map((product) => {
      const entry = byProduct.get(product.product_id);
      const added = Number(entry?.quantity_in ?? 0);
      const carry = carried.get(product.product_id);
      const carryTotal = carry ? carry.remaining + carry.gapStockIn : 0;

      // Yoghurt money is recomputed live from cup counts, never from a stale save.
      if (!isYoghurt(product)) salesTotal += Number(entry?.sales_amount ?? 0);

      return {
        product,
        opening: carryTotal + added,
        added,
        sold: entry?.quantity_out ?? null,
        remaining: entry?.secondary_quantity_out ?? null,
        sales: entry?.sales_amount ?? null,
      };
    });

    const payload = details.data?.yoghurt_cups;
    const closingRows: CupRow[] = Array.isArray(payload) ? payload : payload?.closing || [];
    const morning = cupsBySize(Array.isArray(payload) ? [] : payload?.stockIn || []);
    const cupSales = yoghurtCupSales(
      new Map(closingRows.map((c) => [c.size, c])),
      carriedCups,
      morning
    );
    const cupCash = cupCashTotal(cupSales);

    setLines(built);
    setCups(cupSales.filter((c) => c.counted || c.opening > 0));
    setFlavours(
      (details.data?.yoghurt_flavours || []).filter(
        (f: { remaining: string }) => f.remaining !== "" && f.remaining != null
      )
    );
    setMoney({
      mpesa: Number(details.data?.mpesa_amount || 0),
      notes: Number(details.data?.cash_notes || 0),
      coins: Number(details.data?.cash_coins || 0),
    });
    setExpected(salesTotal + cupCash);
    setLoading(false);
  }, [shopId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const cash = money.notes + money.coins;
  const received = money.mpesa + cash;
  const difference = received - expected;
  const cupCash = cupCashTotal(cups);

  return (
    <Screen
      intro="Opening is what carried forward plus what was booked in. Sold and remaining are what the attendant submitted."
      loading={loading}
      onRefresh={load}
    >
      <ShopPicker shops={shops} value={shopId} onChange={setShopId} />
      <DateField label="Date" value={date} onChange={setDate} />

      <Card title="Money reconciliation" tone={difference < 0 ? "danger" : "accent"}>
        <StatRow label="M-Pesa" value={money.mpesa.toFixed(2)} />
        <StatRow label="Cash (notes + coins)" value={cash.toFixed(2)} />
        <StatRow label="Total received" value={received.toFixed(2)} strong />
        <StatRow label="Expected sales" value={expected.toFixed(2)} strong />
        <StatRow
          label="Difference"
          value={difference.toFixed(2)}
          tone={difference < 0 ? "danger" : "accent"}
          strong
        />
      </Card>

      {lines.length === 0 ? (
        <Card>
          <Empty text="No products are assigned to this shop." />
        </Card>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Stock</Text>
          {lines.map((line) => {
            const packSize = packPieceCount(line.product);
            const unit = packSize ? "" : ` ${line.product.unit_label}`;
            const fmt = (v: number | null) =>
              v == null ? "—" : packSize ? formatPackPieces(v, packSize) : `${v}${unit}`;
            return (
              <Card
                key={line.product.product_id}
                title={line.product.name}
                note={priceNote(line.product)}
              >
                <StatRow label="Opening" value={fmt(line.opening)} />
                <StatRow label="Booked in" value={fmt(line.added)} />
                <StatRow label="Sold" value={fmt(line.sold)} />
                <StatRow label="Remaining" value={fmt(line.remaining)} />
                <StatRow
                  label="Sales value"
                  value={
                    isYoghurt(line.product)
                      ? cupCash > 0
                        ? cupCash.toFixed(2)
                        : "—"
                      : line.sales == null
                        ? "—"
                        : Number(line.sales).toFixed(2)
                  }
                  strong
                />
              </Card>
            );
          })}
        </>
      )}

      {cups.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Yoghurt cups</Text>
          {cups.map((cup) => (
            <Card key={cup.size} title={cup.size}>
              <StatRow label="Available" value={`${cup.opening} cups`} />
              <StatRow label="Left" value={cup.counted ? `${cup.left} cups` : "not counted"} />
              <StatRow label="Sold" value={`${cup.sold} cups`} />
              <StatRow label="Value" value={cup.cash.toFixed(2)} strong />
            </Card>
          ))}
          <Card tone="accent">
            <StatRow label="Yoghurt cup sales" value={cupCash.toFixed(2)} strong />
          </Card>
        </>
      ) : null}

      {flavours.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Yoghurt flavours remaining</Text>
          <Card>
            {flavours.map((f) => (
              <StatRow key={f.flavour} label={f.flavour} value={`${f.remaining} ml`} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
});
