import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { DateField } from "@/components/pickers";
import { Banner, Button, Card, StatRow } from "@/components/ui";
import { dayIso, prettyDate } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { fetchSubscription, type SubscriptionState } from "@/lib/subscription";
import { colors, font, radius, spacing } from "@/lib/theme";

export default function Subscription() {
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [expiry, setExpiry] = useState(dayIso());
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const state = await fetchSubscription();
    setSub(state);
    if (state.expiryDate) setExpiry(state.expiryDate);
    setActive(state.isActive);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function update() {
    setMessage(null);
    setError(null);

    if (!expiry) {
      setError("An expiry date is required.");
      return;
    }
    // A past date would lock every owner and shop login out immediately.
    if (expiry < dayIso()) {
      setError("The expiry date cannot be in the past.");
      return;
    }

    setBusy(true);
    const { data, error: lookupError } = await supabase
      .from("subscription")
      .select("subscription_id")
      .limit(1)
      .single();

    if (lookupError || !data) {
      setBusy(false);
      setError("Unable to read the subscription record.");
      return;
    }

    const { error: updateError } = await supabase
      .from("subscription")
      .update({ expiry_date: expiry, is_active: active })
      .eq("subscription_id", data.subscription_id);

    setBusy(false);
    if (updateError) {
      setError("Unable to update the subscription.");
      return;
    }
    setMessage("Subscription updated.");
    load();
  }

  return (
    <Screen
      intro="The expiry date cannot be set in the past. An expired or inactive subscription locks out every owner and shop login."
      onRefresh={load}
    >
      {error ? <Banner text={error} tone="danger" /> : null}
      {message ? <Banner text={message} tone="accent" /> : null}

      <Card title="Current status">
        <StatRow
          label="Expiry date"
          value={sub?.expiryDate ? prettyDate(sub.expiryDate) : "—"}
        />
        <StatRow
          label="Status"
          value={sub?.isActive ? "Active" : "Inactive"}
          tone={sub?.isActive ? "accent" : "danger"}
          strong
        />
        {sub?.daysLeft != null ? (
          <StatRow
            label={sub.daysLeft < 0 ? "Expired" : "Days left"}
            value={String(Math.abs(sub.daysLeft))}
            tone={sub.daysLeft <= 3 ? "danger" : "default"}
          />
        ) : null}
      </Card>

      <Card title="Update subscription">
        <DateField label="New expiry date" value={expiry} onChange={setExpiry} />

        <Text style={styles.label}>System active</Text>
        <View style={styles.toggleRow}>
          {[
            { value: true, label: "Active" },
            { value: false, label: "Inactive" },
          ].map((option) => {
            const on = active === option.value;
            return (
              <Pressable
                key={option.label}
                onPress={() => setActive(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[
                  styles.toggle,
                  on && (option.value ? styles.toggleOn : styles.toggleOff),
                ]}
              >
                <Text style={[styles.toggleText, on && styles.toggleTextOn]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button label="Update" onPress={update} busy={busy} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.small, fontWeight: "600", color: colors.textMuted },
  toggleRow: { flexDirection: "row", gap: spacing.sm },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleOff: { backgroundColor: colors.danger, borderColor: colors.danger },
  toggleText: { fontSize: font.body, fontWeight: "700", color: colors.textMuted },
  toggleTextOn: { color: colors.onPrimary },
});
