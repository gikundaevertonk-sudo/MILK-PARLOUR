const user = requireRole("Shop");
if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.display_name}`;
    loadProducts();
    loadClosingDetails();
}

function closingDetailsKey() {
    const today = new Date().toISOString().split("T")[0];
    return `milkParlorClosing:${user.shop_id}:${today}`;
}

function loadClosingDetails() {
    const details = JSON.parse(localStorage.getItem(closingDetailsKey()) || "{}");
    document.getElementById("closingMpesa").value = details.mpesa ?? "";
    document.getElementById("closingNotes").value = details.notes ?? "";
    document.getElementById("closingCoins").value = details.coins ?? "";
    renderYoghurtCupSizes(details.yoghurtCups || []);
    updateClosingMoneyTotal();
}

function renderYoghurtCupSizes(cupSizes) {
    const container = document.getElementById("yoghurtClosingRows");
    container.innerHTML = cupSizes.map((cup, index) => `<div class="yoghurt-cup-row">
        <input type="text" data-field="size" value="${cup.size || ""}" placeholder="Cup size">
        <input type="number" data-field="price" value="${cup.price ?? ""}" min="0" step="0.01" placeholder="Price per cup">
        <input type="number" data-field="sealed" value="${cup.sealed ?? ""}" min="0" step="1" placeholder="Sealed packs">
        <input type="number" data-field="unsealed" value="${cup.unsealed ?? ""}" min="0" max="24" step="1" placeholder="Loose cups">
        <output id="remainingCups_${index}">${(Number(cup.sealed || 0) * 25) + Number(cup.unsealed || 0)} cups</output>
        <button type="button" onclick="removeYoghurtCupSize(${index})">Remove</button>
    </div>`).join("");
    container.querySelectorAll("input").forEach(input => input.addEventListener("input", updateRemainingCups));
}

function addYoghurtCupSize() {
    const cups = getYoghurtCupRows();
    cups.push({ size: "", price: "", sealed: "", unsealed: "" });
    renderYoghurtCupSizes(cups);
}

function removeYoghurtCupSize(index) {
    const cups = getYoghurtCupRows();
    cups.splice(index, 1);
    renderYoghurtCupSizes(cups);
}

function getYoghurtCupRows() {
    return Array.from(document.querySelectorAll(".yoghurt-cup-row")).map(row => ({
        size: row.querySelector('[data-field="size"]').value.trim(),
        price: row.querySelector('[data-field="price"]').value,
        sealed: row.querySelector('[data-field="sealed"]').value,
        unsealed: row.querySelector('[data-field="unsealed"]').value
    }));
}

function updateRemainingCups() {
    getYoghurtCupRows().forEach((cup, index) => {
        document.getElementById(`remainingCups_${index}`).textContent = `${(Number(cup.sealed || 0) * 25) + Number(cup.unsealed || 0)} cups`;
    });
    updateClosingMoneyTotal();
}

function updateClosingMoneyTotal() {
    const mpesa = Number(document.getElementById("closingMpesa").value || 0);
    const notes = Number(document.getElementById("closingNotes").value || 0);
    const coins = Number(document.getElementById("closingCoins").value || 0);
    document.getElementById("closingCashTotal").textContent = (notes + coins).toFixed(2);
    document.getElementById("closingMoneyTotal").textContent = (mpesa + notes + coins).toFixed(2);
}

function saveClosingDetails() {
    const yoghurtCups = getYoghurtCupRows().filter(cup => cup.size);
    localStorage.setItem(closingDetailsKey(), JSON.stringify({
        mpesa: document.getElementById("closingMpesa").value,
        notes: document.getElementById("closingNotes").value,
        coins: document.getElementById("closingCoins").value,
        yoghurtCups
    }));
    updateClosingMoneyTotal();
    document.getElementById("closingMessage").textContent = "Closing details saved.";
}

async function loadProducts() {
    const { data: assignments, error } = await supabaseClient
        .from("shop_products")
        .select("products(*)")
        .eq("shop_id", user.shop_id);

    const container = document.getElementById("productsContainer");
    if (error || !assignments) {
        container.innerHTML = "<p>Products could not be loaded. Please try again.</p>";
        return;
    }

    const products = assignments.map(assignment => assignment.products).filter(product => product && product.is_active);
    if (products.length === 0) {
        container.innerHTML = "<p>No products have been assigned to this shop yet.</p>";
        return;
    }

    container.innerHTML = products.map(p => {
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

    const { data: assignments, error } = await supabaseClient
        .from("shop_products")
        .select("products(*)")
        .eq("shop_id", user.shop_id);

    if (error || !assignments) {
        document.getElementById("saveMessage").textContent = "Products could not be loaded. Please try again.";
        return;
    }

    const products = assignments.map(assignment => assignment.products).filter(product => product && product.is_active);

    const entries = [];
    for (const p of products) {
        const qtyOutEl = document.getElementById(`qtyOut_${p.product_id}`);
        const secQtyOutEl = document.getElementById(`secQtyOut_${p.product_id}`);
        const salesEl = document.getElementById(`sales_${p.product_id}`);

        const qtyOut = qtyOutEl ? qtyOutEl.value : "";
        const secQtyOut = secQtyOutEl ? secQtyOutEl.value : "";
        const sales = salesEl ? salesEl.value : "";

        if (qtyOut === "" && secQtyOut === "" && sales === "") continue;

        entries.push({
            shop_id: user.shop_id,
            product_id: p.product_id,
            entry_date: today,
            quantity_out: qtyOut !== "" ? parseFloat(qtyOut) : null,
            secondary_quantity_out: secQtyOut !== "" ? parseFloat(secQtyOut) : null,
            sales_amount: sales !== "" ? parseFloat(sales) : null,
            quantity_out_by_user_id: user.user_id
        });
    }

    if (entries.length === 0) {
        document.getElementById("saveMessage").textContent = "Enter at least one value before saving.";
        return;
    }

    const { error: saveError } = await supabaseClient
        .from("daily_stock_entries")
        .upsert(entries, { onConflict: "shop_id,product_id,entry_date" });

    document.getElementById("saveMessage").textContent = saveError ? "Unable to save entries. Please try again." : "Saved successfully.";
}