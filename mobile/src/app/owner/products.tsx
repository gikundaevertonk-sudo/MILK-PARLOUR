import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Banner, Button, Card, Field, StatRow } from "@/components/ui";
import { supabase, type Product } from "@/lib/supabase";
import { colors, font, spacing } from "@/lib/theme";

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ name: "", category: "", unit: "", price: "" });
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    unit: "",
    price: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name");
    setProducts((data as Product[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(product: Product) {
    setEditing(product.product_id);
    setMessage(null);
    setError(null);
    setDraft({
      name: product.name,
      category: product.category || "",
      unit: product.unit_label,
      price: product.unit_price == null ? "" : String(product.unit_price),
    });
  }

  async function saveEdit(productId: number) {
    if (!draft.name.trim() || !draft.category.trim() || !draft.unit.trim()) {
      setError("Name, category and unit are all required.");
      return;
    }
    const { error: saveError } = await supabase
      .from("products")
      .update({
        name: draft.name.trim(),
        category: draft.category.trim(),
        unit_label: draft.unit.trim(),
        unit_price: draft.price ? Number(draft.price) : null,
      })
      .eq("product_id", productId);
    if (saveError) {
      setError("Unable to save the product.");
      return;
    }
    setEditing(null);
    setMessage("Product saved.");
    load();
  }

  async function add() {
    if (!newProduct.name.trim() || !newProduct.category.trim()) {
      setError("Name and category are required.");
      return;
    }
    const { error: addError } = await supabase.from("products").insert({
      name: newProduct.name.trim(),
      category: newProduct.category.trim(),
      unit_label: newProduct.unit.trim() || "Units",
      unit_price: newProduct.price ? Number(newProduct.price) : null,
      track_quantity_in: true,
      track_quantity_out: true,
      track_sales_amount: true,
    });
    if (addError) {
      setError("Unable to add the product.");
      return;
    }
    setNewProduct({ name: "", category: "", unit: "", price: "" });
    setMessage("Product added.");
    load();
  }

  async function toggleActive(product: Product) {
    await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("product_id", product.product_id);
    load();
  }

  return (
    <Screen intro="Tap a product to edit its details." loading={loading} onRefresh={load}>
      {error ? <Banner text={error} tone="danger" /> : null}
      {message ? <Banner text={message} tone="accent" /> : null}

      <Card title="Add a product">
        <Field
          label="Name"
          value={newProduct.name}
          onChangeText={(v) => setNewProduct((p) => ({ ...p, name: v }))}
          placeholder="e.g. Fresh Milk"
        />
        <Field
          label="Category"
          value={newProduct.category}
          onChangeText={(v) => setNewProduct((p) => ({ ...p, category: v }))}
          placeholder="e.g. Milk"
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <Field
              label="Unit"
              value={newProduct.unit}
              onChangeText={(v) => setNewProduct((p) => ({ ...p, unit: v }))}
              placeholder="Units"
            />
          </View>
          <View style={styles.half}>
            <Field
              label="Price"
              value={newProduct.price}
              onChangeText={(v) => setNewProduct((p) => ({ ...p, price: v }))}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Button label="Add Product" onPress={add} />
      </Card>

      <Text style={styles.sectionLabel}>All products</Text>
      {products.map((product) =>
        editing === product.product_id ? (
          <Card key={product.product_id} title={`Editing ${product.name}`} tone="accent">
            <Field
              label="Name"
              value={draft.name}
              onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
            />
            <Field
              label="Category"
              value={draft.category}
              onChangeText={(v) => setDraft((d) => ({ ...d, category: v }))}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <Field
                  label="Unit"
                  value={draft.unit}
                  onChangeText={(v) => setDraft((d) => ({ ...d, unit: v }))}
                />
              </View>
              <View style={styles.half}>
                <Field
                  label="Price"
                  value={draft.price}
                  onChangeText={(v) => setDraft((d) => ({ ...d, price: v }))}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Button
                  label="Cancel"
                  tone="secondary"
                  onPress={() => setEditing(null)}
                />
              </View>
              <View style={styles.half}>
                <Button label="Save" onPress={() => saveEdit(product.product_id)} />
              </View>
            </View>
          </Card>
        ) : (
          <Card key={product.product_id} title={product.name} note={product.category || ""}>
            <StatRow label="Unit" value={product.unit_label} />
            <StatRow
              label="Price"
              value={product.unit_price == null ? "not set" : String(product.unit_price)}
            />
            <StatRow
              label="Active"
              value={product.is_active ? "Yes" : "No"}
              tone={product.is_active ? "accent" : "danger"}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <Button
                  label={product.is_active ? "Deactivate" : "Activate"}
                  tone="secondary"
                  onPress={() => toggleActive(product)}
                />
              </View>
              <View style={styles.half}>
                <Button label="Edit" onPress={() => startEdit(product)} />
              </View>
            </View>
          </Card>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  sectionLabel: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
});
