require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const PORT = process.env.PORT || 3000;

// Usa variabili d'ambiente su Render / locale
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Errore: SUPABASE_URL o SUPABASE_ANON_KEY mancanti.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors({
  origin: '*', 
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Il server è vivo e risponde alla root!');
});

// --- ROTTE AGGIORNATE ---

// GET: catalogo + TUTTI i profili (per scelta utente e admin)
app.get('/api/data', async (req, res) => {
    try {
        console.log("Recupero prodotti e profili...");
        
        const { data: prodotti, error: errorProd } = await supabase.from('prodotti').select('*').order('id', { ascending: true });
        if (errorProd) throw errorProd;

        // Ora carichiamo tutti i profili invece di uno solo
        const { data: profili, error: errorProf } = await supabase.from('profilo').select('*').order('id', { ascending: true });
        if (errorProf) throw errorProf;

        res.json({ prodotti, profili });
    } catch (error) {
        console.error("ERRORE SUPABASE:", error);
        res.status(500).json({ messaggio: "Errore caricamento", dettaglio: error.message });
    }
});

// POST: acquisto prodotto (accetta userId dal body)
app.post('/api/buy', async (req, res) => {
  try {
    const { prodottoId, userId } = req.body; // Riceviamo l'id dell'utente che compra

    if (!prodottoId || !userId) {
      return res.status(400).json({ error: 'Dati mancanti (prodottoId o userId)' });
    }

    // 1. Controllo Prodotto
    const { data: prod, error: prodError } = await supabase.from('prodotti').select('*').eq('id', prodottoId).single();
    if (prodError || !prod) return res.status(404).json({ error: 'Prodotto non trovato' });

    // 2. Controllo Utente
    const { data: user, error: userError } = await supabase.from('profilo').select('*').eq('id', userId).single();
    if (userError || !user) return res.status(404).json({ error: 'Utente non trovato' });

    // 3. Validazione Business
    if (prod.stock <= 0) return res.status(409).json({ error: 'Prodotto esaurito' });
    if (user.crediti < prod.prezzo) return res.status(409).json({ error: 'Crediti insufficienti' });

    // 4. Aggiornamento DB
    await supabase.from('prodotti').update({ stock: prod.stock - 1 }).eq('id', prodottoId);
    await supabase.from('profilo').update({ crediti: user.crediti - prod.prezzo }).eq('id', userId);

    return res.json({ success: true, message: 'Acquisto completato' });
  } catch (error) {
    console.error('Errore /api/buy:', error);
    return res.status(500).json({ error: 'Errore transazione' });
  }
});

// --- ROTTE ADMIN ---

// POST: crea nuovo utente (Novità)
app.post('/api/admin/users', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username mancante' });

        const { data, error } = await supabase
            .from('profilo')
            .insert([{ 
                username: username.trim(), 
                password: 'password123', // Password di default per i nuovi utenti creati dall'admin
                crediti: 1000 
            }])
            .select().single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Errore creazione utente' });
    }
});

// POST: admin aggiunge nuovo prodotto
app.post('/api/admin/products', async (req, res) => {
  try {
    const { nome, prezzo, stock } = req.body;
    if (!nome || prezzo < 0 || stock < 0) return res.status(400).json({ error: 'Dati non validi' });

    const { data, error } = await supabase.from('prodotti').insert([{ nome, prezzo, stock }]).select().single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Errore creazione prodotto' });
  }
});

// PATCH: modifica stock
app.patch('/api/admin/products/:id/stock', async (req, res) => {
  try {
    const id = req.params.id;
    const { stock } = req.body;
    if (stock < 0) return res.status(400).json({ error: 'Stock negativo non ammesso' });

    const { data, error } = await supabase.from('prodotti').update({ stock }).eq('id', id).select().single();
    if (error) throw error;

    res.json({ success: true, prodotto: data });
  } catch (error) {
    res.status(500).json({ error: 'Errore update stock' });
  }
});

// PATCH: modifica crediti utente specifico
app.patch('/api/admin/users/:id/credits', async (req, res) => {
  try {
    const id = req.params.id;
    const { credits } = req.body;
    if (credits < 0) return res.status(400).json({ error: 'Crediti negativi non ammessi' });

    const { data, error } = await supabase.from('profilo').update({ crediti: credits }).eq('id', id).select().single();
    if (error) throw error;

    res.json({ success: true, profilo: data });
  } catch (error) {
    res.status(500).json({ error: 'Errore update crediti' });
  }
});

app.listen(PORT, () => {
  console.log(`Server acceso sulla porta ${PORT}`);
});