import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { DateField, ShopPicker } from "@/components/pickers";
import { Card, Empty, StatRow } from "@/components/ui";
import { dayIso } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { colors, font, spacing } from "@/lib/theme";
import { useShops } from "@/lib/useShops";

type Row = {
  product_id: number;
  quantity_in: number | null;
  quantity_out: number | null;
  secondary_quantity_out: number | null;
  sales_amount: number | null;
  products: { name: string } | null;
};

export default function TodayEntries() {
  const { shops, shopId, setShopId } = useShops();
  const [date, setDate] = useState(dayIso());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    const { data } = await supabase
      .from("daily_stock_entries")
      .select(
        "product_id, quantity_in, quantity_out, secondary_quantity_out, sales_amount, products(name)"
      )
      .eq("shop_id", shopId)
      .eq("entry_date", date)
      .order("product_id");
    setRows((data as unknown as Row[]) || []);
    setLoading(false);
  }, [shopId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const salesTotal = rows.reduce((sum, r) => sum + Number(r.sales_amount ?? 0), 0);

  return (
    <Screen
      intro="Exactly what is stored for this shop and day. Blank means nothing was entered."
      onRefresh={load}
      refreshing={loading}
    >
      <ShopPicker shops={shops} value={shopId} onChange={setShopId} />
      <DateField label="Date" value={date} onChange={setDate} />

      {rows.length === 0 ? (
        <Card>
          <Empty text="No entries recorded for this shop on this day." />
        </Card>
      ) : (
        <>
          <Card title="Recorded sales" tone="accent">
            <StatRow label="Total sales value" value={salesTotal.toFixed(2)} strong />
          </Card>

          {rows.map((row) => (
            <Card key={row.product_id} title={row.products?.name ?? `#${row.product_id}`}>
              <View style={styles.grid}>
                <Cell label="Stock in" value={row.quantity_in} />
                <Cell label="Sold" value={row.quantity_out} />
                <Cell label="Remaining" value={row.secondary_quantity_out} />
                <Cell label="Sales" value={row.sales_amount} money />
              </View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

function Cell({
  label,
  value,
  money,
}: {
  label: string;
  value: number | null;
  money?: boolean;
}) {
  const empty = value == null;
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, empty && styles.cellEmpty]}>
        {empty ? "—" : money ? Number(value).toFixed(2) : String(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cell: {
    minWidth: 78,
    flexGrow: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  cellLabel: { fontSize: font.tiny, color: colors.textMuted },
  cellValue: { fontSize: font.body, fontWeight: "700", color: colors.text },
  cellEmpty: { color: colors.textFaint, fontWeight: "400" },
});
