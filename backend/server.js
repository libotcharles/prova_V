require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// CONFIG SUPABASE
// =========================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Errore: SUPABASE_URL o SUPABASE_ANON_KEY mancanti.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =========================
// MIDDLEWARE
// =========================
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =========================
// ROOT
// =========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================
// AUTH
// =========================
app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password obbligatori' });
    }

    const { data: user, error } = await supabase
      .from('profilo')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        crediti: user.crediti,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Errore /api/auth/login:', error);
    return res.status(500).json({
      error: 'Errore login',
      dettaglio: error.message
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password obbligatori' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Lo username deve avere almeno 3 caratteri' });
    }

    if (password.length < 6 || !/\d/.test(password)) {
      return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri e un numero' });
    }

    const { data: existingUser, error: checkError } = await supabase
      .from('profilo')
      .select('id')
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
          password,
          crediti: 1000,
          role: 'user'
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      user: {
        id: data.id,
        username: data.username,
        crediti: data.crediti,
        role: data.role
      }
    });
  } catch (error) {
    console.error('Errore /api/auth/register:', error);
    return res.status(500).json({
      error: 'Errore registrazione',
      dettaglio: error.message
    });
  }
});

// =========================
// DATA
// =========================
app.get('/api/data', async (req, res) => {
  try {
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

// =========================
// USER
// =========================
app.post('/api/buy', async (req, res) => {
  try {
    const { prodottoId, userId } = req.body;

    if (!prodottoId || !userId) {
      return res.status(400).json({
        error: 'Dati mancanti (prodottoId o userId)'
      });
    }

    const { data: prod, error: prodError } = await supabase
      .from('prodotti')
      .select('*')
      .eq('id', prodottoId)
      .single();

    if (prodError || !prod) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    const { data: user, error: userError } = await supabase
      .from('profilo')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (prod.stock <= 0) {
      return res.status(409).json({ error: 'Prodotto esaurito' });
    }

    if (user.crediti < prod.prezzo) {
      return res.status(409).json({ error: 'Crediti insufficienti' });
    }

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

// =========================
// ADMIN
// =========================
app.post('/api/admin/users', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || 'password123').trim();

    if (!username) {
      return res.status(400).json({ error: 'Username mancante' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Lo username deve avere almeno 3 caratteri' });
    }

    if (password.length < 6 || !/\d/.test(password)) {
      return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri e un numero' });
    }

    const { data: existingUser, error: checkError } = await supabase
      .from('profilo')
      .select('id')
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
          password,
          crediti: 1000,
          role: 'user'
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
    res.status(500).json({
      error: 'Errore creazione utente',
      dettaglio: error.message
    });
  }
});

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

    res.json({ success: true, prodotto: data });
  } catch (error) {
    console.error('Errore stock:', error);
    res.status(500).json({ error: 'Errore update stock', dettaglio: error.message });
  }
});

app.patch('/api/admin/products/:id/price', async (req, res) => {
  try {
    const id = req.params.id;
    const prezzo = Number(req.body.prezzo);

    if (Number.isNaN(prezzo) || prezzo < 0) {
      return res.status(400).json({ error: 'Prezzo non valido' });
    }

    const { data, error } = await supabase
      .from('prodotti')
      .update({ prezzo })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, prodotto: data });
  } catch (error) {
    console.error('Errore prezzo:', error);
    res.status(500).json({ error: 'Errore update prezzo', dettaglio: error.message });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID prodotto non valido' });
    }

    const { data: existingProduct, error: findError } = await supabase
      .from('prodotti')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw findError;

    if (!existingProduct) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from('prodotti')
      .delete()
      .eq('id', id)
      .select('id, nome');

    if (deleteError) throw deleteError;

    if (!deletedRows || deletedRows.length === 0) {
      return res.status(500).json({ error: 'Eliminazione prodotto non riuscita' });
    }

    return res.json({
      success: true,
      message: 'Prodotto eliminato con successo',
      deleted: deletedRows[0]
    });
  } catch (error) {
    console.error('Errore delete product:', error);
    return res.status(500).json({
      error: 'Errore eliminazione prodotto',
      dettaglio: error.message
    });
  }
});

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

    res.json({ success: true, profilo: data });
  } catch (error) {
    console.error('Errore credits:', error);
    res.status(500).json({ error: 'Errore update crediti', dettaglio: error.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID utente non valido' });
    }

    const { data: user, error: findError } = await supabase
      .from('profilo')
      .select('id, username, role')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw findError;

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Non puoi eliminare un admin' });
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from('profilo')
      .delete()
      .eq('id', id)
      .select('id, username, role');

    if (deleteError) throw deleteError;

    if (!deletedRows || deletedRows.length === 0) {
      return res.status(500).json({ error: 'Eliminazione utente non riuscita' });
    }

    return res.json({
      success: true,
      message: 'Utente eliminato con successo',
      deleted: deletedRows[0]
    });
  } catch (error) {
    console.error('Errore delete user:', error);
    return res.status(500).json({
      error: 'Errore eliminazione utente',
      dettaglio: error.message
    });
  }
});

// =========================
// FALLBACK
// =========================
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Rotta API non trovata' });
  }

  return res.status(404).send('Pagina non trovata');
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`Server acceso sulla porta ${PORT}`);
});


