import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button, Card, Field, StatRow } from "@/components/ui";
import { useShopDraft } from "@/lib/shopDraft";

export default function ClosingMoney() {
  const draft = useShopDraft();
  const cash = Number(draft.money.notes || 0) + Number(draft.money.coins || 0);

  return (
    <Screen
      intro="Count the money you are handing over. The difference against expected sales is shown live."
      loading={draft.loading}
      footer={<Button label="Done" onPress={() => router.back()} />}
    >
      <Card title="Money counted">
        <Field
          label="M-Pesa amount"
          value={draft.money.mpesa}
          onChangeText={(v) => draft.setMoney({ mpesa: v })}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Field
          label="Cash notes"
          value={draft.money.notes}
          onChangeText={(v) => draft.setMoney({ notes: v })}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Field
          label="Cash coins"
          value={draft.money.coins}
          onChangeText={(v) => draft.setMoney({ coins: v })}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
      </Card>

      <Card
        title="Reconciliation"
        tone={draft.difference < 0 ? "danger" : "accent"}
      >
        <StatRow label="Cash total" value={cash.toFixed(2)} />
        <StatRow label="Money received" value={draft.received.toFixed(2)} strong />
        <StatRow label="Product sales" value={draft.productCash.toFixed(2)} />
        <StatRow label="Yoghurt cup sales" value={draft.cupCash.toFixed(2)} />
        <StatRow label="Expected sales" value={draft.expected.toFixed(2)} strong />
        <StatRow
          label={draft.difference < 0 ? "Short by" : "Over by"}
          value={Math.abs(draft.difference).toFixed(2)}
          tone={draft.difference < 0 ? "danger" : "accent"}
          strong
        />
      </Card>
    </Screen>
  );
}
