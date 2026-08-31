document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("errorMessage");

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

    // Store who's logged in for other pages to check
    sessionStorage.setItem("user", JSON.stringify(user));

    // Redirect based on role
    if (user.role === "Owner") {
        window.location.href = "owner.html";
    } else if (user.role === "Controller") {
        window.location.href = "controller.html";
    } else {
        window.location.href = "shop.html";
    }
});