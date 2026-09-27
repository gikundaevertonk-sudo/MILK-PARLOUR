import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Screen } from "@/components/Screen";
import { Banner, Button, Card, Empty, StatRow } from "@/components/ui";
import { isYoghurt, openingUnit, trimNumber } from "@/lib/products";
import { pendingCount, useShopDraft } from "@/lib/shopDraft";
import { colors, font, spacing } from "@/lib/theme";

export default function Review() {
  const draft = useShopDraft();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const pending = pendingCount(draft);
  const counted = draft.products.filter((product) => {
    if (isYoghurt(product)) return false;
    return draft.results.get(product.product_id)?.kind === "ok";
  });

  async function submit() {
    setBusy(true);
    setResult(null);
    const outcome = await draft.save();
    setBusy(false);
    setResult(outcome);
  }

  return (
    <Screen
      intro="Check everything before sending. Once submitted the owner sees these figures."
      loading={draft.loading}
      footer={
        <>
          <Button
            label="Submit closing balance"
            onPress={submit}
            busy={busy}
            disabled={!!draft.firstError}
          />
          {result?.ok ? (
            <Button
              label="Back to menu"
              tone="secondary"
              onPress={() => router.replace("/shop")}
            />
          ) : null}
        </>
      }
    >
      {result ? (
        <Banner text={result.message} tone={result.ok ? "accent" : "danger"} />
      ) : null}

      {draft.firstError ? (
        <Banner
          tone="danger"
          text={`${draft.firstError.name}: ${draft.firstError.reason} Opening was ${trimNumber(
            draft.firstError.opening
          )}.`}
        />
      ) : pending > 0 ? (
        <Banner
          tone="warn"
          text={`${pending} product${pending === 1 ? "" : "s"} still have no count. They will be left untouched.`}
        />
      ) : null}

      <Card title="Totals" tone={draft.difference < 0 ? "danger" : "accent"}>
        <StatRow label="Product sales" value={draft.productCash.toFixed(2)} />
        <StatRow label="Yoghurt cup sales" value={draft.cupCash.toFixed(2)} />
        <StatRow label="Expected sales" value={draft.expected.toFixed(2)} strong />
        <StatRow label="Money received" value={draft.received.toFixed(2)} strong />
        <StatRow
          label={draft.difference < 0 ? "Short by" : "Over by"}
          value={Math.abs(draft.difference).toFixed(2)}
          tone={draft.difference < 0 ? "danger" : "accent"}
          strong
        />
      </Card>

      <Text style={styles.sectionLabel}>Counted products</Text>
      {counted.length === 0 ? (
        <Card>
          <Empty text="Nothing counted yet." />
        </Card>
      ) : (
        <Card>
          {counted.map((product) => {
            const entry = draft.results.get(product.product_id);
            if (entry?.kind !== "ok") return null;
            return (
              <StatRow
                key={product.product_id}
                label={`${product.name} — sold ${trimNumber(entry.sold)} ${openingUnit(product)}`}
                value={entry.cash.toFixed(2)}
              />
            );
          })}
        </Card>
      )}

      {draft.cupSales.some((s) => s.counted) ? (
        <>
          <Text style={styles.sectionLabel}>Yoghurt cups</Text>
          <Card>
            {draft.cupSales
              .filter((s) => s.counted)
              .map((sale) => (
                <StatRow
                  key={sale.size}
                  label={`${sale.size} — sold ${sale.sold} cups`}
                  value={sale.cash.toFixed(2)}
                />
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
