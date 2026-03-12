const API_URL = "https://prova-v.onrender.com/api";
let currentUser = getLoggedUser();

document.addEventListener("DOMContentLoaded", () => {
    const page = getCurrentPage();

    if (page === "login") initLoginPage();
    if (page === "register") initRegisterPage();
    if (page === "user") initUserPage();
    if (page === "admin") initAdminPage();
});

function getCurrentPage() {
    const path = window.location.pathname.toLowerCase();

    if (path.endsWith("/register.html")) return "register";
    if (path.endsWith("/user.html")) return "user";
    if (path.endsWith("/admin.html")) return "admin";

    return "login";
}

function getLoggedUser() {
    try {
        return JSON.parse(localStorage.getItem("loggedUser"));
    } catch {
        return null;
    }
}

function setLoggedUser(user) {
    currentUser = user;
    localStorage.setItem("loggedUser", JSON.stringify(user));
}

function clearLoggedUser() {
    currentUser = null;
    localStorage.removeItem("loggedUser");
}

/* LOGIN */
function initLoginPage() {
    if (currentUser && currentUser.role === "admin") {
        window.location.href = "admin.html";
        return;
    }

    if (currentUser && currentUser.role === "user") {
        window.location.href = "user.html";
        return;
    }

    const btn = document.getElementById("login-submit");
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");

    if (btn) btn.addEventListener("click", loginUser);

    [usernameInput, passwordInput].forEach(input => {
        if (!input) return;
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") loginUser();
        });
    });
}

async function loginUser() {
    const username = document.getElementById("login-username")?.value.trim() || "";
    const password = document.getElementById("login-password")?.value.trim() || "";
    const messageBox = document.getElementById("login-message");

    clearMessage(messageBox);

    if (!username || !password) {
        showMessage(messageBox, "Inserisci username e password.", "error");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await safeJson(res);

        if (!res.ok) {
            showMessage(messageBox, data.error || "Credenziali non valide.", "error");
            return;
        }

        setLoggedUser(data.user);

        if (data.user.role === "admin") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "user.html";
        }
    } catch (error) {
        console.error("Errore login:", error);
        showMessage(messageBox, "Errore di connessione al server.", "error");
    }
}

/* REGISTER */
function initRegisterPage() {
    const btn = document.getElementById("register-submit");
    const usernameInput = document.getElementById("register-username");
    const passwordInput = document.getElementById("register-password");
    const confirmInput = document.getElementById("register-password-confirm");

    if (btn) btn.addEventListener("click", registerUser);

    [usernameInput, passwordInput, confirmInput].forEach(input => {
        if (!input) return;
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") registerUser();
        });
    });
}

async function registerUser() {
    const username = document.getElementById("register-username")?.value.trim() || "";
    const password = document.getElementById("register-password")?.value.trim() || "";
    const confirmPassword = document.getElementById("register-password-confirm")?.value.trim() || "";
    const messageBox = document.getElementById("register-message");

    clearMessage(messageBox);

    if (username.length < 3) {
        showMessage(messageBox, "Lo username deve avere almeno 3 caratteri.", "error");
        return;
    }

    if (!isValidPassword(password)) {
        showMessage(messageBox, "La password deve avere almeno 6 caratteri e almeno un numero.", "error");
        return;
    }

    if (password !== confirmPassword) {
        showMessage(messageBox, "Le password non coincidono.", "error");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await safeJson(res);

        if (!res.ok) {
            showMessage(messageBox, data.error || "Errore registrazione.", "error");
            return;
        }

        showMessage(messageBox, "Registrazione completata. Verrai reindirizzato al login...", "success");

        setTimeout(() => {
            window.location.href = "index.html";
        }, 1400);
    } catch (error) {
        console.error("Errore register:", error);
        showMessage(messageBox, "Errore di connessione al server.", "error");
    }
}

function isValidPassword(password) {
    return password.length >= 6 && /\d/.test(password);
}

/* USER */
function initUserPage() {
    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }

    if (currentUser.role === "admin") {
        window.location.href = "admin.html";
        return;
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

    loadUserPage();
}

async function loadUserPage() {
    try {
        const res = await fetch(`${API_URL}/data`);
        const data = await safeJson(res);

        if (!res.ok) throw new Error(data.error || "Errore caricamento dati");

        const profili = Array.isArray(data.profili) ? data.profili : [];
        const prodotti = Array.isArray(data.prodotti) ? data.prodotti : [];

        const freshUser = profili.find(u => Number(u.id) === Number(currentUser.id));
        if (!freshUser) {
            alert("Utente non trovato. Effettua di nuovo il login.");
            logoutUser();
            return;
        }

        setLoggedUser(freshUser);

        const userName = document.getElementById("userName");
        const userRole = document.getElementById("userRole");
        const userCredits = document.getElementById("userCredits");

        if (userName) userName.innerText = currentUser.username;
        if (userRole) userRole.innerText = currentUser.role;
        if (userCredits) userCredits.innerText = currentUser.crediti;

        renderUserProducts(prodotti);
    } catch (error) {
        console.error("Errore loadUserPage:", error);
        const container = document.getElementById("user-products");
        if (container) {
            container.innerHTML = `<div class="error">Errore caricamento catalogo</div>`;
        }
    }
}

function renderUserProducts(prodotti) {
    const container = document.getElementById("user-products");
    if (!container) return;

    container.innerHTML = "";

    if (!prodotti.length) {
        container.innerHTML = `<div class="info">Nessun prodotto presente nel catalogo.</div>`;
        return;
    }

    prodotti.forEach(p => {
        const card = document.createElement("div");
        card.className = "card";

        const stockClass =
            p.stock <= 0 ? "stock-out" :
            p.stock <= 3 ? "stock-low" :
            "stock-ok";

        card.innerHTML = `
            <h3>${escapeHtml(p.nome)}</h3>
            <p>Prezzo: <strong>${p.prezzo}</strong> crediti</p>
            <p>Stock: <span class="${stockClass}">${p.stock}</span></p>
            <button class="btn-buy" ${p.stock <= 0 ? "disabled" : ""} data-buy-id="${p.id}">
                ${p.stock <= 0 ? "Esaurito" : "Acquista"}
            </button>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll("[data-buy-id]").forEach(btn => {
        btn.addEventListener("click", () => compra(Number(btn.dataset.buyId)));
    });
}

async function compra(prodottoId) {
    try {
        const res = await fetch(`${API_URL}/buy`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prodottoId,
                userId: currentUser.id
            })
        });

        const data = await safeJson(res);

        if (!res.ok) {
            alert(data.error || "Errore durante l'acquisto.");
            return;
        }

        alert("✅ Acquisto completato.");
        loadUserPage();
    } catch (error) {
        console.error("Errore acquisto:", error);
        alert("⚠️ Errore di connessione al server.");
    }
}

/* ADMIN */
function initAdminPage() {
    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }

    if (currentUser.role !== "admin") {
        window.location.href = "user.html";
        return;
    }

    const logoutBtn = document.getElementById("logout-btn");
    const addProductBtn = document.getElementById("add-product-btn");
    const createUserBtn = document.getElementById("create-user-btn");

    if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);
    if (addProductBtn) addProductBtn.addEventListener("click", aggiungiProdotto);
    if (createUserBtn) createUserBtn.addEventListener("click", creaUtenteDaAdmin);

    const adminName = document.getElementById("adminName");
    const adminRole = document.getElementById("adminRole");
    if (adminName) adminName.innerText = currentUser.username;
    if (adminRole) adminRole.innerText = currentUser.role;

    loadAdminPage();
}

async function loadAdminPage() {
    try {
        const res = await fetch(`${API_URL}/data`);
        const data = await safeJson(res);

        if (!res.ok) throw new Error(data.error || "Errore caricamento dati");

        const profili = Array.isArray(data.profili) ? data.profili : [];
        const prodotti = Array.isArray(data.prodotti) ? data.prodotti : [];

        renderListaUtentiAdmin(profili);
        renderAdminProducts(prodotti);
    } catch (error) {
        console.error("Errore loadAdminPage:", error);
    }
}

function renderAdminProducts(prodotti) {
    const container = document.getElementById("admin-products");
    if (!container) return;

    container.innerHTML = "";

    if (!prodotti.length) {
        container.innerHTML = `<div class="info">Nessun prodotto presente nel catalogo.</div>`;
        return;
    }

    prodotti.forEach(p => {
        const card = document.createElement("div");
        card.className = "card";

        const stockClass =
            p.stock <= 0 ? "stock-out" :
            p.stock <= 3 ? "stock-low" :
            "stock-ok";

        card.innerHTML = `
            <h3>${escapeHtml(p.nome)}</h3>
            <p>Prezzo: <strong>${p.prezzo}</strong> crediti</p>
            <p>Stock attuale: <span class="${stockClass}">${p.stock}</span></p>
            <div class="admin-controls" style="display:flex; gap:10px; margin-top:14px; align-items:center; flex-wrap:wrap;">
                <input type="number" id="st-${p.id}" value="${p.stock}" min="0" style="width: 100px;">
                <button class="btn-save" data-stock-id="${p.id}">Salva Stock</button>
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll("[data-stock-id]").forEach(btn => {
        btn.addEventListener("click", () => updateStock(Number(btn.dataset.stockId)));
    });
}

function renderListaUtentiAdmin(profili) {
    const container = document.getElementById("users-list-container");
    if (!container) return;

    container.innerHTML = "";

    if (!profili.length) {
        container.innerHTML = `<div class="info">Nessun utente presente nel database.</div>`;
        return;
    }

    profili.forEach(u => {
        const row = document.createElement("div");
        row.className = "user-row";

        row.innerHTML = `
            <div>
                <strong>${escapeHtml(u.username)}</strong>
                <span>(ID: ${u.id}) - ruolo: ${escapeHtml(u.role || "user")}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span>Crediti: <strong style="color:#31e6a8;">${u.crediti}</strong></span>
                <button class="btn-admin" data-credit-id="${u.id}">Modifica Crediti</button>
            </div>
        `;

        container.appendChild(row);
    });

    container.querySelectorAll("[data-credit-id]").forEach(btn => {
        btn.addEventListener("click", () => updateCrediti(Number(btn.dataset.creditId)));
    });
}

async function updateCrediti(userId) {
    const valore = prompt("Inserisci il NUOVO saldo totale per questo utente:");
    if (valore === null || valore.trim() === "") return;

    const credits = Number(valore);
    if (Number.isNaN(credits) || credits < 0) {
        alert("Inserisci un numero valido maggiore o uguale a 0");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/credits`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ credits })
        });

        const data = await safeJson(res);

        if (!res.ok) {
            alert(data.error || "Errore aggiornamento crediti.");
            return;
        }

        alert("✅ Crediti aggiornati");
        loadAdminPage();
    } catch (error) {
        console.error("Errore updateCrediti:", error);
        alert("⚠️ Errore di connessione al server.");
    }
}

async function updateStock(productId) {
    const input = document.getElementById(`st-${productId}`);
    if (!input) return alert("Campo stock non trovato");

    const stock = Number(input.value);
    if (Number.isNaN(stock) || stock < 0) {
        alert("Stock non valido");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/products/${productId}/stock`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ stock })
        });

        const data = await safeJson(res);

        if (!res.ok) {
            alert(data.error || "Errore aggiornamento stock.");
            return;
        }

        alert("✅ Stock aggiornato");
        loadAdminPage();
    } catch (error) {
        console.error("Errore updateStock:", error);
        alert("⚠️ Errore di connessione al server.");
    }
}

async function aggiungiProdotto() {
    const nomeInput = document.getElementById("add-nome");
    const prezzoInput = document.getElementById("add-prezzo");
    const stockInput = document.getElementById("add-stock");

    const nome = nomeInput?.value.trim() || "";
    const prezzo = Number(prezzoInput?.value);
    const stock = Number(stockInput?.value);

    if (!nome || Number.isNaN(prezzo) || Number.isNaN(stock) || prezzo < 0 || stock < 0) {
        alert("Compila bene tutti i campi del prodotto.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ nome, prezzo, stock })
        });

        const data = await safeJson(res);

        if (!res.ok) {
            alert(data.error || "Errore creazione prodotto.");
            return;
        }

        nomeInput.value = "";
        prezzoInput.value = "";
        stockInput.value = "";

        alert("📦 Prodotto creato con successo");
        loadAdminPage();
    } catch (error) {
        console.error("Errore aggiungiProdotto:", error);
        alert("⚠️ Errore di connessione al server.");
    }
}

async function creaUtenteDaAdmin() {
    const usernameInput = document.getElementById("new-username");
    const passwordInput = document.getElementById("new-password");

    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value.trim() || "";

    if (username.length < 3) {
        alert("Lo username deve avere almeno 3 caratteri.");
        return;
    }

    if (!isValidPassword(password)) {
        alert("La password deve avere almeno 6 caratteri e almeno un numero.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await safeJson(res);

        if (!res.ok) {
            alert(data.error || "Errore creazione utente.");
            return;
        }

        usernameInput.value = "";
        passwordInput.value = "";

        alert("✨ Utente creato con successo");
        loadAdminPage();
    } catch (error) {
        console.error("Errore creaUtenteDaAdmin:", error);
        alert("⚠️ Errore di connessione al server.");
    }
}

/* LOGOUT */
function logoutUser() {
    clearLoggedUser();
    window.location.href = "index.html";
}

/* UTILS */
function showMessage(element, text, type = "") {
    if (!element) return;
    element.className = "message-box";
    if (type) element.classList.add(type);
    element.innerHTML = text;
}

function clearMessage(element) {
    if (!element) return;
    element.className = "message-box";
    element.innerHTML = "";
}

async function safeJson(res) {
    try {
        return await res.json();
    } catch {
        return {};
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}