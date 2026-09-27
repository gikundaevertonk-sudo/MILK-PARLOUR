import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { DateField } from "@/components/pickers";
import { Banner, Button, Card, Empty, Field, StatRow } from "@/components/ui";
import { dayIso, firstOfMonth, prettyDate } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { colors, font, spacing } from "@/lib/theme";

const STORE_KEY = "milkParlorExpenses";

type Expense = { id: string; date: string; description: string; amount: number };

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [date, setDate] = useState(dayIso());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(dayIso());
  const [sales, setSales] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => setExpenses(raw ? JSON.parse(raw) : []))
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
  }, []);

  const loadSales = useCallback(async () => {
    if (!start || !end) return;
    const { data } = await supabase
      .from("daily_stock_entries")
      .select("sales_amount")
      .gte("entry_date", start)
      .lte("entry_date", end);
    setSales(
      ((data as { sales_amount: number | null }[]) || []).reduce(
        (total, row) => total + Number(row.sales_amount ?? 0),
        0
      )
    );
  }, [start, end]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  async function persist(next: Expense[]) {
    setExpenses(next);
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
  }

  async function add() {
    const value = Number(amount);
    if (!date || !description.trim() || !Number.isFinite(value) || value <= 0) {
      setError("Enter a date, description and a positive amount.");
      return;
    }
    setError(null);
    await persist([
      ...expenses,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date,
        description: description.trim(),
        amount: value,
      },
    ]);
    setDescription("");
    setAmount("");
  }

  const inRange = expenses
    .filter((e) => (!start || e.date >= start) && (!end || e.date <= end))
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalExpenses = inRange.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <Screen intro="Expenses are stored on this device. Sales come from the shared database." loading={loading}>
      <Card title="Record an expense">
        {error ? <Banner text={error} tone="danger" /> : null}
        <DateField label="Date" value={date} onChange={setDate} />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What was it for?"
        />
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <Button label="Add Expense" onPress={add} />
      </Card>

      <Card title="Performance period">
        <DateField label="From" value={start} onChange={setStart} />
        <DateField label="To" value={end} onChange={setEnd} />
        <StatRow label="Sales in period" value={sales.toFixed(2)} />
        <StatRow label="Expenses in period" value={totalExpenses.toFixed(2)} />
        <StatRow
          label="Net"
          value={(sales - totalExpenses).toFixed(2)}
          tone={sales - totalExpenses < 0 ? "danger" : "accent"}
          strong
        />
      </Card>

      <Text style={styles.sectionLabel}>Expenses in period</Text>
      {inRange.length === 0 ? (
        <Card>
          <Empty text="No expenses recorded in this period." />
        </Card>
      ) : (
        inRange.map((expense) => (
          <Card key={expense.id}>
            <View style={styles.expenseRow}>
              <View style={styles.expenseText}>
                <Text style={styles.expenseDesc}>{expense.description}</Text>
                <Text style={styles.expenseDate}>{prettyDate(expense.date)}</Text>
              </View>
              <Text style={styles.expenseAmount}>{Number(expense.amount).toFixed(2)}</Text>
              <Pressable
                onPress={() => persist(expenses.filter((e) => e.id !== expense.id))}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${expense.description}`}
                style={styles.delete}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
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
  expenseRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  expenseText: { flex: 1, gap: 2 },
  expenseDesc: { fontSize: font.body, fontWeight: "600", color: colors.text },
  expenseDate: { fontSize: font.tiny, color: colors.textFaint },
  expenseAmount: { fontSize: font.body, fontWeight: "700", color: colors.text },
  delete: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  deleteText: { color: colors.danger, fontSize: font.small, fontWeight: "700" },
});
