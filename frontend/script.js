const API_URL = "https://prova-v.onrender.com/api";

let isAdmin = false;
let currentUserId = 1;

// =========================
// 1. CARICAMENTO DATI
// =========================
async function caricaDati() {
    try {
        console.log("Tentativo di recupero dati da:", `${API_URL}/data`);

        const res = await fetch(`${API_URL}/data`);

        if (!res.ok) {
            throw new Error(`Errore Server: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        console.log("Dati ricevuti con successo:", data);

        const profili = Array.isArray(data.profili) ? data.profili : [];
        const prodotti = Array.isArray(data.prodotti) ? data.prodotti : [];

        aggiornaHeaderUtente(profili);
        popolaSelettoreUtenti(profili);
        renderProdotti(prodotti);
        gestisciPannelliAdmin(profili);

    } catch (error) {
        console.error("ERRORE CRITICO NEL CARICAMENTO DATI:", error);

        const userName = document.getElementById("userName");
        const userCredits = document.getElementById("userCredits");
        const app = document.getElementById("app");

        if (userName) userName.innerText = "Errore Connessione";
        if (userCredits) userCredits.innerText = "0";

        if (app) {
            app.innerHTML = `
                <div class="error">
                    <h3>⚠️ Impossibile caricare il catalogo.</h3>
                    <p>Controlla che il backend su Render sia online e che Supabase sia configurato bene.</p>
                    <p style="font-size: 12px; margin-top: 8px;">Dettaglio: ${error.message}</p>
                </div>
            `;
        }
    }
}

function aggiornaHeaderUtente(profili) {
    const userName = document.getElementById("userName");
    const userCredits = document.getElementById("userCredits");

    if (!profili.length) {
        if (userName) userName.innerText = "Nessun Utente";
        if (userCredits) userCredits.innerText = "0";
        return;
    }

    let utenteAttivo = profili.find(u => Number(u.id) === Number(currentUserId));

    if (!utenteAttivo) {
        utenteAttivo = profili[0];
        currentUserId = utenteAttivo.id;
    }

    if (userName) userName.innerText = utenteAttivo.username;
    if (userCredits) userCredits.innerText = utenteAttivo.crediti;
}

function renderProdotti(prodotti) {
    const app = document.getElementById("app");
    if (!app) return;

    app.innerHTML = "";

    if (!prodotti.length) {
        app.innerHTML = `<div class="info">Nessun prodotto presente nel catalogo.</div>`;
        return;
    }

    prodotti.forEach(p => {
        const card = document.createElement("div");
        card.className = "card";

        const stockClass =
            p.stock <= 0 ? "stock-out" :
            p.stock <= 3 ? "stock-low" :
            "stock-ok";

        if (!isAdmin) {
            card.innerHTML = `
                <h3>${escapeHtml(p.nome)}</h3>
                <p>Prezzo: <strong>${p.prezzo}</strong> crediti</p>
                <p>Stock: <span class="${stockClass}">${p.stock}</span></p>
                <button
                    onclick="compra(${p.id})"
                    ${p.stock <= 0 ? "disabled" : ""}
                    class="btn-buy"
                >
                    ${p.stock <= 0 ? "Esaurito" : "Acquista Ora"}
                </button>
            `;
        } else {
            card.innerHTML = `
                <h3>${escapeHtml(p.nome)}</h3>
                <p>Prezzo: <strong>${p.prezzo}</strong> crediti</p>
                <p>Stock attuale: <span class="${stockClass}">${p.stock}</span></p>

                <div class="admin-controls" style="display:flex; gap:10px; margin-top:14px; align-items:center; flex-wrap:wrap;">
                    <input type="number" id="st-${p.id}" value="${p.stock}" min="0" style="width: 100px;">
                    <button onclick="update('stock', ${p.id})" class="btn-save">
                        Salva Stock
                    </button>
                </div>
            `;
        }

        app.appendChild(card);
    });
}

function gestisciPannelliAdmin(profili) {
    const adminAddProductPanel = document.getElementById("admin-add-product");
    const adminManageUsersPanel = document.getElementById("admin-manage-users");

    if (adminAddProductPanel) {
        adminAddProductPanel.style.display = isAdmin ? "block" : "none";
    }

    if (adminManageUsersPanel) {
        adminManageUsersPanel.style.display = isAdmin ? "block" : "none";
    }

    if (isAdmin) {
        renderListaUtentiAdmin(profili);
    }
}

// =========================
// 2. SUPPORTO UI
// =========================
function popolaSelettoreUtenti(profili) {
    const selector = document.getElementById("userSelector");
    if (!selector) return;

    if (isAdmin) {
        selector.style.display = "none";
        return;
    }

    selector.style.display = "inline-block";

    if (!profili.length) {
        selector.innerHTML = `<option>Nessun utente</option>`;
        return;
    }

    selector.innerHTML = profili.map(u => `
        <option value="${u.id}" ${Number(u.id) === Number(currentUserId) ? "selected" : ""}>
            Account: ${escapeHtml(u.username)}
        </option>
    `).join("");
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
                <span> (ID: ${u.id})</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span>Saldo attuale: <strong style="color:#31e6a8;">${u.crediti}</strong> cr.</span>
                <button onclick="update('crediti', ${u.id})" class="btn-admin">
                    Modifica Saldo
                </button>
            </div>
        `;

        container.appendChild(row);
    });
}

// =========================
// 3. LOGICA UTENTE
// =========================
function cambiaUtente(id) {
    currentUserId = Number(id);
    console.log(`Cambiato utente attivo a ID: ${currentUserId}`);
    caricaDati();
}

async function compra(id) {
    try {
        console.log(`Tentativo di acquisto: ProdottoID ${id}, UserID ${currentUserId}`);

        const res = await fetch(`${API_URL}/buy`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prodottoId: id,
                userId: currentUserId
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ Acquisto completato con successo!");
        } else {
            alert("❌ Errore durante l'acquisto: " + (data.error || "Operazione fallita"));
        }

        caricaDati();
    } catch (error) {
        console.error("Errore connessione acquisto:", error);
        alert("⚠️ Errore di connessione al server.");
    }
}

// =========================
// 4. LOGICA ADMIN
// =========================
async function update(tipo, id) {
    let url = "";
    let bodyData = {};

    if (tipo === "crediti") {
        const valore = prompt("Inserisci il NUOVO saldo totale per questo utente:");

        if (valore === null || valore.trim() === "") return;

        const creditsNum = Number(valore);

        if (isNaN(creditsNum) || creditsNum < 0) {
            alert("Inserisci un numero valido maggiore o uguale a 0");
            return;
        }

        url = `${API_URL}/admin/users/${id}/credits`;
        bodyData = { credits: creditsNum };

        console.log(`Aggiornamento crediti per UserID ${id} a ${creditsNum}`);
    }

    if (tipo === "stock") {
        const inputStock = document.getElementById(`st-${id}`);
        if (!inputStock) {
            alert("Campo stock non trovato");
            return;
        }

        const stockNum = Number(inputStock.value);

        if (isNaN(stockNum) || stockNum < 0) {
            alert("Stock non valido");
            return;
        }

        url = `${API_URL}/admin/products/${id}/stock`;
        bodyData = { stock: stockNum };

        console.log(`Aggiornamento stock per ProdottoID ${id} a ${stockNum}`);
    }

    if (!url) return;

    try {
        const res = await fetch(url, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyData)
        });

        const result = await res.json();

        if (res.ok) {
            alert("✅ Aggiornamento riuscito");
            caricaDati();
        } else {
            alert("❌ Errore aggiornamento database: " + (result.error || "Errore sconosciuto"));
        }
    } catch (error) {
        console.error("Errore connessione update:", error);
        alert("⚠️ Errore di connessione al server.");
    }
}

async function creaUtente() {
    const usernameInput = document.getElementById("new-username");
    if (!usernameInput) return;

    const username = usernameInput.value.trim();

    if (!username) {
        alert("⚠️ Inserisci un nome valido!");
        return;
    }

    try {
        console.log(`Creazione nuovo utente: ${username}`);

        const res = await fetch(`${API_URL}/admin/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username })
        });

        const data = await res.json();

        if (res.ok) {
            usernameInput.value = "";
            alert(`✨ Utente ${username} registrato! (Saldo iniziale 1000 crediti)`);
            caricaDati();
        } else {
            alert("❌ Errore creazione utente: " + (data.error || "Errore sconosciuto"));
        }
    } catch (error) {
        console.error("Errore connessione creaUtente:", error);
        alert("⚠️ Errore di connessione al server.");
    }
}

async function aggiungiProdotto() {
    const nomeInput = document.getElementById("add-nome");
    const prezzoInput = document.getElementById("add-prezzo");
    const stockInput = document.getElementById("add-stock");

    if (!nomeInput || !prezzoInput || !stockInput) return;

    const nome = nomeInput.value.trim();
    const prezzoNum = Number(prezzoInput.value);
    const stockNum = Number(stockInput.value);

    if (!nome || isNaN(prezzoNum) || isNaN(stockNum)) {
        alert("⚠️ Compila tutti i campi correttamente!");
        return;
    }

    if (prezzoNum < 0 || stockNum < 0) {
        alert("⚠️ Prezzo e stock devono essere numeri validi maggiori o uguali a 0");
        return;
    }

    try {
        console.log(`Aggiunta nuovo prodotto: ${nome}`);

        const res = await fetch(`${API_URL}/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nome,
                prezzo: prezzoNum,
                stock: stockNum
            })
        });

        const data = await res.json();

        if (res.ok) {
            nomeInput.value = "";
            prezzoInput.value = "";
            stockInput.value = "";

            alert("📦 Prodotto aggiunto al catalogo!");
            caricaDati();
        } else {
            alert("❌ Errore aggiunta prodotto: " + (data.error || "Errore sconosciuto"));
        }
    } catch (error) {
        console.error("Errore connessione aggiungiProdotto:", error);
        alert("⚠️ Errore di connessione al server.");
    }
}

// =========================
// 5. NAVIGAZIONE
// =========================
function switchView(v) {
    isAdmin = (v === "admin");
    console.log(`Switch vista. isAdmin: ${isAdmin}`);

    const btnUser = document.getElementById("btn-user");
    const btnAdmin = document.getElementById("btn-admin");

    if (btnUser) btnUser.style.opacity = isAdmin ? "0.6" : "1";
    if (btnAdmin) btnAdmin.style.opacity = isAdmin ? "1" : "0.6";

    caricaDati();
}

// =========================
// 6. UTILS
// =========================
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// =========================
// AVVIO
// =========================
caricaDati();