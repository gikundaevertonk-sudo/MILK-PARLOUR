import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { ShopPicker } from "@/components/pickers";
import { Banner, Button, Card, Field } from "@/components/ui";
import { supabase, type Product, type Shop } from "@/lib/supabase";
import { colors, font, radius, spacing } from "@/lib/theme";
import { useShops } from "@/lib/useShops";

type ShopUser = {
  user_id: number;
  display_name: string;
  username: string;
  shop_id: number | null;
};

export default function Shops() {
  const { shops, shopId, setShopId } = useShops();
  const [products, setProducts] = useState<Product[]>([]);
  const [assigned, setAssigned] = useState<Set<number>>(new Set());
  const [users, setUsers] = useState<ShopUser[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ name: "", username: "", password: "", shop: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    const [productList, assignments, shopUsers] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("shop_products").select("product_id").eq("shop_id", shopId),
      supabase
        .from("users")
        .select("user_id, display_name, username, shop_id")
        .eq("role", "Shop")
        .order("display_name"),
    ]);
    setProducts((productList.data as Product[]) || []);
    setAssigned(
      new Set(
        ((assignments.data as { product_id: number }[]) || []).map((a) => a.product_id)
      )
    );
    setUsers((shopUsers.data as ShopUser[]) || []);
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleProduct(productId: number) {
    if (!shopId) return;
    const next = new Set(assigned);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    setAssigned(next);

    // Replace the whole assignment set for this shop, matching the web app.
    await supabase.from("shop_products").delete().eq("shop_id", shopId);
    if (next.size > 0) {
      const { error: insertError } = await supabase
        .from("shop_products")
        .insert([...next].map((id) => ({ shop_id: shopId, product_id: id })));
      if (insertError) {
        setError("Unable to save shop products.");
        load();
        return;
      }
    }
    setMessage("Shop products saved.");
  }

  function startEdit(shopUser: ShopUser) {
    setEditing(shopUser.user_id);
    setMessage(null);
    setError(null);
    setDraft({
      name: shopUser.display_name,
      username: shopUser.username,
      password: "",
      shop: String(shopUser.shop_id ?? ""),
    });
  }

  async function saveUser(userId: number) {
    if (!draft.name.trim() || !draft.username.trim()) {
      setError("Display name and login name are required.");
      return;
    }
    const updates: Record<string, unknown> = {
      display_name: draft.name.trim(),
      username: draft.username.trim(),
      shop_id: draft.shop ? Number(draft.shop) : null,
    };
    if (draft.password) updates.password = draft.password;

    const { error: saveError } = await supabase
      .from("users")
      .update(updates)
      .eq("user_id", userId);
    if (saveError) {
      setError("Unable to save the login details.");
      return;
    }
    setEditing(null);
    setMessage("Attendant saved.");
    load();
  }

  const currentShop = shops.find((s) => s.shop_id === shopId);

  return (
    <Screen
      intro="Choose which products a shop sells, and manage its attendant login."
      loading={loading}
      onRefresh={load}
    >
      <ShopPicker shops={shops} value={shopId} onChange={setShopId} />
      {error ? <Banner text={error} tone="danger" /> : null}
      {message ? <Banner text={message} tone="accent" /> : null}

      <Card
        title={`Products sold at ${currentShop?.name ?? "this shop"}`}
        note={`${assigned.size} of ${products.length} selected. Tap to toggle.`}
      >
        <View style={styles.chips}>
          {products.map((product) => {
            const on = assigned.has(product.product_id);
            return (
              <Pressable
                key={product.product_id}
                onPress={() => toggleProduct(product.product_id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {on ? "✓ " : ""}
                  {product.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Shop attendants</Text>
      {users.map((shopUser) =>
        editing === shopUser.user_id ? (
          <Card key={shopUser.user_id} title="Editing attendant" tone="accent">
            <Field
              label="Display name"
              value={draft.name}
              onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
            />
            <Field
              label="Login name"
              value={draft.username}
              onChangeText={(v) => setDraft((d) => ({ ...d, username: v }))}
              autoCapitalize="none"
            />
            <Field
              label="New password"
              value={draft.password}
              onChangeText={(v) => setDraft((d) => ({ ...d, password: v }))}
              placeholder="Leave blank to keep current"
              secureTextEntry
            />
            <ShopChoice
              shops={shops}
              value={draft.shop ? Number(draft.shop) : null}
              onChange={(id) => setDraft((d) => ({ ...d, shop: String(id) }))}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <Button label="Cancel" tone="secondary" onPress={() => setEditing(null)} />
              </View>
              <View style={styles.half}>
                <Button label="Save" onPress={() => saveUser(shopUser.user_id)} />
              </View>
            </View>
          </Card>
        ) : (
          <Card
            key={shopUser.user_id}
            title={shopUser.display_name}
            note={`Login: ${shopUser.username} · ${
              shops.find((s) => s.shop_id === shopUser.shop_id)?.name ?? "No shop"
            }`}
          >
            <Button label="Edit" tone="secondary" onPress={() => startEdit(shopUser)} />
          </Card>
        )
      )}
    </Screen>
  );
}

function ShopChoice({
  shops,
  value,
  onChange,
}: {
  shops: Shop[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>Assigned shop</Text>
      <View style={styles.chips}>
        {shops.map((shop) => {
          const on = shop.shop_id === value;
          return (
            <Pressable
              key={shop.shop_id}
              onPress={() => onChange(shop.shop_id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{shop.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.small, fontWeight: "600", color: colors.textMuted },
  chipTextOn: { color: colors.onPrimary },
  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  fieldLabel: { fontSize: font.small, fontWeight: "600", color: colors.textMuted },
  sectionLabel: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
});
