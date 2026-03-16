# RandomGames Platform

## 1. Introduzione e Descrizione del Progetto

RandomGames Platform è una web application sviluppata come progetto didattico per il corso di **Architetture Distribuite**.

L'obiettivo del progetto è simulare una piccola piattaforma di e-commerce digitale nella quale gli utenti possono accedere ad un catalogo di prodotti e acquistarli utilizzando un sistema di **crediti virtuali**.

La piattaforma include anche un **pannello amministratore** che permette di gestire utenti e prodotti.

Questo progetto è stato realizzato per applicare in modo pratico i seguenti concetti studiati nel corso:

* architettura **client-server**
* comunicazione tramite **API REST**
* separazione tra **frontend e backend**
* gestione degli utenti
* autenticazione e sicurezza
* deploy su servizi cloud

Il sistema simula quindi una piattaforma reale di vendita digitale, ma in versione semplificata per scopi didattici.

---

# 2. Architettura del Sistema

Il sistema utilizza una **architettura Client-Server distribuita**.

L'applicazione è divisa in tre componenti principali:

## Frontend (Client)

Il frontend rappresenta la parte visibile all'utente.

È sviluppato utilizzando:

* **HTML** (linguaggio di markup utilizzato per creare la struttura delle pagine web)
* **CSS** (utilizzato per definire lo stile grafico dell'interfaccia)
* **JavaScript Vanilla** (linguaggio di programmazione utilizzato per rendere la pagina dinamica e comunicare con il backend)
* **Fetch API** (interfaccia JavaScript utilizzata per effettuare richieste HTTP al server)
* **LocalStorage** (memoria locale del browser utilizzata per salvare il token di autenticazione)

Il frontend è ospitato su **Vercel**, una piattaforma cloud progettata per il deploy rapido di applicazioni web statiche.

Il client si occupa di:

* mostrare l'interfaccia grafica
* gestire login e registrazione
* mostrare il catalogo prodotti
* inviare richieste al backend
* aggiornare dinamicamente la pagina tramite manipolazione del **DOM (Document Object Model)**

---

## Backend (Server)

Il backend rappresenta la parte logica dell'applicazione.

È sviluppato utilizzando:

* **Node.js** (runtime JavaScript che permette di eseguire codice JavaScript lato server)
* **Express.js** (framework per costruire API REST in modo semplice)
* **JWT – JSON Web Token** (sistema di autenticazione basato su token)
* **CORS** (meccanismo di sicurezza per controllare quali domini possono accedere alle API)
* **Helmet** (libreria che aggiunge header HTTP di sicurezza)

Il backend è ospitato su **Render**, una piattaforma cloud che permette di deployare applicazioni server.

Il server gestisce:

* autenticazione degli utenti
* verifica dei token di sicurezza
* gestione dei prodotti
* gestione degli utenti
* logica di acquisto
* comunicazione con il database

---

## Database

Il database utilizzato è **Supabase**, che utilizza **PostgreSQL**.

Supabase è stato scelto perché offre:

* database relazionale potente
* gestione semplice delle tabelle
* integrazione con Node.js
* scalabilità

Il database memorizza le informazioni persistenti del sistema.

---

# 3. Struttura del Database

Il database contiene principalmente due tabelle.

## Tabella profili

Contiene le informazioni sugli utenti:

* id
* username
* password (hashata)
* ruolo (user oppure admin)
* crediti disponibili

Ogni utente possiede un saldo di crediti che viene aggiornato dopo ogni acquisto.

---

## Tabella prodotti

Contiene le informazioni sui prodotti disponibili:

* id prodotto
* nome
* prezzo
* quantità disponibile (stock)

Quando un utente acquista un prodotto, lo stock viene ridotto automaticamente.

---

# 4. Thin Client vs Thick Client

Il sistema utilizza un'architettura **Thin Client**.

Un **Thin Client** è un client leggero che delega la maggior parte della logica al server.

Nel nostro progetto:

Il **frontend** si occupa principalmente di:

* mostrare l'interfaccia
* raccogliere input dell'utente
* inviare richieste HTTP

La logica principale viene gestita dal **backend**, ad esempio:

* autenticazione utenti
* verifica crediti
* verifica stock prodotti
* controllo ruoli
* aggiornamento database

Questo approccio è stato scelto perché:

* aumenta la sicurezza
* evita manipolazioni lato client
* centralizza la logica applicativa

Un **Thick Client** invece avrebbe molta logica direttamente nel browser, ma questo renderebbe il sistema meno sicuro.

---

# 5. Funzionalità del Sistema

## Registrazione Utente

Un nuovo utente può registrarsi tramite la pagina di registrazione.

Durante la registrazione il sistema:

* controlla la validità dello username
* verifica la password
* salva il nuovo utente nel database

Ad ogni nuovo utente viene assegnato un saldo iniziale di crediti.

---

## Login

Il login permette all'utente di autenticarsi.

Dopo il login il server genera un **JWT Token** che identifica la sessione dell'utente.

Il token viene salvato nel **LocalStorage del browser** e inviato nelle richieste successive.

Questo permette di mantenere l'utente autenticato durante la navigazione.

---

## Visualizzazione Catalogo

Gli utenti possono visualizzare il catalogo dei prodotti disponibili.

Per ogni prodotto vengono mostrati:

* nome
* prezzo
* disponibilità

I dati vengono recuperati dal backend tramite API.

---

## Acquisto Prodotto

Quando un utente effettua un acquisto il server esegue diversi controlli:

1. verifica che il prodotto esista
2. controlla che lo stock sia disponibile
3. verifica che l'utente abbia crediti sufficienti

Se tutte le condizioni sono soddisfatte:

* lo stock viene aggiornato
* i crediti dell'utente vengono ridotti

Questo garantisce la consistenza dei dati.

---

## Pannello Amministratore

L'utente con ruolo **admin** ha accesso ad una pagina amministrativa.

L'amministratore può:

* visualizzare tutti gli utenti
* modificare i crediti degli utenti
* eliminare utenti
* aggiungere nuovi prodotti
* modificare prezzo e stock dei prodotti
* eliminare prodotti

Questo pannello simula la gestione di un vero sistema e-commerce.

---

# 6. Endpoint API Principali

## Autenticazione

POST
/api/auth/login

POST
/api/auth/register

---

## Utente

GET
/api/me

GET
/api/products

POST
/api/buy

---

## Admin

GET
/api/admin/data

POST
/api/admin/products

PATCH
/api/admin/products/:id/stock

PATCH
/api/admin/products/:id/price

DELETE
/api/admin/products/:id

PATCH
/api/admin/users/:id/credits

DELETE
/api/admin/users/:id

---

# 7. Sicurezza del Sistema

Sono state implementate diverse misure di sicurezza.

## Autenticazione JWT

Il sistema utilizza **JSON Web Token** per gestire l'autenticazione.

Il token viene inviato nell'header:

Authorization: Bearer TOKEN

Il server verifica il token prima di permettere l'accesso alle API.

---

## Controllo dei Ruoli

Le operazioni amministrative possono essere eseguite solo da utenti con ruolo **admin**.

---

## Validazione Input

Il server verifica sempre:

* validità username
* formato password
* valori numerici
* esistenza dei dati nel database

Questo evita errori e manipolazioni.

---

## Protezione XSS

Il frontend utilizza una funzione chiamata:

escapeHtml()

per evitare l'inserimento di codice HTML malevolo.

---

## CORS

Il backend accetta richieste solo dal dominio del frontend.

Questo impedisce richieste non autorizzate da altri siti.

---

# 8. Tecnologie Utilizzate

## Frontend

* HTML (struttura delle pagine)
* CSS (stile grafico)
* JavaScript (logica client)

## Backend

* Node.js (runtime server)
* Express.js (framework API REST)

## Database

* Supabase / PostgreSQL (database relazionale)

## Hosting

* Vercel (hosting frontend)
* Render (hosting backend)

---

# 9. Link del Progetto


Frontend:
https://prova-v.vercel.app

username: admin
pasword admin123

Backend:
https://prova-v.onrender.com
---

# 10. Conclusione

Il progetto RandomGames Platform dimostra l'implementazione di una semplice piattaforma e-commerce utilizzando un'architettura distribuita client-server.

Attraverso questo progetto sono stati applicati concetti fondamentali di sviluppo web moderno come API REST, autenticazione, gestione utenti e deploy cloud.

Il sistema dimostra come frontend, backend e database possano collaborare per costruire un'applicazione web completa e funzionale.
