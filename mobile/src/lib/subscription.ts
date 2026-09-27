import { dayIso } from "./dates";
import { supabase } from "./supabase";

export type SubscriptionState = {
  expiryDate: string | null;
  isActive: boolean;
  /** True when the system must be blocked. */
  blocked: boolean;
  reason: string | null;
  daysLeft: number | null;
};

export async function fetchSubscription(): Promise<SubscriptionState> {
  const { data, error } = await supabase
    .from("subscription")
    .select("expiry_date, is_active")
    .limit(1)
    .single();

  // A lookup failure must not lock anyone out of the app.
  if (error || !data) {
    return {
      expiryDate: null,
      isActive: true,
      blocked: false,
      reason: null,
      daysLeft: null,
    };
  }

  const today = dayIso();
  const expiryDate: string | null = data.expiry_date ?? null;
  const isActive = !!data.is_active;
  const expired = !!expiryDate && expiryDate < today;

  const daysLeft = expiryDate
    ? Math.ceil(
        (Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
          86400000
      )
    : null;

  return {
    expiryDate,
    isActive,
    blocked: expired || !isActive,
    reason: expired
      ? `Subscription expired on ${expiryDate}.`
      : !isActive
        ? "Subscription is inactive."
        : null,
    daysLeft,
  };
}
