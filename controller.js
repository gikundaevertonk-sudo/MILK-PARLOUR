const user = requireRole("Controller");
if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.display_name}`;
    checkSubscriptionValidity();
    loadSubscription();
    loadShopsForClearing();
}

function dayIso(offsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    // Use the local calendar date, not the UTC one.
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().split("T")[0];
}

async function checkSubscriptionValidity() {
    const { data: subscription, error } = await supabaseClient
        .from("subscription")
        .select("expiry_date, is_active")
        .limit(1)
        .single();

    if (error || !subscription) return;

    const today = dayIso();
    const isExpired = subscription.expiry_date < today;
    const isInactive = !subscription.is_active;

    if (isExpired || isInactive) {
        const dashboardSections = document.querySelectorAll(".dashboard-section");
        dashboardSections.forEach(section => section.style.display = "none");

        const blockerMsg = document.createElement("div");
        blockerMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #fff;
            padding: 40px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 500px;
        `;
        blockerMsg.innerHTML = `
            <h2 style="color: #d32f2f; margin: 0 0 20px 0;">System Blocked</h2>
            <p style="margin: 0 0 10px 0; font-size: 16px;">
                ${isExpired ? `Subscription expired on ${subscription.expiry_date}.` : "Subscription is inactive."}
            </p>
            <p style="margin: 0; font-size: 14px; color: #666;">
                Contact the system administrator to renew or reactivate.
            </p>
        `;
        document.body.appendChild(blockerMsg);
    }
}

async function loadShopsForClearing() {
    const select = document.getElementById("clearShop");
    const today = dayIso();
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

async function clearStockIn() {
    const shopId = document.getElementById("clearShop").value;
    const startDate = document.getElementById("clearStartDate").value;
    const endDate = document.getElementById("clearEndDate").value;
    const message = document.getElementById("clearStockInMessage");

    if (!shopId || !startDate || !endDate) {
        message.textContent = "Select a shop, start date, and end date.";
        return;
    }
    if (startDate > endDate) {
        message.textContent = "Start date cannot be after end date.";
        return;
    }
    if (!confirm(`Clear stock-in records for this shop from ${startDate} to ${endDate}?`)) return;

    const { data: rows, error: lookupError } = await supabaseClient
        .from("daily_stock_entries")
        .select("entry_id")
        .eq("shop_id", shopId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate)
        .not("quantity_in", "is", null);
    if (lookupError) {
        message.textContent = "Unable to find stock-in records for that period.";
        return;
    }

    const { error } = await supabaseClient
        .from("daily_stock_entries")
        .update({ quantity_in: null, quantity_in_by_user_id: null })
        .eq("shop_id", shopId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate)
        .not("quantity_in", "is", null);
    message.textContent = error ? "Stock-in records could not be cleared." : `Cleared ${rows.length} stock-in record(s).`;
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

    if (!newDate) {
        document.getElementById("subMessage").textContent = "Expiry date is required.";
        return;
    }

    const today = new Date().toISOString().split("T")[0];
    if (newDate < today) {
        document.getElementById("subMessage").textContent = "Subscription date cannot be in the past.";
        return;
    }

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