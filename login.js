document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("errorMessage");

    errorMessage.style.display = "none";

    const { data, error } = await supabaseClient.rpc("login_check", {
        p_username: username,
        p_password: password
    });

    if (error || !data || data.length === 0) {
        errorMessage.textContent = "Invalid username or password.";
        errorMessage.style.display = "block";
        return;
    }

    const user = data[0];

    sessionStorage.setItem("user", JSON.stringify(user));

    if (user.role === "Owner") {
        window.location.href = "owner.html";
    } else if (user.role === "Controller") {
        window.location.href = "controller.html";
    } else if (user.role === "Shop") {
        window.location.href = "shop.html";
    } else {
        errorMessage.textContent = "Your account does not have a valid role.";
        errorMessage.style.display = "block";
        sessionStorage.removeItem("user");
    }
});