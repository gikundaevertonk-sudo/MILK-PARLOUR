const user = requireRole("Shop");
const productOpenings = new Map();
let shopProducts = [];

const yoghurtCupPresets = [
    { size: "200 ml", price: 50 },
    { size: "250 ml", price: 60 },
    { size: "300 ml", price: 70 },
    { size: "500 ml", price: 100 },
    { size: "1000 ml", price: 190 }
];

const EGGS_PER_TRAY = 30;
const yoghurtFlavours = ["Strawberry", "Vanilla", "Blueberry"];
const flavourInputs = new Map();

if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.display_name}`;
    loadProducts();
}

function showNotification(message) {
    const list = document.getElementById("notificationList");
    if (!list) return;
    const item = document.createElement("li");
    item.textContent = message;
    list.prepend(item);
}

function dayIso(offsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().split("T")[0];
}

function isLiquid(product) {
    return (product.unit_label || "").toLowerCase() === "ml";
}

function isYoghurt(product) {
    return (product.category || "").toLowerCase() === "yoghurt";
}

function isEgg(product) {
    return (product.category || "").toLowerCase() === "eggs" || (product.name || "").toLowerCase() === "eggs";
}

function eggPiecePrice(product) {
    return Number(product.unit_price ?? 0) / EGGS_PER_TRAY;
}

function trimNumber(value) {
    return Number(value.toFixed(2));
}

function closingDetailsKey() {
    return `milkParlorClosing:${user.shop_id}:${dayIso()}`;
}

function loadClosingDetails() {
    const details = JSON.parse(localStorage.getItem(closingDetailsKey()) || "{}");
    document.getElementById("closingMpesa").value = details.mpesa ?? "";
    document.getElementById("closingNotes").value = details.notes ?? "";
    document.getElementById("closingCoins").value = details.coins ?? "";
    yoghurtFlavours.forEach(flavour => {
        const input = document.getElementById(`flavour_${flavour}`);
        if (input && details.yoghurtFlavours) {
            input.value = details.yoghurtFlavours.find(entry => entry.flavour === flavour)?.remaining ?? "";
        }
    });
    renderYoghurtCupSizes(details.yoghurtCups || []);
    updateClosingMoneyTotal();
}

function renderYoghurtCupSizes(savedCups) {
    const container = document.getElementById("yoghurtClosingRows");
    const merged = yoghurtCupPresets.map(preset => {
        const saved = savedCups.find(cup => cup.size === preset.size) || {};
        return { ...preset, sealed: saved.sealed, unsealed: saved.unsealed };
    });

    container.innerHTML = merged.map(cup => `<div class="yoghurt-cup-row" data-price="${cup.price}">
        <span class="cup-size-label">${cup.size}</span>
        <label>Sealed packs: <input type="number" data-field="sealed" value="${cup.sealed ?? ""}" min="0" step="1" placeholder="0"></label>
        <label>Loose cups: <input type="number" data-field="unsealed" value="${cup.unsealed ?? ""}" min="0" max="24" step="1" placeholder="0"></label>
    </div>`).join("");
    container.querySelectorAll("input").forEach(input => input.addEventListener("input", updateClosingMoneyTotal));
}

function getYoghurtCupRows() {
    return Array.from(document.querySelectorAll(".yoghurt-cup-row")).map(row => ({
        size: row.querySelector(".cup-size-label").textContent.trim(),
        price: row.dataset.price,
        sealed: row.querySelector('[data-field="sealed"]').value,
        unsealed: row.querySelector('[data-field="unsealed"]').value
    }));
}

function getCupCashTotal() {
    return 0;
}

function updateClosingMoneyTotal() {
    const mpesa = Number(document.getElementById("closingMpesa").value || 0);
    const notes = Number(document.getElementById("closingNotes").value || 0);
    const coins = Number(document.getElementById("closingCoins").value || 0);
    const cashTotal = notes + coins;
    const received = mpesa + cashTotal;
    const productCash = shopProducts.reduce((total, product) => {
        const result = computeProductResult(product);
        return total + (result && !result.error ? result.cash : 0);
    }, 0);
    const expected = productCash + getCupCashTotal();
    const difference = received - expected;
    document.getElementById("closingCashTotal").textContent = cashTotal.toFixed(2);
    document.getElementById("closingMoneyTotal").textContent = received.toFixed(2);
    document.getElementById("closingExpectedTotal").textContent = expected.toFixed(2);
    const differenceEl = document.getElementById("closingDifference");
    differenceEl.textContent = difference.toFixed(2);
    differenceEl.className = difference < 0 ? "negative" : "";
}

function saveClosingDetails() {
    const yoghurtCups = getYoghurtCupRows().filter(cup => cup.sealed !== "" || cup.unsealed !== "");
    localStorage.setItem(closingDetailsKey(), JSON.stringify({
        mpesa: document.getElementById("closingMpesa").value,
        notes: document.getElementById("closingNotes").value,
        coins: document.getElementById("closingCoins").value,
        yoghurtCups,
        yoghurtFlavours: getFlavourRemaining().filter(entry => entry.remaining !== "")
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

    shopProducts = assignments.map(assignment => assignment.products).filter(product => product && product.is_active);
    if (shopProducts.length === 0) {
        container.innerHTML = "<p>No products have been assigned to this shop yet.</p>";
        loadClosingDetails();
        return;
    }

    const today = dayIso();
    const yesterday = dayIso(-1);
    const [todayResult, previousResult] = await Promise.all([
        supabaseClient.from("daily_stock_entries").select("product_id, quantity_in").eq("shop_id", user.shop_id).eq("entry_date", today),
        supabaseClient.from("daily_stock_entries").select("product_id, secondary_quantity_out").eq("shop_id", user.shop_id).eq("entry_date", yesterday)
    ]);
    const todayEntries = todayResult.data || [];
    const previousEntries = previousResult.data || [];

    const byCategory = new Map();
    shopProducts.forEach(product => {
        const category = product.category || "Products";
        if (!byCategory.has(category)) byCategory.set(category, []);
        byCategory.get(category).push(product);
    });

    container.innerHTML = Array.from(byCategory).map(([category, items]) => {
        const heading = `<h2 class="category-heading">${category}</h2>`;
        const cards = items.filter(p => !isYoghurt(p)).map(p => {
        const added = Number(todayEntries.find(entry => entry.product_id === p.product_id)?.quantity_in ?? 0);
        const carried = Number(previousEntries.find(entry => entry.product_id === p.product_id)?.secondary_quantity_out ?? 0);
        const egg = isEgg(p);
        const opening = egg ? carried + (added * EGGS_PER_TRAY) : carried + added;
        productOpenings.set(p.product_id, opening);
        const liquid = isLiquid(p);
        const inputHtml = egg
            ? `<label>Remaining (Trays): <input type="number" min="0" step="1" data-product="${p.product_id}" id="eggTrays_${p.product_id}"></label>
               <label>Loose pieces left: <input type="number" min="0" max="${EGGS_PER_TRAY - 1}" step="1" data-product="${p.product_id}" id="eggLoose_${p.product_id}"></label>`
            : liquid
                ? `<label>Remaining (${p.unit_label}): <input type="number" min="0" step="0.01" data-product="${p.product_id}" id="remaining_${p.product_id}"></label>`
                : `<label>Sold (${p.unit_label}): <input type="number" min="0" step="0.01" data-product="${p.product_id}" id="sold_${p.product_id}"></label>`;
        const openingNote = egg
            ? `Opening stock: ${trimNumber(opening)} pieces${added ? ` (includes ${trimNumber(added)} trays added this morning)` : ""}`
            : `Opening stock: ${trimNumber(opening)} ${p.unit_label}${added ? ` (includes ${trimNumber(added)} added this morning)` : ""}`;
        const priceNote = egg
            ? `1 tray = ${EGGS_PER_TRAY} pieces • Price per piece: ${eggPiecePrice(p).toFixed(2)}`
            : liquid
                ? (isYoghurt(p) ? "Yoghurt cash is counted from cup sales below." : `Price per 1000 ml: ${p.unit_price ?? "not set"}`)
                : `Price per ${p.unit_label}: ${p.unit_price ?? "not set"}`;
        return `<div class="product-row">
            <h3>${p.name}</h3>
            <p class="opening-note">${openingNote}</p>
            <p class="price-note">${priceNote}</p>
            ${inputHtml}
            <p class="calc-note" id="calc_${p.product_id}"></p>
        </div>`;
        }).join("");
        return heading + cards + (items.some(isYoghurt) ? renderYoghurtFlavourRows(category) : "");
    }).join("");
    flavourInputs.clear();
    container.querySelectorAll("input[data-flavour]").forEach(input => {
        flavourInputs.set(input.dataset.flavour, input);
        input.addEventListener("input", updateClosingMoneyTotal);
    });

    container.querySelectorAll("input[data-product]").forEach(input => {
        input.addEventListener("input", () => {
            updateProductCalc(Number(input.dataset.product));
            updateClosingMoneyTotal();
        });
    });
    loadClosingDetails();
}

function computeProductResult(product) {
    const opening = productOpenings.get(product.product_id) ?? 0;

    if (isEgg(product)) {
        const traysInput = document.getElementById(`eggTrays_${product.product_id}`);
        const looseInput = document.getElementById(`eggLoose_${product.product_id}`);
        const traysRaw = traysInput ? traysInput.value : "";
        const looseRaw = looseInput ? looseInput.value : "";
        if (traysRaw === "" && looseRaw === "") return null;
        const trays = Number(traysRaw || 0);
        const loose = Number(looseRaw || 0);
        if (!Number.isFinite(trays) || !Number.isFinite(loose) || trays < 0 || loose < 0) return { error: true, opening };
        const remaining = (trays * EGGS_PER_TRAY) + loose;
        const sold = opening - remaining;
        if (sold < 0) return { error: true, opening };
        return { sold, remaining, cash: sold * eggPiecePrice(product), liquid: false, pieces: true };
    }

    const liquid = isLiquid(product);
    const input = document.getElementById(liquid ? `remaining_${product.product_id}` : `sold_${product.product_id}`);
    const raw = input ? input.value : "";
    if (raw === "") return null;

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return { error: true, opening };

    let sold;
    let remaining;
    if (liquid) {
        remaining = value;
        sold = opening - remaining;
        if (sold < 0) return { error: true, opening };
    } else {
        sold = value;
        remaining = opening - sold;
        if (remaining < 0) return { error: true, opening };
    }

    const price = Number(product.unit_price ?? 0);
    const cash = isYoghurt(product) ? 0 : liquid ? (sold / 1000) * price : sold * price;
    return { sold, remaining, cash, liquid };
}

function updateProductCalc(productId) {
    const product = shopProducts.find(p => p.product_id === productId);
    const note = document.getElementById(`calc_${productId}`);
    if (!product || !note) return;

    const result = computeProductResult(product);
    if (!result) {
        note.textContent = "";
        return;
    }
    if (result.error) {
        note.textContent = `Value cannot be more than the opening stock (${trimNumber(result.opening)}).`;
        return;
    }

    const parts = result.pieces
        ? [`Sold: ${trimNumber(result.sold)} pieces`, `Remaining: ${trimNumber(result.remaining)} pieces`]
        : [`Sold: ${trimNumber(result.sold)} ${product.unit_label}`, `Remaining: ${trimNumber(result.remaining)} ${product.unit_label}`];
    if (!isYoghurt(product)) parts.push(`Value: ${result.cash.toFixed(2)}`);
    note.textContent = parts.join(" \u2022 ");
}

function renderYoghurtFlavourRows(category) {
    return `<div class="product-row flavour-row">
        <h3>${category} Flavours</h3>
        <p class="price-note">Cash is counted from cup sales below. Enter what remained in ml per flavour.</p>
        ${yoghurtFlavours.map(flavour => `<label>${flavour} remaining (ml): <input type="number" min="0" step="0.01" data-flavour="${flavour}" id="flavour_${flavour}"></label>`).join("")}
    </div>`;
}

function getFlavourRemaining() {
    return yoghurtFlavours.map(flavour => ({
        flavour,
        remaining: document.getElementById(`flavour_${flavour}`)?.value ?? ""
    }));
}

async function saveEntries() {
    const today = dayIso();
    const entries = [];
    const cupCash = getCupCashTotal();
    let yoghurtCashAssigned = false;

    for (const p of shopProducts) {
        if (isYoghurt(p)) continue;
        const result = computeProductResult(p);
        if (result && result.error) {
            document.getElementById("saveMessage").textContent = `${p.name}: value cannot be more than the opening stock (${trimNumber(result.opening)}).`;
            return;
        }
        if (!result) continue;

        let salesAmount = result.cash;
        if (isYoghurt(p)) {
            salesAmount = yoghurtCashAssigned ? null : cupCash;
            yoghurtCashAssigned = true;
        }

        entries.push({
            shop_id: user.shop_id,
            product_id: p.product_id,
            entry_date: today,
            quantity_out: result.sold,
            secondary_quantity_out: result.remaining,
            sales_amount: salesAmount,
            quantity_out_by_user_id: user.user_id
        });
    }

    const flavourEntries = getFlavourRemaining().filter(entry => entry.remaining !== "");
    const yoghurt = shopProducts.find(isYoghurt);
    if (yoghurt && (flavourEntries.length > 0 || cupCash > 0)) {
        const flavourTotal = flavourEntries.reduce((total, entry) => total + Number(entry.remaining), 0);
        entries.push({
            shop_id: user.shop_id,
            product_id: yoghurt.product_id,
            entry_date: today,
            quantity_out: null,
            secondary_quantity_out: flavourEntries.length ? flavourTotal : null,
            sales_amount: cupCash > 0 ? cupCash : null,
            quantity_out_by_user_id: user.user_id
        });
    }

    if (!yoghurtCashAssigned && cupCash > 0) {
        const yoghurt = shopProducts.find(isYoghurt);
        if (yoghurt) {
            entries.push({
                shop_id: user.shop_id,
                product_id: yoghurt.product_id,
                entry_date: today,
                quantity_out: null,
                secondary_quantity_out: null,
                sales_amount: cupCash,
                quantity_out_by_user_id: user.user_id
            });
        }
    }

    if (entries.length === 0) {
        document.getElementById("saveMessage").textContent = "Enter at least one value before saving.";
        return;
    }

    const { error: saveError } = await supabaseClient
        .from("daily_stock_entries")
        .upsert(entries, { onConflict: "shop_id,product_id,entry_date" });

    if (saveError) {
        document.getElementById("saveMessage").textContent = "Unable to save entries. Please try again.";
        return;
    }
    saveClosingDetails();
    showNotification(`Closing balance sent for ${today}.`);
    document.getElementById("saveMessage").textContent = "Saved successfully. Closing details saved too.";
}