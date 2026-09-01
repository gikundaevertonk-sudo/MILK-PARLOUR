document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => togglePasswordVisibility(button.dataset.passwordToggle, button));
});

function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    button.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
    button.setAttribute("title", isVisible ? "Show password" : "Hide password");
    button.setAttribute("aria-pressed", String(!isVisible));
}

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