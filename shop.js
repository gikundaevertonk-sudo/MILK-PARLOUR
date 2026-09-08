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
const TWIN_PIECES_PER_PACK = 2;
const SIMBA_PIECES_PER_PACK = 18;
const CUPS_PER_SEALED_PACK = 25;
const yoghurtFlavours = ["Strawberry", "Vanilla", "Blueberry", "Pineapple", "Chocolate"];
const flavourInputs = new Map();

// Yoghurt cup opening balance for the selected day, per size:
//   carriedYoghurtCups  = leftover carried from the last saved cup count
//   morningYoghurtCups   = cups the owner booked in for the selected day
let carriedYoghurtCups = new Map();
let morningYoghurtCups = new Map();

function cupCount(entry) {
    return (Number(entry?.sealed || 0) * CUPS_PER_SEALED_PACK) + Number(entry?.unsealed || 0);
}

function cupsBySize(rows) {
    const map = new Map();
    (rows || []).forEach(entry => {
        if (entry && entry.size) map.set(entry.size, cupCount(entry));
    });
    return map;
}

if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.display_name}`;
    const entryDateInput = document.getElementById("entryDate");
    if (entryDateInput) {
        entryDateInput.value = dayIso();
        entryDateInput.addEventListener("change", loadProducts);
    }
    loadProducts();
}

function dayIso(offsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    // Use the local calendar date, not the UTC one, so late-night entries stay on the right day.
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().split("T")[0];
}

function entryIso() {
    return document.getElementById("entryDate")?.value || dayIso();
}

// Carry-forward opening stock per product for a given day:
//   most recent saved remaining count  +  any stock-in booked on the days between
//   that count and the selected day.
// This keeps the leftover reflecting as the new opening stock the moment a closing
// balance is saved (no stock-in needed), and stops a missed closing from dropping
// stock-in that happened on the skipped days.
async function fetchCarriedBalances(shopId, beforeDateIso) {
    const carried = new Map();
    const { data, error } = await supabaseClient
        .from("daily_stock_entries")
        .select("product_id, quantity_in, secondary_quantity_out, entry_date")
        .eq("shop_id", shopId)
        .lt("entry_date", beforeDateIso)
        .order("entry_date", { ascending: false });
    if (error || !data) return carried;

    const rowsByProduct = new Map();
    data.forEach(row => {
        if (!rowsByProduct.has(row.product_id)) rowsByProduct.set(row.product_id, []);
        rowsByProduct.get(row.product_id).push(row);
    });

    rowsByProduct.forEach((rows, productId) => {
        // rows are newest-first; the anchor is the latest day that has a saved count.
        const anchorIndex = rows.findIndex(row => row.secondary_quantity_out != null);
        if (anchorIndex === -1) {
            // No closing count has ever been saved: fall back to the total stock-in.
            const stockInOnly = rows.reduce((sum, row) => sum + Number(row.quantity_in ?? 0), 0);
            if (stockInOnly !== 0) {
                carried.set(productId, { remaining: 0, gapStockIn: stockInOnly, date: rows[rows.length - 1].entry_date, noCount: true });
            }
            return;
        }
        const anchor = rows[anchorIndex];
        // Rows newer than the anchor are days with no closing count of their own;
        // any stock-in booked on them still belongs in the opening balance.
        const gapStockIn = rows.slice(0, anchorIndex).reduce((sum, row) => sum + Number(row.quantity_in ?? 0), 0);
        carried.set(productId, {
            remaining: Number(anchor.secondary_quantity_out),
            gapStockIn,
            date: anchor.entry_date
        });
    });
    return carried;
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

function packPieceCount(product) {
    const name = (product.name || "").toLowerCase();
    if (name.includes("twin")) return TWIN_PIECES_PER_PACK;
    if (name.includes("simba") && (name.includes("ice cream") || name.includes("stick"))) return SIMBA_PIECES_PER_PACK;
    return 0;
}

function piecePrice(product, packSize) {
    return product.name.toLowerCase().includes("simba")
        ? Number(product.unit_price ?? 0)
        : product.name.toLowerCase().includes("twin")
            ? 30
            : Number(product.unit_price ?? 0) / packSize;
}

function isPackPieceProduct(product) {
    return packPieceCount(product) > 0;
}

function eggPiecePrice(product) {
    return Number(product.unit_price ?? 0) / EGGS_PER_TRAY;
}

function trimNumber(value) {
    return Number(value.toFixed(2));
}

// Cups carried into the selected day per size, same rule as stock: the cups left
// at the most recent earlier closing count, plus every cup stock-in booked on the
// days since (so "what was there initially + everything added" is never dropped).
async function fetchCarriedYoghurtCups(shopId, beforeDateIso) {
    const carried = new Map();
    const { data, error } = await supabaseClient
        .from("closing_details")
        .select("entry_date, yoghurt_cups")
        .eq("shop_id", shopId)
        .lt("entry_date", beforeDateIso)
        .order("entry_date", { ascending: false });
    if (error || !data || data.length === 0) return carried;

    const closingOf = row => Array.isArray(row.yoghurt_cups) ? row.yoghurt_cups : (row.yoghurt_cups?.closing || []);
    const stockInOf = row => Array.isArray(row.yoghurt_cups) ? [] : (row.yoghurt_cups?.stockIn || []);
    const hasCount = rows => rows.some(cup => (cup.sealed ?? "") !== "" || (cup.unsealed ?? "") !== "");

    const anchorIndex = data.findIndex(row => hasCount(closingOf(row)));
    const gapRows = anchorIndex === -1 ? data : data.slice(0, anchorIndex);

    yoghurtCupPresets.forEach(preset => {
        const base = anchorIndex === -1 ? 0 : cupCount(closingOf(data[anchorIndex]).find(cup => cup.size === preset.size));
        const added = gapRows.reduce((sum, row) => {
            const cup = stockInOf(row).find(entry => entry.size === preset.size);
            return sum + (cup ? cupCount(cup) : 0);
        }, 0);
        if (base + added !== 0) carried.set(preset.size, base + added);
    });
    return carried;
}

async function loadClosingDetails() {
    const { data, error } = await supabaseClient
        .from("closing_details")
        .select("mpesa_amount, cash_notes, cash_coins, yoghurt_cups, yoghurt_flavours")
        .eq("shop_id", user.shop_id)
        .eq("entry_date", entryIso())
        .maybeSingle();
    if (error) return;

    carriedYoghurtCups = await fetchCarriedYoghurtCups(user.shop_id, entryIso());
    const details = data || {};
    const morningRows = Array.isArray(details.yoghurt_cups) ? [] : (details.yoghurt_cups?.stockIn || []);
    morningYoghurtCups = cupsBySize(morningRows);
    document.getElementById("closingMpesa").value = details.mpesa_amount ?? "";
    document.getElementById("closingNotes").value = details.cash_notes ?? "";
    document.getElementById("closingCoins").value = details.cash_coins ?? "";
    yoghurtFlavours.forEach(flavour => {
        const input = document.getElementById(`flavour_${flavour}`);
        if (input && details.yoghurt_flavours) {
            input.value = details.yoghurt_flavours.find(entry => entry.flavour === flavour)?.remaining ?? "";
        }
    });
    const closingCups = Array.isArray(details.yoghurt_cups) ? details.yoghurt_cups : details.yoghurt_cups?.closing || [];
    renderYoghurtCupSizes(closingCups);
    updateClosingMoneyTotal();
}

function renderYoghurtCupSizes(savedCups) {
    const container = document.getElementById("yoghurtClosingRows");
    const merged = yoghurtCupPresets.map(preset => {
        const saved = savedCups.find(cup => cup.size === preset.size) || {};
        const opening = (carriedYoghurtCups.get(preset.size) || 0) + (morningYoghurtCups.get(preset.size) || 0);
        return { ...preset, sealed: saved.sealed, unsealed: saved.unsealed, opening };
    });

    container.innerHTML = merged.map(cup => `<div class="yoghurt-cup-row" data-price="${cup.price}" data-opening="${cup.opening}">
        <span class="cup-size-label">${cup.size}</span>
        <span class="cup-opening-note">Available: ${cup.opening} cups</span>
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

// Cups sold per size = opening (carried + booked in) - what remained at closing.
function getYoghurtCupSales() {
    const closingRows = getYoghurtCupRows();
    return yoghurtCupPresets.map(preset => {
        const row = closingRows.find(entry => entry.size === preset.size);
        const counted = row && ((row.sealed ?? "") !== "" || (row.unsealed ?? "") !== "");
        const opening = (carriedYoghurtCups.get(preset.size) || 0) + (morningYoghurtCups.get(preset.size) || 0);
        const sold = counted ? Math.max(opening - cupCount(row), 0) : 0;
        return { size: preset.size, price: preset.price, opening, sold, cash: sold * preset.price };
    });
}

function getCupCashTotal() {
    return getYoghurtCupSales().reduce((total, entry) => total + entry.cash, 0);
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
    const cupCash = getCupCashTotal();
    const expected = productCash + cupCash;
    const difference = received - expected;
    const yoghurtSalesEl = document.getElementById("yoghurtSalesTotal");
    if (yoghurtSalesEl) yoghurtSalesEl.textContent = cupCash.toFixed(2);
    document.getElementById("closingCashTotal").textContent = cashTotal.toFixed(2);
    document.getElementById("closingMoneyTotal").textContent = received.toFixed(2);
    document.getElementById("closingExpectedTotal").textContent = expected.toFixed(2);
    const differenceEl = document.getElementById("closingDifference");
    differenceEl.textContent = difference.toFixed(2);
    differenceEl.className = difference < 0 ? "negative" : "";
}

async function saveClosingDetails() {
    const yoghurtCups = getYoghurtCupRows().filter(cup => cup.sealed !== "" || cup.unsealed !== "");
    const { data: existing } = await supabaseClient
        .from("closing_details")
        .select("yoghurt_cups")
        .eq("shop_id", user.shop_id)
        .eq("entry_date", entryIso())
        .maybeSingle();
    const existingCups = Array.isArray(existing?.yoghurt_cups) ? {} : (existing?.yoghurt_cups || {});
    const { error } = await supabaseClient.from("closing_details").upsert({
        shop_id: user.shop_id,
        entry_date: entryIso(),
        mpesa_amount: Number(document.getElementById("closingMpesa").value || 0),
        cash_notes: Number(document.getElementById("closingNotes").value || 0),
        cash_coins: Number(document.getElementById("closingCoins").value || 0),
        yoghurt_cups: { stockIn: existingCups.stockIn || [], closing: yoghurtCups },
        yoghurt_flavours: getFlavourRemaining().filter(entry => entry.remaining !== "")
    }, { onConflict: "shop_id,entry_date" });
    if (error) {
        document.getElementById("closingMessage").textContent = "Unable to save closing details.";
        return false;
    }
    updateClosingMoneyTotal();
    document.getElementById("closingMessage").textContent = "Closing details saved.";
    return true;
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

    const today = entryIso();
    const [todayResult, carriedByProduct] = await Promise.all([
        supabaseClient.from("daily_stock_entries").select("product_id, quantity_in").eq("shop_id", user.shop_id).eq("entry_date", today),
        fetchCarriedBalances(user.shop_id, today)
    ]);
    const todayEntries = todayResult.data || [];

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
        const egg = isEgg(p);
        const packPieces = packPieceCount(p);
        const carriedInfo = carriedByProduct.get(p.product_id);
        const priorRemaining = Number(carriedInfo?.remaining ?? 0);
        const gapStockIn = Number(carriedInfo?.gapStockIn ?? 0);
        // priorRemaining is stored in pieces/ml; stock-in for eggs is booked in trays.
        const carried = egg ? priorRemaining + (gapStockIn * EGGS_PER_TRAY) : priorRemaining + gapStockIn;
        const opening = egg ? carried + (added * EGGS_PER_TRAY) : carried + added;
        productOpenings.set(p.product_id, opening);
        const liquid = isLiquid(p);
        const inputHtml = egg
            ? `<label>Remaining (Trays): <input type="number" min="0" step="1" data-product="${p.product_id}" id="eggTrays_${p.product_id}"></label>
               <label>Loose pieces left: <input type="number" min="0" max="${EGGS_PER_TRAY - 1}" step="1" data-product="${p.product_id}" id="eggLoose_${p.product_id}"></label>`
            : packPieces
                ? `<label>Remaining packs: <input type="number" min="0" step="1" data-product="${p.product_id}" id="pack_${p.product_id}"></label>
                   <label>Remaining individual pieces: <input type="number" min="0" max="${packPieces - 1}" step="1" data-product="${p.product_id}" id="loose_${p.product_id}"></label>`
            : `<label>Remaining (${p.unit_label}): <input type="number" min="0" step="0.01" data-product="${p.product_id}" id="remaining_${p.product_id}"></label>`;
        const openingNote = egg
            ? `Opening stock: ${trimNumber(opening)} pieces${added ? ` (includes ${trimNumber(added)} trays added this morning)` : ""}`
            : packPieces
            ? `Opening stock: ${trimNumber(opening)} pieces${added ? ` (includes ${trimNumber(added)} pieces added this morning)` : ""}`
            : `Opening stock: ${trimNumber(opening)} ${p.unit_label}${added ? ` (includes ${trimNumber(added)} added this morning)` : ""}`;
        const carriedUnit = egg || packPieces ? "pieces" : p.unit_label;
        const carryNote = !carriedInfo
            ? "No earlier saved balance — opening stock is this morning's stock-in only."
            : carriedInfo.noCount
                ? `Carried forward: ${trimNumber(carried)} ${carriedUnit} from stock-in (no closing count saved yet)`
                : `Carried forward: ${trimNumber(carried)} ${carriedUnit} (last count ${carriedInfo.date}${gapStockIn ? ", plus stock added since" : ""})`;
        const priceNote = egg
            ? `1 tray = ${EGGS_PER_TRAY} pieces • Price per piece: ${eggPiecePrice(p).toFixed(2)}`
            : packPieces
                ? `1 pack = ${packPieces} pieces • Price per piece: ${piecePrice(p, packPieces).toFixed(2)} • Pack value: ${(piecePrice(p, packPieces) * packPieces).toFixed(2)}`
            : liquid
                ? (isYoghurt(p) ? "Yoghurt cash is counted from cup sales below." : `Price per 1000 ml: ${p.unit_price ?? "not set"}`)
                : `Price per ${p.unit_label}: ${p.unit_price ?? "not set"}`;
        return `<div class="product-row">
            <h3>${p.name}</h3>
            <p class="opening-note">${openingNote}</p>
            <p class="carry-note">${carryNote}</p>
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

    const packPieces = packPieceCount(product);
    if (packPieces) {
        const packsInput = document.getElementById(`pack_${product.product_id}`);
        const looseInput = document.getElementById(`loose_${product.product_id}`);
        const packsRaw = packsInput ? packsInput.value : "";
        const looseRaw = looseInput ? looseInput.value : "";
        if (packsRaw === "" && looseRaw === "") return null;
        const packs = Number(packsRaw || 0);
        const loose = Number(looseRaw || 0);
        const remaining = (packs * packPieces) + loose;
        const sold = opening - remaining;
        if (!Number.isFinite(packs) || !Number.isFinite(loose) || packs < 0 || loose < 0 || sold < 0) return { error: true, opening };
        const pricePerPiece = piecePrice(product, packPieces);
        return { sold, remaining, cash: sold * pricePerPiece, liquid: false, pieces: true };
    }

    const liquid = isLiquid(product);
    const input = document.getElementById(`remaining_${product.product_id}`);
    const raw = input ? input.value : "";
    if (raw === "") return null;

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return { error: true, opening };

    const remaining = value;
    const sold = opening - remaining;
    if (sold < 0) return { error: true, opening };

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
    const today = entryIso();
    const entries = [];
    const cupCash = getCupCashTotal();

    for (const p of shopProducts) {
        if (isYoghurt(p)) continue;
        const result = computeProductResult(p);
        if (result && result.error) {
            document.getElementById("saveMessage").textContent = `${p.name}: value cannot be more than the opening stock (${trimNumber(result.opening)}).`;
            return;
        }
        if (!result) continue;

        entries.push({
            shop_id: user.shop_id,
            product_id: p.product_id,
            entry_date: today,
            quantity_out: result.sold,
            secondary_quantity_out: result.remaining,
            sales_amount: result.cash,
            quantity_out_by_user_id: user.user_id
        });
    }

    const flavourEntries = getFlavourRemaining().filter(entry => entry.remaining !== "");
    const cupsSold = getYoghurtCupSales().reduce((total, entry) => total + entry.sold, 0);
    const yoghurt = shopProducts.find(isYoghurt);
    if (yoghurt && (flavourEntries.length > 0 || cupCash > 0)) {
        const flavourTotal = flavourEntries.reduce((total, entry) => total + Number(entry.remaining), 0);
        entries.push({
            shop_id: user.shop_id,
            product_id: yoghurt.product_id,
            entry_date: today,
            quantity_out: cupCash > 0 ? cupsSold : null,
            secondary_quantity_out: flavourEntries.length ? flavourTotal : null,
            sales_amount: cupCash > 0 ? cupCash : null,
            quantity_out_by_user_id: user.user_id
        });
    }

    const hasMoney = ["closingMpesa", "closingNotes", "closingCoins"].some(id => (document.getElementById(id).value || "") !== "");
    if (entries.length === 0 && !hasMoney) {
        document.getElementById("saveMessage").textContent = "Enter at least one value before saving.";
        return;
    }

    if (entries.length > 0) {
        const { error: saveError } = await supabaseClient
            .from("daily_stock_entries")
            .upsert(entries, { onConflict: "shop_id,product_id,entry_date" });

        if (saveError) {
            document.getElementById("saveMessage").textContent = "Unable to save entries. Please try again.";
            return;
        }
    }

    const closingSaved = await saveClosingDetails();
    document.getElementById("saveMessage").textContent = closingSaved
        ? "Closing balance saved and sent to the owner."
        : "Sales saved, but closing details could not be sent.";
}