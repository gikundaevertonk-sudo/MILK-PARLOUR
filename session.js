function requireRole(allowedRole) {
    const userJson = sessionStorage.getItem("user");
    if (!userJson) {
        return redirectToLogin();
    }

    let user;
    try {
        user = JSON.parse(userJson);
    } catch {
        sessionStorage.removeItem("user");
        return redirectToLogin();
    }

    if (user.role !== allowedRole) {
        return redirectToLogin();
    }
    return user;
}

function redirectToLogin() {
    window.location.href = "login.html";
    return null;
}

function logout() {
    sessionStorage.removeItem("user");
    window.location.href = "login.html";
}