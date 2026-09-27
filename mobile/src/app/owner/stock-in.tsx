import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { DateField, ShopPicker } from "@/components/pickers";
import { Banner, Button, Card, Field } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { dayIso } from "@/lib/dates";
import { isYoghurt, packPieceCount } from "@/lib/products";
import { supabase, type Product } from "@/lib/supabase";
import { colors, font, spacing } from "@/lib/theme";
import { useShops } from "@/lib/useShops";
import { cupsBySize, yoghurtCupPresets, type CupRow } from "@/lib/yoghurt";

type Draft = { pack: string; loose: string; single: string };

const emptyDraft: Draft = { pack: "", loose: "", single: "" };

export default function StockIn() {
  const { user } = useAuth();
  const { shops, shopId, setShopId } = useShops();
  const [date, setDate] = useState(dayIso());
  const [products, setProducts] = useState<Product[]>([]);
  const [current, setCurrent] = useState<Map<number, number>>(new Map());
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [cupDrafts, setCupDrafts] = useState<Record<string, CupRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setMessage(null);
    setError(null);

    const [assigned, entries, closing] = await Promise.all([
      supabase
        .from("shop_products")
        .select("product_id, products(*)")
        .eq("shop_id", shopId),
      supabase
        .from("daily_stock_entries")
        .select("product_id, quantity_in")
        .eq("shop_id", shopId)
        .eq("entry_date", date),
      supabase
        .from("closing_details")
        .select("yoghurt_cups")
        .eq("shop_id", shopId)
        .eq("entry_date", date)
        .maybeSingle(),
    ]);

    const list = ((assigned.data as unknown as { products: Product }[]) || [])
      .map((row) => row.products)
      .filter((p) => p && p.is_active !== false && p.track_quantity_in !== false)
      .sort((a, b) => (a.category || "").localeCompare(b.category || "") ||
        a.name.localeCompare(b.name));

    setProducts(list);
    setCurrent(
      new Map(
        ((entries.data as { product_id: number; quantity_in: number | null }[]) || []).map(
          (e) => [e.product_id, Number(e.quantity_in ?? 0)]
        )
      )
    );
    setDrafts({});

    const payload = closing.data?.yoghurt_cups;
    const existing: CupRow[] = Array.isArray(payload) ? [] : payload?.stockIn || [];
    const byKey: Record<string, CupRow> = {};
    yoghurtCupPresets.forEach((preset) => {
      const found = existing.find((c) => c.size === preset.size);
      byKey[preset.size] = {
        size: preset.size,
        price: preset.price,
        sealed: found?.sealed ?? "",
        unsealed: found?.unsealed ?? "",
      };
    });
    setCupDrafts(byKey);
    setLoading(false);
  }, [shopId, date]);

  useEffect(() => {
    load();
  }, [load]);

  function setDraft(productId: number, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? emptyDraft), ...patch },
    }));
  }

  async function save() {
    if (!shopId || !user) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    const updates: { product: Product; quantityIn: number; exists: boolean }[] = [];

    for (const product of products) {
      const draft = drafts[product.product_id] ?? emptyDraft;
      const packSize = packPieceCount(product);

      let adjustment: number;
      if (packSize) {
        if (draft.pack === "" && draft.loose === "") continue;
        adjustment = Number(draft.pack || 0) * packSize + Number(draft.loose || 0);
      } else {
        if (draft.single === "") continue;
        adjustment = Number(draft.single);
      }

      if (!Number.isFinite(adjustment)) {
        setError(`${product.name}: enter a valid adjustment.`);
        setBusy(false);
        return;
      }

      // Adjustments are additive against whatever is already booked for the day.
      const existing = current.get(product.product_id) ?? 0;
      const quantityIn = existing + adjustment;
      if (quantityIn < 0) {
        setError(`${product.name}: adjustment cannot take stock below zero.`);
        setBusy(false);
        return;
      }
      updates.push({
        product,
        quantityIn,
        exists: current.has(product.product_id),
      });
    }

    const cupRows = Object.values(cupDrafts).filter(
      (cup) => cup.sealed !== "" || cup.unsealed !== ""
    );

    if (updates.length === 0 && cupRows.length === 0) {
      setError("Enter at least one adjustment before saving.");
      setBusy(false);
      return;
    }

    for (const { product, quantityIn, exists } of updates) {
      const result = exists
        ? await supabase
            .from("daily_stock_entries")
            .update({ quantity_in: quantityIn, quantity_in_by_user_id: user.user_id })
            .eq("shop_id", shopId)
            .eq("product_id", product.product_id)
            .eq("entry_date", date)
        : await supabase.from("daily_stock_entries").insert({
            shop_id: shopId,
            product_id: product.product_id,
            entry_date: date,
            quantity_in: quantityIn,
            quantity_in_by_user_id: user.user_id,
          });

      if (result.error) {
        setError(`${product.name}: unable to save adjustment.`);
        setBusy(false);
        return;
      }
    }

    if (cupRows.length > 0) {
      const { data: existing } = await supabase
        .from("closing_details")
        .select("yoghurt_cups, yoghurt_flavours")
        .eq("shop_id", shopId)
        .eq("entry_date", date)
        .maybeSingle();
      const payload = existing?.yoghurt_cups;
      const keptClosing = Array.isArray(payload) ? payload : payload?.closing || [];
      const { error: cupError } = await supabase.from("closing_details").upsert(
        {
          shop_id: shopId,
          entry_date: date,
          yoghurt_cups: { stockIn: cupRows, closing: keptClosing },
          yoghurt_flavours: existing?.yoghurt_flavours || [],
        },
        { onConflict: "shop_id,entry_date" }
      );
      if (cupError) {
        setError("Stock saved, but yoghurt cups could not be booked in.");
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    setMessage("Stock-in saved.");
    load();
  }

  const hasYoghurt = products.some(isYoghurt);
  const grouped = groupByCategory(products.filter((p) => !isYoghurt(p)));

  return (
    <Screen
      intro="Adjustments are added to whatever is already booked for the day. Use a negative number to take stock back."
      loading={loading}
      footer={<Button label="Save Stock-In" onPress={save} busy={busy} />}
    >
      <ShopPicker shops={shops} value={shopId} onChange={setShopId} />
      <DateField label="Date" value={date} onChange={setDate} />

      {error ? <Banner text={error} tone="danger" /> : null}
      {message ? <Banner text={message} tone="accent" /> : null}

      {Object.entries(grouped).map(([category, items]) => (
        <View key={category} style={styles.group}>
          <Text style={styles.groupTitle}>{category}</Text>
          {items.map((product) => {
            const packSize = packPieceCount(product);
            const draft = drafts[product.product_id] ?? emptyDraft;
            const booked = current.get(product.product_id) ?? 0;
            return (
              <Card
                key={product.product_id}
                title={product.name}
                note={`Already booked today: ${booked} ${
                  packSize ? "pieces" : product.unit_label
                }`}
              >
                {packSize ? (
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <Field
                        label={`Packs (${packSize} pcs)`}
                        value={draft.pack}
                        onChangeText={(v) => setDraft(product.product_id, { pack: v })}
                        keyboardType="numbers-and-punctuation"
                        placeholder="0"
                      />
                    </View>
                    <View style={styles.half}>
                      <Field
                        label="Loose pieces"
                        value={draft.loose}
                        onChangeText={(v) => setDraft(product.product_id, { loose: v })}
                        keyboardType="numbers-and-punctuation"
                        placeholder="0"
                      />
                    </View>
                  </View>
                ) : (
                  <Field
                    label={`Adjustment (${product.unit_label})`}
                    value={draft.single}
                    onChangeText={(v) => setDraft(product.product_id, { single: v })}
                    keyboardType="numbers-and-punctuation"
                    placeholder="0"
                  />
                )}
              </Card>
            );
          })}
        </View>
      ))}

      {hasYoghurt ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Yoghurt cups added</Text>
          {yoghurtCupPresets.map((preset) => {
            const draft = cupDrafts[preset.size] ?? {
              size: preset.size,
              sealed: "",
              unsealed: "",
            };
            const total = cupsBySize([draft]).get(preset.size) ?? 0;
            return (
              <Card
                key={preset.size}
                title={`${preset.size} — ${preset.price} per cup`}
                note={`1 sealed pack = 25 cups · this entry = ${total} cups`}
              >
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Field
                      label="Sealed packs"
                      value={draft.sealed}
                      onChangeText={(v) =>
                        setCupDrafts((prev) => ({
                          ...prev,
                          [preset.size]: { ...draft, sealed: v },
                        }))
                      }
                      keyboardType="number-pad"
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.half}>
                    <Field
                      label="Loose cups"
                      value={draft.unsealed}
                      onChangeText={(v) =>
                        setCupDrafts((prev) => ({
                          ...prev,
                          [preset.size]: { ...draft, unsealed: v },
                        }))
                      }
                      keyboardType="number-pad"
                      placeholder="0"
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

function groupByCategory(products: Product[]): Record<string, Product[]> {
  return products.reduce<Record<string, Product[]>>((groups, product) => {
    const key = product.category || "Products";
    (groups[key] ||= []).push(product);
    return groups;
  }, {});
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  groupTitle: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
});
