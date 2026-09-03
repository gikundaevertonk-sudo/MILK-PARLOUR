const user = requireRole("Owner");
let closingSalesTotal = 0;

if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.display_name}`;
    document.querySelectorAll(".dashboard-btn").forEach(button => {
        button.addEventListener("click", () => showSection(button.dataset.section));
    });
    loadTodayEntries();
    loadShopsIntoDropdown();
    loadProducts();
    loadShopAssignments();
    initializeExpenses();
}

function showSection(sectionId) {
    document.querySelectorAll(".dashboard-section").forEach(section => {
        section.hidden = section.id !== sectionId;
    });
    document.querySelectorAll(".dashboard-btn").forEach(button => {
        const isActive = button.dataset.section === sectionId;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-expanded", String(isActive));
    });
}

async function loadTodayEntries() {
    const today = new Date().toISOString().split("T")[0];
    const shopId = document.getElementById("todayShop").value;
    let query = supabaseClient
        .from("daily_stock_entries")
        .select("shop_id, product_id, entry_date, quantity_in, quantity_out, secondary_quantity_out, sales_amount, products(name)")
        .eq("entry_date", today);

    if (shopId) {
        query = query.eq("shop_id", shopId);
    }

    const { data, error } = await query.order("product_id");

    const tbody = document.getElementById("todayTableBody");
    tbody.innerHTML = "";

    if (error || !data || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5'>No entries yet for this shop.</td></tr>";
        return;
    }

    data.forEach(row => {
        tbody.innerHTML += `<tr class="editable-row" ondblclick="editDailyEntry(this, ${row.shop_id}, ${row.product_id}, '${row.entry_date}')" onfocusout="queueDailyEntrySave(this, ${row.shop_id}, ${row.product_id}, '${row.entry_date}')">
            <td>${row.products.name}</td>
            <td>${row.quantity_in ?? ""}</td>
            <td>${row.quantity_out ?? ""}</td>
            <td>${row.secondary_quantity_out ?? ""}</td>
            <td>${row.sales_amount ?? ""}</td>
        </tr>`;
    });
}

async function loadShopsIntoDropdown() {
    const { data, error } = await supabaseClient.from("shops").select("shop_id, name").order("name");
    if (error || !data) return;

    const options = data.map(shop => `<option value="${shop.shop_id}">${shop.name}</option>`).join("");
    const stockInSelect = document.getElementById("stockInShop");
    const todaySelect = document.getElementById("todayShop");
    const closingSelect = document.getElementById("closingShop");
    const productSelect = document.getElementById("productShop");
    stockInSelect.innerHTML = options;
    todaySelect.innerHTML = options;
    closingSelect.innerHTML = options;
    productSelect.innerHTML = options;
    document.getElementById("closingDate").value = new Date().toISOString().split("T")[0];
    loadStockInProducts();
    loadClosingBalances();
    stockInSelect.addEventListener("change", loadStockInProducts);
    todaySelect.addEventListener("change", loadTodayEntries);
    closingSelect.addEventListener("change", loadClosingBalances);
    productSelect.addEventListener("change", loadShopProductAssignments);
    loadShopProductAssignments();
}

function editDailyEntry(row, shopId, productId, entryDate) {
    if (row.classList.contains("is-editing")) return;

    row.classList.add("is-editing");
    const cells = row.querySelectorAll("td");
    const values = Array.from(cells).slice(1, 5).map(cell => cell.textContent.trim());
    cells[1].innerHTML = `<input type="number" step="0.01" value="${values[0]}">`;
    cells[2].innerHTML = `<input type="number" step="0.01" value="${values[1]}">`;
    cells[3].innerHTML = `<input type="number" step="0.01" value="${values[2]}">`;
    cells[4].innerHTML = `<input type="number" step="0.01" value="${values[3]}">`;
    cells[1].querySelector("input").focus();
}

function queueDailyEntrySave(row, shopId, productId, entryDate) {
    queueAutoSave(row, () => saveDailyEntry(row, shopId, productId, entryDate));
}

async function saveDailyEntry(row, shopId, productId, entryDate) {
    if (row.classList.contains("is-saving")) return;

    row.classList.add("is-saving");
    const inputs = row.querySelectorAll("input");
    const values = Array.from(inputs).map(input => input.value === "" ? null : parseFloat(input.value));
    const { error } = await supabaseClient
        .from("daily_stock_entries")
        .update({ quantity_in: values[0], quantity_out: values[1], secondary_quantity_out: values[2], sales_amount: values[3] })
        .eq("shop_id", shopId)
        .eq("product_id", productId)
        .eq("entry_date", entryDate);

    if (error) {
        row.classList.remove("is-saving");
        alert("Unable to save the stock entry.");
        return;
    }
    loadTodayEntries();
    loadClosingBalances();
}

async function loadClosingBalances() {
    const shopId = document.getElementById("closingShop").value;
    const entryDate = document.getElementById("closingDate").value;
    const tbody = document.getElementById("closingTableBody");
    const message = document.getElementById("closingMessage");
    if (!shopId || !entryDate) return;

    const previousDate = new Date(`${entryDate}T00:00:00`);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateIso = previousDate.toISOString().split("T")[0];

    const [assignmentResult, entryResult, previousResult] = await Promise.all([
        supabaseClient.from("shop_products").select("product_id, products(name, unit_label, unit_price, category)").eq("shop_id", shopId).order("product_id"),
        supabaseClient.from("daily_stock_entries").select("product_id, quantity_in, quantity_out, secondary_quantity_out, sales_amount").eq("shop_id", shopId).eq("entry_date", entryDate),
        supabaseClient.from("daily_stock_entries").select("product_id, secondary_quantity_out").eq("shop_id", shopId).eq("entry_date", previousDateIso)
    ]);

    tbody.innerHTML = "";
    if (assignmentResult.error || entryResult.error || previousResult.error || !assignmentResult.data) {
        message.textContent = "Unable to load closing balances.";
        return;
    }

    message.textContent = "";
    closingSalesTotal = 0;
    const entriesByProduct = new Map((entryResult.data || []).map(entry => [entry.product_id, entry]));
    const previousByProduct = new Map((previousResult.data || []).map(entry => [entry.product_id, entry]));

    if (assignmentResult.data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='7'>No products are assigned to this shop.</td></tr>";
    }

    assignmentResult.data.forEach(assignment => {
        const product = assignment.products;
        const entry = entriesByProduct.get(assignment.product_id);
        const added = Number(entry?.quantity_in ?? 0);
        const carried = Number(previousByProduct.get(assignment.product_id)?.secondary_quantity_out ?? 0);
        const opening = carried + added;
        const sold = entry?.quantity_out ?? "";
        const remaining = entry?.secondary_quantity_out ?? "";
        const salesValue = Number(entry?.sales_amount ?? 0);
        closingSalesTotal += salesValue;
        const liquid = (product.unit_label || "").toLowerCase() === "ml";
        const yoghurt = (product.category || "").toLowerCase() === "yoghurt";
        const priceLabel = yoghurt
            ? "per cup size"
            : product.unit_price == null
                ? "not set"
                : liquid
                    ? `${product.unit_price} / 1000 ml`
                    : `${product.unit_price} / ${product.unit_label}`;
        tbody.innerHTML += `<tr><td>${product.name}</td><td>${opening} ${product.unit_label}</td><td>${added}</td><td>${sold}</td><td>${remaining}</td><td>${priceLabel}</td><td>${entry?.sales_amount ?? ""}</td></tr>`;
    });
    loadClosingDetails();
}

function closingDetailsKey() {
    return `milkParlorClosing:${document.getElementById("closingShop").value}:${document.getElementById("closingDate").value}`;
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
    container.innerHTML = cupSizes.map((cup, index) => {
        const remaining = (Number(cup.sealed || 0) * 25) + Number(cup.unsealed || 0);
        const cash = Number(cup.price || 0) * Number(cup.sold || 0);
        return `<div class="yoghurt-cup-row">
        <input type="text" data-field="size" value="${cup.size || ""}" placeholder="Cup size (e.g. 250 ml)">
        <input type="number" data-field="price" value="${cup.price ?? ""}" min="0" step="0.01" placeholder="Price per cup">
        <input type="number" data-field="sealed" value="${cup.sealed ?? ""}" min="0" step="1" placeholder="Sealed packs left">
        <input type="number" data-field="unsealed" value="${cup.unsealed ?? ""}" min="0" max="24" step="1" placeholder="Loose cups left">
        <input type="number" data-field="sold" value="${cup.sold ?? ""}" min="0" step="1" placeholder="Cups sold">
        <output id="remainingCups_${index}">${remaining} cups left</output>
        <output id="cupCash_${index}">${cash.toFixed(2)}</output>
        <button type="button" onclick="removeYoghurtCupSize(${index})">Remove</button>
    </div>`;
    }).join("");
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
        unsealed: row.querySelector('[data-field="unsealed"]').value,
        sold: row.querySelector('[data-field="sold"]').value
    }));
}

function updateRemainingCups() {
    getYoghurtCupRows().forEach((cup, index) => {
        document.getElementById(`remainingCups_${index}`).textContent = `${(Number(cup.sealed || 0) * 25) + Number(cup.unsealed || 0)} cups left`;
        document.getElementById(`cupCash_${index}`).textContent = (Number(cup.price || 0) * Number(cup.sold || 0)).toFixed(2);
    });
    updateClosingMoneyTotal();
}

function updateClosingMoneyTotal() {
    const mpesa = Number(document.getElementById("closingMpesa").value || 0);
    const notes = Number(document.getElementById("closingNotes").value || 0);
    const coins = Number(document.getElementById("closingCoins").value || 0);
    const cashTotal = notes + coins;
    const received = mpesa + cashTotal;
    const difference = received - closingSalesTotal;
    document.getElementById("closingCashTotal").textContent = cashTotal.toFixed(2);
    document.getElementById("closingMoneyTotal").textContent = received.toFixed(2);
    document.getElementById("closingExpectedTotal").textContent = closingSalesTotal.toFixed(2);
    const differenceEl = document.getElementById("closingDifference");
    differenceEl.textContent = difference.toFixed(2);
    differenceEl.className = difference < 0 ? "negative" : "";
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

async function loadShopProductAssignments() {
    const shopId = document.getElementById("productShop").value;
    const container = document.getElementById("shopProductAssignments");
    const { data: products, error: productError } = await supabaseClient.from("products").select("product_id, name").eq("is_active", true).order("name");
    const { data: assignments, error: assignmentError } = await supabaseClient.from("shop_products").select("product_id").eq("shop_id", shopId);
    if (productError || assignmentError || !products || !assignments) {
        container.innerHTML = "<p>Shop products could not be loaded.</p>";
        return;
    }

    const assignedIds = new Set(assignments.map(assignment => assignment.product_id));
    container.innerHTML = products.map(product => `<label><input type="checkbox" value="${product.product_id}" ${assignedIds.has(product.product_id) ? "checked" : ""}> ${product.name}</label>`).join("");
    container.querySelectorAll("input").forEach(input => input.addEventListener("change", saveShopProductAssignments));
}

async function saveShopProductAssignments() {
    const shopId = document.getElementById("productShop").value;
    const productIds = Array.from(document.querySelectorAll("#shopProductAssignments input:checked")).map(input => Number(input.value));
    const { error: deleteError } = await supabaseClient.from("shop_products").delete().eq("shop_id", shopId);
    const { error: insertError } = productIds.length
        ? await supabaseClient.from("shop_products").insert(productIds.map(productId => ({ shop_id: shopId, product_id: productId })))
        : { error: null };
    document.getElementById("shopProductMessage").textContent = deleteError || insertError ? "Unable to save shop products." : "Shop products saved.";
}

function initializeExpenses() {
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("expenseDate").value = today;
    document.getElementById("expenseStart").value = today.slice(0, 8) + "01";
    document.getElementById("expenseEnd").value = today;
    loadExpenses();
}

function getExpenses() {
    return JSON.parse(localStorage.getItem("milkParlorExpenses") || "[]");
}

function saveExpenses(expenses) {
    localStorage.setItem("milkParlorExpenses", JSON.stringify(expenses));
}

function addExpense() {
    const date = document.getElementById("expenseDate").value;
    const description = document.getElementById("expenseDescription").value.trim();
    const amount = Number(document.getElementById("expenseAmount").value);
    const message = document.getElementById("expenseMessage");

    if (!date || !description || !Number.isFinite(amount) || amount <= 0) {
        message.textContent = "Enter an expense date, description, and amount.";
        return;
    }

    const expenses = getExpenses();
    expenses.push({ id: crypto.randomUUID(), date, description, amount });
    saveExpenses(expenses);
    document.getElementById("expenseDescription").value = "";
    document.getElementById("expenseAmount").value = "";
    message.textContent = "Expense recorded.";
    loadExpenses();
}

function deleteExpense(expenseId) {
    saveExpenses(getExpenses().filter(expense => expense.id !== expenseId));
    loadExpenses();
}

async function loadExpenses() {
    const start = document.getElementById("expenseStart").value;
    const end = document.getElementById("expenseEnd").value;
    const tbody = document.getElementById("expensesTableBody");
    const message = document.getElementById("expenseMessage");
    const expenses = getExpenses().filter(expense => (!start || expense.date >= start) && (!end || expense.date <= end));
    const totalExpenses = expenses.reduce((total, expense) => total + Number(expense.amount), 0);

    tbody.innerHTML = expenses.length
        ? expenses.sort((first, second) => second.date.localeCompare(first.date)).map(expense => `<tr><td>${expense.date}</td><td>${expense.description}</td><td>${Number(expense.amount).toFixed(2)}</td><td><button type="button" onclick="deleteExpense('${expense.id}')">Delete</button></td></tr>`).join("")
        : "<tr><td colspan='4'>No expenses in this period.</td></tr>";

    document.getElementById("expenseTotal").textContent = totalExpenses.toFixed(2);
    if (!start || !end) {
        document.getElementById("expenseSalesTotal").textContent = "0.00";
        document.getElementById("expenseNetTotal").textContent = (-totalExpenses).toFixed(2);
        return;
    }

    const { data, error } = await supabaseClient
        .from("daily_stock_entries")
        .select("sales_amount")
        .gte("entry_date", start)
        .lte("entry_date", end);
    const totalSales = error || !data ? 0 : data.reduce((total, entry) => total + Number(entry.sales_amount ?? 0), 0);
    document.getElementById("expenseSalesTotal").textContent = totalSales.toFixed(2);
    document.getElementById("expenseNetTotal").textContent = (totalSales - totalExpenses).toFixed(2);
    if (error) message.textContent = "Expenses are saved, but sales could not be loaded.";
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
        <tr id="productRow_${p.product_id}" class="editable-row" ondblclick="toggleProductEdit(${p.product_id}, true)" onfocusout="queueProductSave(this, ${p.product_id})">
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
        </tr>
    `).join("");
}

function toggleProductEdit(productId, editing) {
    const row = document.getElementById(`productRow_${productId}`);
    if (editing && row.classList.contains("is-editing")) return;

    row.classList.toggle("is-editing", editing);
    row.querySelectorAll(".viewMode").forEach(el => el.style.display = editing ? "none" : "");
    row.querySelectorAll(".editMode").forEach(el => el.style.display = editing ? "" : "none");
    if (editing) row.querySelector("input").focus();
}

function queueProductSave(row, productId) {
    queueAutoSave(row, () => saveProductEdit(row, productId));
}

async function saveProductEdit(row, productId) {
    if (row.classList.contains("is-saving")) return;

    const name = document.getElementById(`editName_${productId}`).value.trim();
    const category = document.getElementById(`editCategory_${productId}`).value.trim();
    const unit = document.getElementById(`editUnit_${productId}`).value.trim();
    const price = document.getElementById(`editPrice_${productId}`).value;
    const active = document.getElementById(`editActive_${productId}`).value === "true";

    if (!name || !category || !unit) return;

    row.classList.add("is-saving");
    const { error } = await supabaseClient.from("products").update({
        name,
        category,
        unit_label: unit,
        unit_price: price ? parseFloat(price) : null,
        is_active: active
    }).eq("product_id", productId);

    if (error) {
        row.classList.remove("is-saving");
        alert("Unable to save the product.");
        return;
    }

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
        <tr id="userRow_${u.user_id}" class="editable-row" ondblclick="toggleUserEdit(${u.user_id}, true)" onfocusout="queueUserSave(this, ${u.user_id})">
            <td><span class="viewMode">${u.display_name}</span><input class="editMode" style="display:none" type="text" id="editDisplayName_${u.user_id}" value="${u.display_name}"></td>
            <td><span class="viewMode">${u.username}</span><input class="editMode" style="display:none" type="text" id="editUsername_${u.user_id}" value="${u.username}"></td>
            <td>
                <span class="viewMode">Set when needed</span>
                <div class="password-field editMode" style="display:none">
                    <input type="password" id="editPassword_${u.user_id}" placeholder="New password" autocomplete="new-password">
                    <button class="password-toggle" type="button" onclick="toggleOwnerPassword(${u.user_id}, this)" aria-label="Show new password" aria-pressed="false" title="Show new password">&#128065;</button>
                </div>
            </td>
            <td>
                <span class="viewMode">${shops.find(s => s.shop_id === u.shop_id)?.name ?? "None"}</span>
                <select class="editMode" style="display:none" id="editShop_${u.user_id}">
                    ${shops.map(s => `<option value="${s.shop_id}" ${s.shop_id === u.shop_id ? "selected" : ""}>${s.name}</option>`).join("")}
                </select>
            </td>
        </tr>
    `).join("");
}

function toggleUserEdit(userId, editing) {
    const row = document.getElementById(`userRow_${userId}`);
    if (editing && row.classList.contains("is-editing")) return;

    row.classList.toggle("is-editing", editing);
    row.querySelectorAll(".viewMode").forEach(el => el.style.display = editing ? "none" : "");
    row.querySelectorAll(".editMode").forEach(el => el.style.display = editing ? "" : "none");
    if (editing) row.querySelector("input").focus();
}

function toggleOwnerPassword(userId, button) {
    const input = document.getElementById(`editPassword_${userId}`);
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    button.setAttribute("aria-label", isVisible ? "Show new password" : "Hide new password");
    button.setAttribute("title", isVisible ? "Show new password" : "Hide new password");
    button.setAttribute("aria-pressed", String(!isVisible));
}

function queueUserSave(row, userId) {
    queueAutoSave(row, () => saveUserEdit(row, userId));
}

function queueAutoSave(row, save) {
    clearTimeout(row.autoSaveTimer);
    row.autoSaveTimer = setTimeout(() => {
        if (row.isConnected && row.classList.contains("is-editing") && !row.contains(document.activeElement)) {
            save();
        }
    }, 150);
}

async function saveUserEdit(row, userId) {
    if (row.classList.contains("is-saving")) return;

    const displayName = document.getElementById(`editDisplayName_${userId}`).value.trim();
    const username = document.getElementById(`editUsername_${userId}`).value.trim();
    const shopId = document.getElementById(`editShop_${userId}`).value;
    const password = document.getElementById(`editPassword_${userId}`).value;

    if (!displayName || !username) {
        alert("Display name and login name are required.");
        return;
    }

    const updates = {
        display_name: displayName,
        username,
        shop_id: shopId
    };

    if (password) {
        updates.password = password;
    }

    row.classList.add("is-saving");
    const { error } = await supabaseClient.from("users").update(updates).eq("user_id", userId);
    if (error) {
        row.classList.remove("is-saving");
        alert("Unable to save login details. Please check the username and password.");
        return;
    }

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