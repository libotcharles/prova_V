Ecco la versione finale e completa della tua relazione (README), aggiornata con tutte le funzioni avanzate che abbiamo implementato (gestione multi-utente, registrazione e modifica crediti) e i tuoi link corretti.

---

# Progetto E-Commerce - Architetture Distribuite

### 1. Architettura

Il sistema segue un modello **Client-Server** con architettura **Thin Client**.

* **Frontend**: Sviluppato in HTML/CSS/JS e ospitato su **Vercel**. Si occupa della presentazione dei dati e gestisce lo switch dinamico tra "Vista Utente" e "Vista Admin".
* **Backend**: Sviluppato in **Node.js (Express)** e ospitato su **Render**. Gestisce la logica di business, la comunicazione sicura con il database e la validazione delle transazioni.
* **Database**: **Supabase (PostgreSQL)** gestisce la persistenza dei dati per prodotti e profili utenti attraverso tabelle relazionali.

### 2. Funzionalità Avanzate (Multi-User)

A differenza di un e-commerce statico, il sistema permette di:

* **Selezionare l'utente**: Tramite un menu a tendina nell'header è possibile cambiare l'account attivo (es. Charles, Mario).
* **Gestione Crediti**: Ogni utente ha un proprio saldo separato salvato nel database.
* **Registrazione Admin**: Dalla vista Admin è possibile registrare nuovi utenti che vengono immediatamente salvati su Supabase.

### 3. Endpoint API

* **GET `/api/data**`: Recupera l'intero catalogo prodotti e la lista di tutti i profili utenti esistenti.
* **POST `/api/buy**`: Effettua l'acquisto. Il server riceve `prodottoId` e `userId`, verificando la solvibilità dell'utente specifico prima di procedere.
* **POST `/api/admin/users**`: Crea un nuovo profilo utente (saldo predefinito 1000 cr.).
* **POST `/api/admin/products**`: Aggiunge un nuovo prodotto al catalogo.
* **PATCH `/api/admin/products/:id/stock**`: Modifica lo stock di un prodotto.
* **PATCH `/api/admin/users/:id/credits**`: Permette all'admin di sovrascrivere il saldo crediti di un utente (es. per assegnare bonus).

### 4. Sicurezza e Integrità dei Dati

Il server esegue controlli rigorosi prima di ogni operazione:

* Verifica l'esistenza di prodotto e utente.
* Controlla che lo `stock` sia sufficiente ($> 0$).
* Verifica che il saldo dell'utente sia sufficiente a coprire il prezzo.
In caso di errore, viene restituito un codice **409 (Conflict)** o **404**, impedendo database inconsistenti o saldi negativi.

### 5. Uso dell'IA

L'IA (Gemini) è stata utilizzata come supporto per:

* Debugging della comunicazione tra Render e Supabase.
* Ottimizzazione delle query SQL (utilizzo di `IDENTITY` per ID automatici).
* Generazione della logica asincrona per l'aggiornamento dinamico dell'interfaccia (DOM Manipulation).

### 6. Link del Progetto

* **Frontend (Vercel):** [https://compito-theta.vercel.app/](https://compito-theta.vercel.app/)
* **Backend (Render):** [https://compito-f5ex.onrender.com](https://compito-f5ex.onrender.com)
* **Database (Supabase):** [Dashboard Progetto f5ex](https://www.google.com/search?q=https://supabase.com/dashboard/project/hqsqjwgelyoqnkrfhngi)


supabase<: postgresql://postgres:password icJYoIsCyGmxIhYK  @db.hqsqjwgelyoqnkrfhngi.supabase.co:5432/postgres>
---

### Nota per la sicurezza

*Le credenziali del database (PostgreSQL URL) sono state utilizzate per la configurazione del backend su Render tramite variabili d'ambiente (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) per garantire che i dati sensibili non siano esposti nel codice sorgente del frontend.*

-
postgresql://postgres: icJYoIsCyGmxIhYK  @db.hqsqjwgelyoqnkrfhngi.supabase.co:5432/postgres