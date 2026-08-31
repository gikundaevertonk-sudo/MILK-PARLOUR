function requireRole(allowedRole) {
    const userJson = sessionStorage.getItem("user");
    if (!userJson) {
        window.location.href = "login.html";
        return null;
    }
    const user = JSON.parse(userJson);
    if (user.role !== allowedRole) {
        window.location.href = "login.html";
        return null;
    }
    return user;
}

function logout() {
    sessionStorage.removeItem("user");
    window.location.href = "login.html";
}