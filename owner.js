const user = requireRole("Owner");
if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.display_name}`;
    loadTodayEntries();
    loadShopsIntoDropdown();
    loadProducts();
    loadShopAssignments();
}

function showSection(sectionId) {
    document.querySelectorAll("section").forEach(s => s.style.display = "none");
    document.getElementById(sectionId).style.display = "block";
}

async function loadTodayEntries() {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabaseClient
        .from("daily_stock_entries")
        .select("quantity_in, quantity_out, secondary_quantity_out, sales_amount, shops(name), products(name)")
        .eq("entry_date", today);

    const tbody = document.getElementById("todayTableBody");
    tbody.innerHTML = "";

    if (error || !data || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6'>No entries yet today.</td></tr>";
        return;
    }

    data.forEach(row => {
        tbody.innerHTML += `<tr>
            <td>${row.shops.name}</td>
            <td>${row.products.name}</td>
            <td>${row.quantity_in ?? ""}</td>
            <td>${row.quantity_out ?? ""}</td>
            <td>${row.secondary_quantity_out ?? ""}</td>
            <td>${row.sales_amount ?? ""}</td>
        </tr>`;
    });
}

async function loadShopsIntoDropdown() {
    const { data } = await supabaseClient.from("shops").select("shop_id, name").order("name");
    const select = document.getElementById("stockInShop");
    select.innerHTML = data.map(s => `<option value="${s.shop_id}">${s.name}</option>`).join("");
    loadStockInProducts();
    select.addEventListener("change", loadStockInProducts);
}

async function loadStockInProducts() {
    const { data } = await supabaseClient
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("track_quantity_in", true)
        .order("name");

    const container = document.getElementById("stockInProducts");
    container.innerHTML = data.map(p => `
        <div>
            <label>${p.name} (${p.unit_label}):
                <input type="number" step="0.01" id="qtyIn_${p.product_id}">
            </label>
        </div>
    `).join("");
}

async function saveStockIn() {
    const shopId = document.getElementById("stockInShop").value;
    const today = new Date().toISOString().split("T")[0];

    const { data: products } = await supabaseClient
        .from("products")
        .select("product_id")
        .eq("is_active", true)
        .eq("track_quantity_in", true);

    for (const p of products) {
        const input = document.getElementById(`qtyIn_${p.product_id}`);
        const value = input.value;
        if (value === "") continue;

        await supabaseClient
            .from("daily_stock_entries")
            .upsert({
                shop_id: shopId,
                product_id: p.product_id,
                entry_date: today,
                quantity_in: parseFloat(value),
                quantity_in_by_user_id: user.user_id
            }, { onConflict: "shop_id,product_id,entry_date" });
    }

    document.getElementById("stockInMessage").textContent = "Saved successfully.";
    loadTodayEntries();
}

async function loadProducts() {
    const { data } = await supabaseClient.from("products").select("*").order("category");
    const tbody = document.getElementById("productsTableBody");

    tbody.innerHTML = data.map(p => `
        <tr id="productRow_${p.product_id}">
            <td><span class="viewMode">${p.name}</span><input class="editMode" style="display:none" type="text" id="editName_${p.product_id}" value="${p.name}"></td>
            <td><span class="viewMode">${p.category}</span><input class="editMode" style="display:none" type="text" id="editCategory_${p.product_id}" value="${p.category}"></td>
            <td><span class="viewMode">${p.unit_label}</span><input class="editMode" style="display:none" type="text" id="editUnit_${p.product_id}" value="${p.unit_label}"></td>
            <td><span class="viewMode">${p.unit_price ?? ""}</span><input class="editMode" style="display:none" type="number" step="0.01" id="editPrice_${p.product_id}" value="${p.unit_price ?? ""}"></td>
            <td>
                <span class="viewMode">${p.is_active ? "Yes" : "No"}</span>
                <select class="editMode" style="display:none" id="editActive_${p.product_id}">
                    <option value="true" ${p.is_active ? "selected" : ""}>Yes</option>
                    <option value="false" ${!p.is_active ? "selected" : ""}>No</option>
                </select>
            </td>
            <td>
                <button class="viewMode" onclick="toggleProductEdit(${p.product_id}, true)">Edit</button>
                <button class="editMode" style="display:none" onclick="saveProductEdit(${p.product_id})">Save</button>
                <button class="editMode" style="display:none" onclick="toggleProductEdit(${p.product_id}, false)">Cancel</button>
            </td>
        </tr>
    `).join("");
}

function toggleProductEdit(productId, editing) {
    const row = document.getElementById(`productRow_${productId}`);
    row.querySelectorAll(".viewMode").forEach(el => el.style.display = editing ? "none" : "");
    row.querySelectorAll(".editMode").forEach(el => el.style.display = editing ? "" : "none");
}

async function saveProductEdit(productId) {
    const name = document.getElementById(`editName_${productId}`).value.trim();
    const category = document.getElementById(`editCategory_${productId}`).value.trim();
    const unit = document.getElementById(`editUnit_${productId}`).value.trim();
    const price = document.getElementById(`editPrice_${productId}`).value;
    const active = document.getElementById(`editActive_${productId}`).value === "true";

    await supabaseClient.from("products").update({
        name,
        category,
        unit_label: unit,
        unit_price: price ? parseFloat(price) : null,
        is_active: active
    }).eq("product_id", productId);

    loadProducts();
}

async function addProduct() {
    const name = document.getElementById("newProductName").value.trim();
    const category = document.getElementById("newProductCategory").value.trim();
    const unit = document.getElementById("newProductUnit").value.trim() || "Units";
    const price = document.getElementById("newProductPrice").value;

    if (!name || !category) {
        document.getElementById("productMessage").textContent = "Name and category required.";
        return;
    }

    const { error } = await supabaseClient.from("products").insert({
        name,
        category,
        unit_label: unit,
        unit_price: price ? parseFloat(price) : null,
        track_quantity_in: document.getElementById("newProductTrackIn").checked,
        track_quantity_out: document.getElementById("newProductTrackOut").checked,
        track_sales_amount: document.getElementById("newProductTrackSales").checked
    });

    document.getElementById("productMessage").textContent = error ? "Error adding product." : "Product added.";
    loadProducts();
}

async function loadShopAssignments() {
    const { data: shopUsers } = await supabaseClient
        .from("users")
        .select("user_id, display_name, username, shop_id")
        .eq("role", "Shop")
        .order("display_name");

    const { data: shops } = await supabaseClient.from("shops").select("shop_id, name").order("name");

    const tbody = document.getElementById("shopUsersTableBody");
    tbody.innerHTML = shopUsers.map(u => `
        <tr id="userRow_${u.user_id}">
            <td><span class="viewMode">${u.display_name}</span><input class="editMode" style="display:none" type="text" id="editDisplayName_${u.user_id}" value="${u.display_name}"></td>
            <td><span class="viewMode">${u.username}</span><input class="editMode" style="display:none" type="text" id="editUsername_${u.user_id}" value="${u.username}"></td>
            <td>
                <span class="viewMode">${shops.find(s => s.shop_id === u.shop_id)?.name ?? "None"}</span>
                <select class="editMode" style="display:none" id="editShop_${u.user_id}">
                    ${shops.map(s => `<option value="${s.shop_id}" ${s.shop_id === u.shop_id ? "selected" : ""}>${s.name}</option>`).join("")}
                </select>
            </td>
            <td>
                <button class="viewMode" onclick="toggleUserEdit(${u.user_id}, true)">Edit</button>
                <button class="editMode" style="display:none" onclick="saveUserEdit(${u.user_id})">Save</button>
                <button class="editMode" style="display:none" onclick="toggleUserEdit(${u.user_id}, false)">Cancel</button>
            </td>
        </tr>
    `).join("");
}

function toggleUserEdit(userId, editing) {
    const row = document.getElementById(`userRow_${userId}`);
    row.querySelectorAll(".viewMode").forEach(el => el.style.display = editing ? "none" : "");
    row.querySelectorAll(".editMode").forEach(el => el.style.display = editing ? "" : "none");
}

async function saveUserEdit(userId) {
    const displayName = document.getElementById(`editDisplayName_${userId}`).value.trim();
    const username = document.getElementById(`editUsername_${userId}`).value.trim();
    const shopId = document.getElementById(`editShop_${userId}`).value;

    await supabaseClient.from("users").update({
        display_name: displayName,
        username: username,
        shop_id: shopId
    }).eq("user_id", userId);

    loadShopAssignments();
}

async function generateReport() {
    const start = document.getElementById("reportStart").value;
    const end = document.getElementById("reportEnd").value;

    if (!start || !end) {
        alert("Please pick both a start and end date.");
        return;
    }

    const { data, error } = await supabaseClient
        .from("daily_stock_entries")
        .select("sales_amount, shops(name), products(name)")
        .gte("entry_date", start)
        .lte("entry_date", end);

    const tbody = document.getElementById("reportTableBody");
    tbody.innerHTML = "";

    if (error || !data || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3'>No sales in this range.</td></tr>";
        document.getElementById("reportGrandTotal").textContent = "0.00";
        return;
    }

    const totals = {};
    let grandTotal = 0;

    data.forEach(row => {
        if (!row.sales_amount) return;
        const key = `${row.shops.name} - ${row.products.name}`;
        totals[key] = (totals[key] || 0) + parseFloat(row.sales_amount);
        grandTotal += parseFloat(row.sales_amount);
    });

    Object.keys(totals).sort().forEach(key => {
        const [shopName, productName] = key.split(" - ");
        tbody.innerHTML += `<tr><td>${shopName}</td><td>${productName}</td><td>${totals[key].toFixed(2)}</td></tr>`;
    });

    document.getElementById("reportGrandTotal").textContent = grandTotal.toFixed(2);
    document.getElementById("reportRangeText").textContent = `From ${start} to ${end}`;
    document.getElementById("reportPrintHeader").style.display = "block";
}