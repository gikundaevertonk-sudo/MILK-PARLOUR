const user = requireRole("Controller");
if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.display_name}`;
    loadSubscription();
    loadShopsForClearing();
}

async function loadShopsForClearing() {
    const select = document.getElementById("clearShop");
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("clearStartDate").value = today;
    document.getElementById("clearEndDate").value = today;
    const { data, error } = await supabaseClient.from("shops").select("shop_id, name").order("name");
    if (error || !data) {
        select.innerHTML = "<option value=\"\">Unable to load shops</option>";
        return;
    }

    select.innerHTML = data.map(shop => `<option value="${shop.shop_id}">${shop.name}</option>`).join("");
}

async function clearClosingBalances() {
    const shopId = document.getElementById("clearShop").value;
    const startDate = document.getElementById("clearStartDate").value;
    const endDate = document.getElementById("clearEndDate").value;
    const message = document.getElementById("clearMessage");

    if (!shopId || !startDate || !endDate) {
        message.textContent = "Select a shop, start date, and end date.";
        return;
    }
    if (startDate > endDate) {
        message.textContent = "Start date cannot be after end date.";
        return;
    }
    if (!confirm(`Clear all closing balances for this shop from ${startDate} to ${endDate}?`)) return;

    const { data: closingRows, error: closingLookupError } = await supabaseClient
        .from("closing_details")
        .select("closing_detail_id")
        .eq("shop_id", shopId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);
    const { data: entryRows, error: entryLookupError } = await supabaseClient
        .from("daily_stock_entries")
        .select("entry_id")
        .eq("shop_id", shopId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);

    if (closingLookupError || entryLookupError) {
        message.textContent = "Unable to find balances for that period.";
        return;
    }

    const { error: closingDeleteError } = await supabaseClient
        .from("closing_details")
        .delete()
        .eq("shop_id", shopId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);
    const { error: entryDeleteError } = await supabaseClient
        .from("daily_stock_entries")
        .delete()
        .eq("shop_id", shopId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);

    if (closingDeleteError || entryDeleteError) {
        message.textContent = "Some balances could not be cleared.";
        return;
    }

    message.textContent = `Cleared ${closingRows.length} closing record(s) and ${entryRows.length} stock entr${entryRows.length === 1 ? "y" : "ies"}.`;
}

async function loadSubscription() {
    const { data, error } = await supabaseClient.from("subscription").select("*").limit(1).single();
    if (error || !data) {
        document.getElementById("subMessage").textContent = "Unable to load subscription details.";
        return;
    }

    document.getElementById("expiryDate").textContent = data.expiry_date;
    document.getElementById("activeStatus").textContent = data.is_active ? "Active" : "Inactive";
    document.getElementById("newExpiryDate").value = data.expiry_date;
    document.getElementById("isActiveCheckbox").checked = data.is_active;
}

async function updateSubscription() {
    const newDate = document.getElementById("newExpiryDate").value;
    const isActive = document.getElementById("isActiveCheckbox").checked;

    const { data, error: lookupError } = await supabaseClient.from("subscription").select("subscription_id").limit(1).single();
    if (lookupError || !data) {
        document.getElementById("subMessage").textContent = "Unable to update subscription details.";
        return;
    }

    const { error } = await supabaseClient
        .from("subscription")
        .update({ expiry_date: newDate, is_active: isActive })
        .eq("subscription_id", data.subscription_id);

    document.getElementById("subMessage").textContent = error ? "Unable to update subscription details." : "Updated successfully.";
    if (error) return;
    loadSubscription();
}