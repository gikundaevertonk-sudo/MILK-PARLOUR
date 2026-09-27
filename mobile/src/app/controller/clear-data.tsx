import { useState } from "react";
import { Alert, Platform } from "react-native";
import { Screen } from "@/components/Screen";
import { DateField, ShopPicker } from "@/components/pickers";
import { Banner, Button, Card } from "@/components/ui";
import { dayIso } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { useShops } from "@/lib/useShops";

/** Alert.alert has no effect on web, so fall back to window.confirm there. */
function confirmDestructive(title: string, body: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${body}`)) onConfirm();
    return;
  }
  Alert.alert(title, body, [
    { text: "Cancel", style: "cancel" },
    { text: "Clear", style: "destructive", onPress: onConfirm },
  ]);
}

export default function ClearData() {
  const { shops, shopId, setShopId } = useShops();
  const [start, setStart] = useState(dayIso());
  const [end, setEnd] = useState(dayIso());
  const [busy, setBusy] = useState<"closing" | "stockin" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function validate(): boolean {
    setMessage(null);
    setError(null);
    if (!shopId || !start || !end) {
      setError("Choose a shop, a start date and an end date.");
      return false;
    }
    if (start > end) {
      setError("The start date cannot be after the end date.");
      return false;
    }
    return true;
  }

  async function clearClosing() {
    if (!validate() || !shopId) return;
    setBusy("closing");

    const [closingRows, entryRows] = await Promise.all([
      supabase
        .from("closing_details")
        .select("closing_detail_id")
        .eq("shop_id", shopId)
        .gte("entry_date", start)
        .lte("entry_date", end),
      supabase
        .from("daily_stock_entries")
        .select("entry_id")
        .eq("shop_id", shopId)
        .gte("entry_date", start)
        .lte("entry_date", end),
    ]);

    if (closingRows.error || entryRows.error) {
      setBusy(null);
      setError("Unable to find balances for that period.");
      return;
    }

    const [closingDelete, entryDelete] = await Promise.all([
      supabase
        .from("closing_details")
        .delete()
        .eq("shop_id", shopId)
        .gte("entry_date", start)
        .lte("entry_date", end),
      supabase
        .from("daily_stock_entries")
        .delete()
        .eq("shop_id", shopId)
        .gte("entry_date", start)
        .lte("entry_date", end),
    ]);

    setBusy(null);
    if (closingDelete.error || entryDelete.error) {
      setError("Some balances could not be cleared.");
      return;
    }
    const entries = entryRows.data?.length ?? 0;
    setMessage(
      `Cleared ${closingRows.data?.length ?? 0} closing record(s) and ${entries} stock entr${
        entries === 1 ? "y" : "ies"
      }.`
    );
  }

  async function clearStockIn() {
    if (!validate() || !shopId) return;
    setBusy("stockin");

    const { data, error: lookupError } = await supabase
      .from("daily_stock_entries")
      .select("entry_id")
      .eq("shop_id", shopId)
      .gte("entry_date", start)
      .lte("entry_date", end)
      .not("quantity_in", "is", null);

    if (lookupError) {
      setBusy(null);
      setError("Unable to find stock-in records for that period.");
      return;
    }

    const { error: updateError } = await supabase
      .from("daily_stock_entries")
      .update({ quantity_in: null, quantity_in_by_user_id: null })
      .eq("shop_id", shopId)
      .gte("entry_date", start)
      .lte("entry_date", end)
      .not("quantity_in", "is", null);

    setBusy(null);
    if (updateError) {
      setError("Stock-in records could not be cleared.");
      return;
    }
    setMessage(`Cleared ${data?.length ?? 0} stock-in record(s).`);
  }

  const shopName = shops.find((s) => s.shop_id === shopId)?.name ?? "this shop";

  return (
    <Screen intro="These actions permanently delete data for the chosen shop and date range. They cannot be undone.">
      {error ? <Banner text={error} tone="danger" /> : null}
      {message ? <Banner text={message} tone="accent" /> : null}

      <Card title="Scope">
        <ShopPicker shops={shops} value={shopId} onChange={setShopId} />
        <DateField label="From" value={start} onChange={setStart} />
        <DateField label="To" value={end} onChange={setEnd} />
      </Card>

      <Card
        title="Clear closing balances"
        note="Deletes the closing details AND every stock entry in the range."
        tone="danger"
      >
        <Button
          label="Clear Closing Balances"
          tone="danger"
          busy={busy === "closing"}
          onPress={() =>
            confirmDestructive(
              "Clear closing balances?",
              `This deletes all closing details and stock entries for ${shopName} from ${start} to ${end}. This cannot be undone.`,
              clearClosing
            )
          }
        />
      </Card>

      <Card
        title="Clear stock-in only"
        note="Blanks the stock-in figures but keeps sold, remaining and sales values."
        tone="warn"
      >
        <Button
          label="Clear Stock-In"
          tone="danger"
          busy={busy === "stockin"}
          onPress={() =>
            confirmDestructive(
              "Clear stock-in?",
              `This blanks the stock-in figures for ${shopName} from ${start} to ${end}. This cannot be undone.`,
              clearStockIn
            )
          }
        />
      </Card>
    </Screen>
  );
}
