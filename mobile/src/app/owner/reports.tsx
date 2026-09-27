import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { DateField } from "@/components/pickers";
import { Banner, Button, Card, Empty, StatRow } from "@/components/ui";
import { dayIso, firstOfMonth, prettyDate } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { colors, font, spacing } from "@/lib/theme";

type ReportRow = {
  sales_amount: number | null;
  shops: { name: string } | null;
  products: { name: string } | null;
};

type Line = { shop: string; product: string; total: number };

export default function Reports() {
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(dayIso());
  const [lines, setLines] = useState<Line[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!start || !end) {
      setError("Pick both a start and end date.");
      return;
    }
    if (start > end) {
      setError("The start date must come before the end date.");
      return;
    }
    setBusy(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("daily_stock_entries")
      .select("sales_amount, shops(name), products(name)")
      .gte("entry_date", start)
      .lte("entry_date", end);

    setBusy(false);

    if (queryError) {
      setError("Unable to load the report.");
      return;
    }

    const totals = new Map<string, Line>();
    ((data as unknown as ReportRow[]) || []).forEach((row) => {
      const amount = Number(row.sales_amount ?? 0);
      if (!amount) return;
      const shop = row.shops?.name ?? "Unknown shop";
      const product = row.products?.name ?? "Unknown product";
      const key = `${shop}|${product}`;
      const existing = totals.get(key);
      if (existing) existing.total += amount;
      else totals.set(key, { shop, product, total: amount });
    });

    setLines(
      [...totals.values()].sort(
        (a, b) => a.shop.localeCompare(b.shop) || b.total - a.total
      )
    );
  }

  const grandTotal = (lines || []).reduce((sum, line) => sum + line.total, 0);
  const byShop = (lines || []).reduce<Record<string, Line[]>>((groups, line) => {
    (groups[line.shop] ||= []).push(line);
    return groups;
  }, {});

  return (
    <Screen intro="Sales totals per product, grouped by shop, for any date range.">
      <Card title="Date range">
        {error ? <Banner text={error} tone="danger" /> : null}
        <DateField label="From" value={start} onChange={setStart} />
        <DateField label="To" value={end} onChange={setEnd} />
        <Button label="Generate" onPress={generate} busy={busy} />
      </Card>

      {lines == null ? null : lines.length === 0 ? (
        <Card>
          <Empty text="No sales recorded in this range." />
        </Card>
      ) : (
        <>
          <Card title="Total" tone="accent">
            <Text style={styles.range}>
              {prettyDate(start)} → {prettyDate(end)}
            </Text>
            <StatRow label="Grand total" value={grandTotal.toFixed(2)} strong />
          </Card>

          {Object.entries(byShop).map(([shop, shopLines]) => {
            const shopTotal = shopLines.reduce((sum, l) => sum + l.total, 0);
            return (
              <View key={shop} style={styles.group}>
                <Text style={styles.sectionLabel}>{shop}</Text>
                <Card>
                  {shopLines.map((line) => (
                    <StatRow
                      key={line.product}
                      label={line.product}
                      value={line.total.toFixed(2)}
                    />
                  ))}
                  <View style={styles.divider} />
                  <StatRow label="Shop total" value={shopTotal.toFixed(2)} strong />
                </Card>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  range: { fontSize: font.small, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  sectionLabel: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
});
