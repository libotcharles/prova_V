require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Variabili ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Errore: SUPABASE_URL o SUPABASE_ANON_KEY mancanti.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Root: mostra index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// GET: catalogo + tutti i profili
app.get('/api/data', async (req, res) => {
  try {
    console.log('Recupero prodotti e profili...');

    const { data: prodotti, error: errorProd } = await supabase
      .from('prodotti')
      .select('*')
      .order('id', { ascending: true });

    if (errorProd) throw errorProd;

    const { data: profili, error: errorProf } = await supabase
      .from('profilo')
      .select('*')
      .order('id', { ascending: true });

    if (errorProf) throw errorProf;

    res.json({ prodotti, profili });
  } catch (error) {
    console.error('ERRORE SUPABASE /api/data:', error);
    res.status(500).json({
      messaggio: 'Errore caricamento',
      dettaglio: error.message
    });
  }
});

// POST: acquisto prodotto
app.post('/api/buy', async (req, res) => {
  try {
    const { prodottoId, userId } = req.body;

    if (!prodottoId || !userId) {
      return res.status(400).json({
        error: 'Dati mancanti (prodottoId o userId)'
      });
    }

    // 1. Controllo prodotto
    const { data: prod, error: prodError } = await supabase
      .from('prodotti')
      .select('*')
      .eq('id', prodottoId)
      .single();

    if (prodError || !prod) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    // 2. Controllo utente
    const { data: user, error: userError } = await supabase
      .from('profilo')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // 3. Validazione business
    if (prod.stock <= 0) {
      return res.status(409).json({ error: 'Prodotto esaurito' });
    }

    if (user.crediti < prod.prezzo) {
      return res.status(409).json({ error: 'Crediti insufficienti' });
    }

    // 4. Aggiornamenti DB
    const { error: updateProdError } = await supabase
      .from('prodotti')
      .update({ stock: prod.stock - 1 })
      .eq('id', prodottoId);

    if (updateProdError) throw updateProdError;

    const { error: updateUserError } = await supabase
      .from('profilo')
      .update({ crediti: user.crediti - prod.prezzo })
      .eq('id', userId);

    if (updateUserError) throw updateUserError;

    return res.json({
      success: true,
      message: 'Acquisto completato'
    });
  } catch (error) {
    console.error('Errore /api/buy:', error);
    return res.status(500).json({
      error: 'Errore transazione',
      dettaglio: error.message
    });
  }
});

// --- ROTTE ADMIN ---

// POST: crea nuovo utente
app.post('/api/admin/users', async (req, res) => {
  try {
    const rawUsername = req.body.username;
    const username = String(rawUsername || '').trim();

    if (!username) {
      return res.status(400).json({ error: 'Username mancante' });
    }

    // Controllo se esiste già
    const { data: existingUser, error: checkError } = await supabase
      .from('profilo')
      .select('id, username')
      .ilike('username', username)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingUser) {
      return res.status(409).json({ error: 'Username già esistente' });
    }

    const { data, error } = await supabase
      .from('profilo')
      .insert([
        {
          username,
          password: 'password123',
          crediti: 1000
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Utente creato con successo',
      utente: data
    });
  } catch (error) {
    console.error('Errore /api/admin/users:', error);

    if (error.code === '23505') {
      return res.status(409).json({ error: 'Username già esistente' });
    }

    res.status(500).json({
      error: 'Errore creazione utente',
      dettaglio: error.message
    });
  }
});

// POST: admin aggiunge prodotto
app.post('/api/admin/products', async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const prezzo = Number(req.body.prezzo);
    const stock = Number(req.body.stock);

    if (!nome || Number.isNaN(prezzo) || Number.isNaN(stock) || prezzo < 0 || stock < 0) {
      return res.status(400).json({ error: 'Dati non validi' });
    }

    const { data, error } = await supabase
      .from('prodotti')
      .insert([{ nome, prezzo, stock }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Prodotto creato con successo',
      prodotto: data
    });
  } catch (error) {
    console.error('Errore /api/admin/products:', error);
    res.status(500).json({
      error: 'Errore creazione prodotto',
      dettaglio: error.message
    });
  }
});

// PATCH: modifica stock prodotto
app.patch('/api/admin/products/:id/stock', async (req, res) => {
  try {
    const id = req.params.id;
    const stock = Number(req.body.stock);

    if (Number.isNaN(stock) || stock < 0) {
      return res.status(400).json({ error: 'Stock negativo non ammesso' });
    }

    const { data, error } = await supabase
      .from('prodotti')
      .update({ stock })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      prodotto: data
    });
  } catch (error) {
    console.error('Errore /api/admin/products/:id/stock:', error);
    res.status(500).json({
      error: 'Errore update stock',
      dettaglio: error.message
    });
  }
});

// PATCH: modifica crediti utente
app.patch('/api/admin/users/:id/credits', async (req, res) => {
  try {
    const id = req.params.id;
    const credits = Number(req.body.credits);

    if (Number.isNaN(credits) || credits < 0) {
      return res.status(400).json({ error: 'Crediti negativi non ammessi' });
    }

    const { data, error } = await supabase
      .from('profilo')
      .update({ crediti: credits })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      profilo: data
    });
  } catch (error) {
    console.error('Errore /api/admin/users/:id/credits:', error);
    res.status(500).json({
      error: 'Errore update crediti',
      dettaglio: error.message
    });
  }
});

// Fallback API/file non trovati
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Rotta API non trovata' });
  }

  return res.status(404).send('Pagina non trovata');
});

app.listen(PORT, () => {
  console.log(`Server acceso sulla porta ${PORT}`);
});