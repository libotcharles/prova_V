const API_URL = "https://compito-f5ex.onrender.com/api"; // Verificare che sia corretto
let isAdmin = false;
let currentUserId = 1; // Default iniziale

// 1. CARICA I DATI (Prodotti + Lista Profili)
async function caricaDati() {
    try {
        console.log("Tentativo di recupero dati da:", `${API_URL}/data`);
        const res = await fetch(`${API_URL}/data`);
        
        if (!res.ok) {
            throw new Error(`Errore Server: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        console.log("Dati ricevuti con successo:", data);
        
        const profili = data.profili || [];
        const prodotti = data.prodotti || [];

        if (profili.length === 0) {
            console.warn("Nessun profilo trovato nel database.");
        }

        // --- Aggiornamento Header Multi-Utente ---
        // Trova l'utente attivo per mostrare saldo e nome nell'header
        const utenteAttivo = profili.find(u => u.id == currentUserId) || profili[0];
        
        if (utenteAttivo) {
            currentUserId = utenteAttivo.id;
            document.getElementById('userName').innerText = utenteAttivo.username;
            document.getElementById('userCredits').innerText = utenteAttivo.crediti;
            console.log(`Utente attivo impostato: ${utenteAttivo.username} (ID: ${currentUserId})`);
        } else {
            // Se non c'è proprio nessuno (nemmeno Charles ID 1)
            document.getElementById('userName').innerText = "Nessun Utente";
            document.getElementById('userCredits').innerText = "0";
        }

        // Aggiorna il Selettore Utenti dinamico nell'header (solo Vista Utente)
        popolaSelettoreUtenti(profili);

        // --- Griglia Prodotti (Comune) ---
        const app = document.getElementById('app');
        app.innerHTML = "";

        prodotti.forEach(p => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h3>${p.nome}</h3>
                <p>Prezzo: <strong>${p.prezzo}</strong> crediti</p>
                <p>Stock: ${p.stock}</p>
                ${!isAdmin ? 
                    `<button onclick="compra(${p.id})" ${p.stock <= 0 ? 'disabled' : ''} class="btn-buy">
                        ${p.stock <= 0 ? 'Esaurito' : 'Acquista Ora'}
                    </button>` :
                    `<div class="admin-controls" style="display:flex; gap:5px; margin-top:10px;">
                        <input type="number" id="st-${p.id}" value="${p.stock}" style="width: 60px">
                        <button onclick="update('stock', ${p.id})" class="btn-save" style="background:#f39c12; padding:2px 5px;">Salva Stock</button>
                    </div>`
                }
            `;
            app.appendChild(card);
        });

        // --- Gestione Visibilità Pannelli Admin ---
        // Mostra o nasconde i pannelli admin basandosi su 'isAdmin'
        const adminAddProductPanel = document.getElementById('admin-add-product');
        const adminManageUsersPanel = document.getElementById('admin-manage-users');
        
        if (adminAddProductPanel) adminAddProductPanel.style.display = isAdmin ? 'block' : 'none';
        if (adminManageUsersPanel) adminManageUsersPanel.style.display = isAdmin ? 'block' : 'none';

        // Popola la lista utenti Admin per la modifica saldi
        if (isAdmin && adminManageUsersPanel) {
            renderListaUtentiAdmin(profili);
        }

    } catch (error) {
        console.error("ERRORE CRITICO NEL CARICAMENTO DATI:", error);
        document.getElementById('userName').innerText = "Errore Connessione";
        document.getElementById('app').innerHTML = `<div class="error-box" style="color:red; text-align:center; padding:20px;">
            <h3>⚠️ Impossibile caricare il catalogo.</h3>
            <p>Verifica che il Backend su Render sia attivo e che la RLS su Supabase sia disabilitata.</p>
            <p style="font-size:12px;">Dettaglio: ${error.message}</p>
        </div>`;
    }
}

// 2. FUNZIONI DI SUPPORTO UI
// Popola il menu a tendina dell'header (Vista Utente)
function popolaSelettoreUtenti(profili) {
    const selector = document.getElementById('userSelector');
    if (!selector) return;
    
    // Se siamo Admin, nascondiamo il selettore (l'admin gestisce tutti, non ne sceglie uno)
    if (isAdmin) {
        selector.style.display = 'none';
        return;
    }
    
    selector.style.display = 'inline-block';
    selector.innerHTML = profili.map(u => 
        `<option value="${u.id}" ${u.id == currentUserId ? 'selected' : ''}>Account: ${u.username}</option>`
    ).join('');
}

// Crea la lista interattiva per l'admin per modificare i crediti singolarmente
function renderListaUtentiAdmin(profili) {
    const container = document.getElementById('users-list-container');
    if (!container) return;
    
    container.innerHTML = ""; // Pulisce
    
    if (profili.length === 0) {
        container.innerHTML = "<em>Nessun utente presente nel database.</em>";
        return;
    }

    profili.forEach(u => {
        const div = document.createElement('div');
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        div.style.padding = "5px";
        div.style.borderBottom = "1px solid #eee";
        
        div.innerHTML = `
            <span style="font-weight:500;">${u.username} (ID:${u.id})</span>
            <div style="display:flex; align-items:center; gap:10px;">
                <span>Saldo attuale: <strong style="color:green;">${u.crediti}</strong> cr.</span>
                <button onclick="update('crediti', ${u.id})" class="btn-admin-sub" style="background:#3498db; padding:2px 8px; font-size: 13px;">✏️ Modifica Saldo</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// 3. LOGICA UTENTE (Cambio Account e Acquisto)
// Chiamata dal selettore header nell'Vista Utente
function cambiaUtente(id) {
    currentUserId = id;
    console.log(`Cambiato utente attivo a ID: ${id}`);
    caricaDati(); // Ricarica per aggiornare nome e saldo nell'header
}

// Chiamata dai pulsanti "Acquista" sui prodotti
async function compra(id) {
    try {
        console.log(`Tentativo di acquisto: ProdottoID ${id}, UserID ${currentUserId}`);
        const res = await fetch(`${API_URL}/buy`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prodottoId: id, userId: currentUserId }) // Invia entrambi gli ID
        });
        const data = await res.json();
        
        if (res.ok) {
            alert("✅ Acquisto completato con successo!");
        } else {
            alert("❌ Errore durante l'acquisto: " + (data.error || "Operazione fallita"));
        }
        caricaDati(); // Ricarica per aggiornare saldo e stock
    } catch (e) { 
        console.error("Errore connessione acquisto:", e);
        alert("⚠️ Errore di connessione al server."); 
    }
}

// 4. LOGICA ADMIN (Aggiornamenti, Registrazione, Aggiunta Prodotto)
// Chiamata da "Salva Stock" o "Modifica Saldo"
async function update(tipo, id) {
    let url = "";
    let bodyData = {};

    if (tipo === 'crediti') {
        // Logica specifica admin: prompt per modificare saldo di un utente specifico
        const valore = prompt("Inserisci il NUOVO saldo TOTALE per questo utente:");
        if (valore === null || valore.trim() === "") return; // Cancellato o vuoto
        
        const creditsNum = Number(valore);
        if (isNaN(creditsNum) || creditsNum < 0) return alert("Inserisci un numero valido >= 0");

        url = `${API_URL}/admin/users/${id}/credits`; 
        bodyData = { credits: creditsNum };
        console.log(`Aggiornamento crediti per UserID ${id} a ${creditsNum}`);
    } 
    else if (tipo === 'stock') {
        // Logica specifica admin: input stock sul prodotto
        const inputStock = document.getElementById(`st-${id}`);
        const valore = inputStock.value;
        
        const stockNum = Number(valore);
        if (isNaN(stockNum) || stockNum < 0) return alert("Stock non valido");

        url = `${API_URL}/admin/products/${id}/stock`;
        bodyData = { stock: stockNum };
        console.log(`Aggiornamento stock per ProdottoID ${id} a ${stockNum}`);
    }

    try {
        const res = await fetch(url, {
            method: 'PATCH', // Usiamo PATCH per aggiornamenti parziali
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(bodyData)
        });
        
        if (res.ok) {
            console.log("Aggiornamento database riuscito.");
            caricaDati();
        } else {
            const err = await res.json();
            alert("❌ Errore aggiornamento database: " + err.error);
        }
    } catch (e) { 
        console.error("Errore connessione update:", e);
        alert("⚠️ Errore di connessione al server."); 
    }
}

// Chiamata da "Registra Utente" nella Vista Admin
async function creaUtente() {
    const usernameInput = document.getElementById('new-username');
    const username = usernameInput.value;
    
    if (!username || username.trim() === "") return alert("⚠️ Inserisci un nome valido!");

    try {
        console.log(`Creazione nuovo utente: ${username}`);
        const res = await fetch(`${API_URL}/admin/users`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: username.trim() }) // Inviamo SOLO lo username
        });
        
        if (res.ok) {
            console.log("Utente creato con successo.");
            usernameInput.value = ""; // Pulisce il campo
            alert(`✨ Utente ${username} registrato! (Saldo iniziale 1000 cr.)`);
            caricaDati(); // Ricarica per vedere il nuovo utente nella lista admin
        } else {
            const err = await res.json();
            alert("❌ Errore creazione utente: " + err.error);
        }
    } catch (e) { 
        console.error("Errore connessione creaUtente:", e);
        alert("⚠️ Errore di connessione al server."); 
    }
}

// Chiamata da "Crea Prodotto" nella Vista Admin
async function aggiungiProdotto() {
    const nome = document.getElementById('add-nome').value;
    const prezzo = document.getElementById('add-prezzo').value;
    const stock = document.getElementById('add-stock').value;

    if(!nome || !prezzo || !stock) return alert("⚠️ Compila tutti i campi!");
    
    const prezzoNum = Number(prezzo);
    const stockNum = Number(stock);
    
    if (isNaN(prezzoNum) || prezzoNum < 0 || isNaN(stockNum) || stockNum < 0) {
        return alert("⚠️ Prezzo e Stock devono essere numeri validi >= 0");
    }

    try {
        console.log(`Aggiunta nuovo prodotto: ${nome}`);
        const res = await fetch(`${API_URL}/admin/products`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ nome, prezzo: prezzoNum, stock: stockNum })
        });
        
        if(res.ok) {
            console.log("Prodotto aggiunto con successo.");
            alert("📦 Prodotto aggiunto al catalogo!");
            // Pulisce i campi (implementazione opzionale)
            document.getElementById('add-nome').value = "";
            document.getElementById('add-prezzo').value = "";
            document.getElementById('add-stock').value = "";
            caricaDati(); // Ricarica griglia prodotti
        } else {
            const err = await res.json();
            alert("❌ Errore aggiunta prodotto: " + err.error);
        }
    } catch (e) { 
        console.error("Errore connessione aggiungiProdotto:", e);
        alert("⚠️ Errore di connessione al server."); 
    }
}

// 5. NAVIGAZIONE (Switch Vista)
// Chiamata dai pulsanti navbar
function switchView(v) {
    isAdmin = (v === 'admin');
    console.log(`Switch vista. isAdmin: ${isAdmin}`);
    
    // Aggiorna l'opacità dei bottoni navbar per feedback visivo
    const btnUser = document.getElementById('btn-user');
    const btnAdmin = document.getElementById('btn-admin');
    
    if (btnUser) btnUser.style.opacity = isAdmin ? "0.5" : "1";
    if (btnAdmin) btnAdmin.style.opacity = isAdmin ? "1" : "0.5";
    
    // Ricarica i dati per mostrare i pannelli corretti
    caricaDati();
}

// Avvio iniziale
caricaDati();