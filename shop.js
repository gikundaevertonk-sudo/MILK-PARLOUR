const user = requireRole("Shop");
if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.display_name}`;
    loadProducts();
}

async function loadProducts() {
    const { data } = await supabaseClient
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("category");

    const container = document.getElementById("productsContainer");
    container.innerHTML = data.map(p => {
        let fields = "";
        if (p.track_quantity_out) {
            fields += `<label>Qty Out (${p.unit_label}): <input type="number" step="0.01" id="qtyOut_${p.product_id}"></label>`;
        }
        if (p.track_secondary_quantity_out) {
            fields += `<label>Qty Out (${p.secondary_unit_label}): <input type="number" step="0.01" id="secQtyOut_${p.product_id}"></label>`;
        }
        if (p.track_sales_amount) {
            fields += `<label>Sales Amount: <input type="number" step="0.01" id="sales_${p.product_id}"></label>`;
        }
        return `<div class="product-row"><h3>${p.name}</h3>${fields}</div>`;
    }).join("");
}

async function saveEntries() {
    const today = new Date().toISOString().split("T")[0];

    const { data: products } = await supabaseClient
        .from("products")
        .select("*")
        .eq("is_active", true);

    for (const p of products) {
        const qtyOutEl = document.getElementById(`qtyOut_${p.product_id}`);
        const secQtyOutEl = document.getElementById(`secQtyOut_${p.product_id}`);
        const salesEl = document.getElementById(`sales_${p.product_id}`);

        const qtyOut = qtyOutEl ? qtyOutEl.value : "";
        const secQtyOut = secQtyOutEl ? secQtyOutEl.value : "";
        const sales = salesEl ? salesEl.value : "";

        if (qtyOut === "" && secQtyOut === "" && sales === "") continue;

        await supabaseClient
            .from("daily_stock_entries")
            .upsert({
                shop_id: user.shop_id,
                product_id: p.product_id,
                entry_date: today,
                quantity_out: qtyOut !== "" ? parseFloat(qtyOut) : null,
                secondary_quantity_out: secQtyOut !== "" ? parseFloat(secQtyOut) : null,
                sales_amount: sales !== "" ? parseFloat(sales) : null,
                quantity_out_by_user_id: user.user_id
            }, { onConflict: "shop_id,product_id,entry_date" });
    }

    document.getElementById("saveMessage").textContent = "Saved successfully.";
}