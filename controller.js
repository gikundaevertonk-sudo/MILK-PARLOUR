const user = requireRole("Controller");
if (user) {
    document.getElementById("welcomeMsg").textContent = `Welcome, ${user.display_name}`;
    loadSubscription();
}

async function loadSubscription() {
    const { data } = await supabaseClient.from("subscription").select("*").limit(1).single();
    document.getElementById("expiryDate").textContent = data.expiry_date;
    document.getElementById("activeStatus").textContent = data.is_active ? "Active" : "Inactive";
    document.getElementById("newExpiryDate").value = data.expiry_date;
    document.getElementById("isActiveCheckbox").checked = data.is_active;
}

async function updateSubscription() {
    const newDate = document.getElementById("newExpiryDate").value;
    const isActive = document.getElementById("isActiveCheckbox").checked;

    const { data } = await supabaseClient.from("subscription").select("subscription_id").limit(1).single();

    await supabaseClient
        .from("subscription")
        .update({ expiry_date: newDate, is_active: isActive })
        .eq("subscription_id", data.subscription_id);

    document.getElementById("subMessage").textContent = "Updated successfully.";
    loadSubscription();
}