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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Errore: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti.');
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
// HELPERS
// =========================
function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6 && /\d/.test(password);
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

// =========================
// ROOT
// =========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================
// AUTH LOGIN
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
      .select('id, username, crediti, role, password')
      .eq('username', username)
      .eq('password', password)
      .maybeSingle();

    if (error) {
      console.error('Errore query login:', error);
      return res.status(500).json({ error: 'Errore login database' });
    }

    if (!user) {
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
    console.error('Errore login:', error);

    return res.status(500).json({
      error: 'Errore login',
      dettaglio: error.message
    });
  }
});

// =========================
// REGISTER
// =========================
app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password obbligatori' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username troppo corto' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: 'La password deve avere almeno 6 caratteri e almeno un numero'
      });
    }

    const { data: existingUser, error: existingError } = await supabase
      .from('profilo')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (existingError) {
      console.error('Errore check user esistente:', existingError);
      return res.status(500).json({ error: 'Errore controllo username' });
    }

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
      .select('id, username, crediti, role')
      .single();

    if (error) {
      console.error('Errore insert register:', error);
      return res.status(500).json({ error: 'Errore registrazione' });
    }

    return res.status(201).json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error('Errore register:', error);

    return res.status(500).json({
      error: 'Errore registrazione',
      dettaglio: error.message
    });
  }
});

// =========================
// DATA
// =========================
// ATTENZIONE: non restituisce password
// =========================
app.get('/api/data', async (req, res) => {
  try {
    const { data: prodotti, error: prodottiError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .order('id');

    if (prodottiError) {
      console.error('Errore lettura prodotti:', prodottiError);
      return res.status(500).json({ error: 'Errore caricamento prodotti' });
    }

    const { data: profili, error: profiliError } = await supabase
      .from('profilo')
      .select('id, username, crediti, role')
      .order('id');

    if (profiliError) {
      console.error('Errore lettura profili:', profiliError);
      return res.status(500).json({ error: 'Errore caricamento profili' });
    }

    return res.json({
      prodotti: prodotti || [],
      profili: profili || []
    });
  } catch (error) {
    console.error('Errore data:', error);

    return res.status(500).json({
      error: 'Errore caricamento dati',
      dettaglio: error.message
    });
  }
});

// =========================
// BUY PRODUCT
// =========================
app.post('/api/buy', async (req, res) => {
  try {
    const prodottoId = Number(req.body.prodottoId);
    const userId = Number(req.body.userId);

    if (!prodottoId || !userId) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }

    const { data: prod, error: prodError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .eq('id', prodottoId)
      .maybeSingle();

    if (prodError) {
      console.error('Errore lettura prodotto:', prodError);
      return res.status(500).json({ error: 'Errore lettura prodotto' });
    }

    if (!prod) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    const { data: user, error: userError } = await supabase
      .from('profilo')
      .select('id, username, crediti, role')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('Errore lettura utente:', userError);
      return res.status(500).json({ error: 'Errore lettura utente' });
    }

    if (!user) {
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

    if (updateProdError) {
      console.error('Errore update stock acquisto:', updateProdError);
      return res.status(500).json({ error: 'Errore aggiornamento stock' });
    }

    const { error: updateUserError } = await supabase
      .from('profilo')
      .update({ crediti: user.crediti - prod.prezzo })
      .eq('id', userId);

    if (updateUserError) {
      console.error('Errore update crediti acquisto:', updateUserError);
      return res.status(500).json({ error: 'Errore aggiornamento crediti' });
    }

    return res.json({
      success: true,
      message: 'Acquisto completato'
    });
  } catch (error) {
    console.error('Errore buy:', error);

    return res.status(500).json({
      error: 'Errore acquisto',
      dettaglio: error.message
    });
  }
});

// =========================
// CREATE PRODUCT
// =========================
app.post('/api/admin/products', async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const prezzo = Number(req.body.prezzo);
    const stock = Number(req.body.stock);

    if (!nome) {
      return res.status(400).json({ error: 'Nome prodotto obbligatorio' });
    }

    if (!isNonNegativeNumber(prezzo)) {
      return res.status(400).json({ error: 'Prezzo non valido' });
    }

    if (!isNonNegativeInteger(stock)) {
      return res.status(400).json({ error: 'Stock non valido' });
    }

    const { data, error } = await supabase
      .from('prodotti')
      .insert([{ nome, prezzo, stock }])
      .select('id, nome, prezzo, stock')
      .single();

    if (error) {
      console.error('Errore create product:', error);
      return res.status(500).json({ error: 'Errore creazione prodotto' });
    }

    return res.json({
      success: true,
      prodotto: data
    });
  } catch (error) {
    console.error('Errore create product:', error);

    return res.status(500).json({
      error: 'Errore creazione prodotto',
      dettaglio: error.message
    });
  }
});

// =========================
// CREATE USER FROM ADMIN
// =========================
app.post('/api/admin/users', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password obbligatori' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Lo username deve avere almeno 3 caratteri' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: 'La password deve avere almeno 6 caratteri e almeno un numero'
      });
    }

    const { data: existingUser, error: existingError } = await supabase
      .from('profilo')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (existingError) {
      console.error('Errore check username admin create:', existingError);
      return res.status(500).json({ error: 'Errore controllo username' });
    }

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
      .select('id, username, crediti, role')
      .single();

    if (error) {
      console.error('Errore creazione utente admin:', error);
      return res.status(500).json({ error: 'Errore creazione utente' });
    }

    return res.status(201).json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error('Errore create user admin:', error);

    return res.status(500).json({
      error: 'Errore creazione utente',
      dettaglio: error.message
    });
  }
});

// =========================
// UPDATE USER CREDITS
// Compatibile con frontend:
// body: { credits }
// =========================
app.patch('/api/admin/users/:id/credits', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const credits = Number(req.body.credits);

    if (!id) {
      return res.status(400).json({ error: 'ID utente non valido' });
    }

    if (!isNonNegativeInteger(credits)) {
      return res.status(400).json({ error: 'Crediti non validi' });
    }

    const { data: user, error: userError } = await supabase
      .from('profilo')
      .select('id, username, crediti, role')
      .eq('id', id)
      .maybeSingle();

    if (userError) {
      console.error('Errore lettura utente credits:', userError);
      return res.status(500).json({ error: 'Errore lettura utente' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const { data, error } = await supabase
      .from('profilo')
      .update({ crediti: credits })
      .eq('id', id)
      .select('id, username, crediti, role')
      .single();

    if (error) {
      console.error('Errore update crediti:', error);
      return res.status(500).json({ error: 'Errore aggiornamento crediti' });
    }

    return res.json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error('Errore update credits:', error);

    return res.status(500).json({
      error: 'Errore aggiornamento crediti',
      dettaglio: error.message
    });
  }
});

// =========================
// UPDATE PRODUCT STOCK
// Compatibile con frontend:
// body: { stock }
// =========================
app.patch('/api/admin/products/:id/stock', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const stock = Number(req.body.stock);

    if (!id) {
      return res.status(400).json({ error: 'ID prodotto non valido' });
    }

    if (!isNonNegativeInteger(stock)) {
      return res.status(400).json({ error: 'Stock non valido' });
    }

    const { data: product, error: productError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .eq('id', id)
      .maybeSingle();

    if (productError) {
      console.error('Errore lettura prodotto stock:', productError);
      return res.status(500).json({ error: 'Errore lettura prodotto' });
    }

    if (!product) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    const { data, error } = await supabase
      .from('prodotti')
      .update({ stock })
      .eq('id', id)
      .select('id, nome, prezzo, stock')
      .single();

    if (error) {
      console.error('Errore update stock:', error);
      return res.status(500).json({ error: 'Errore aggiornamento stock' });
    }

    return res.json({
      success: true,
      prodotto: data
    });
  } catch (error) {
    console.error('Errore update stock:', error);

    return res.status(500).json({
      error: 'Errore aggiornamento stock',
      dettaglio: error.message
    });
  }
});

// =========================
// UPDATE PRODUCT PRICE
// Compatibile con frontend:
// body: { prezzo }
// =========================
app.patch('/api/admin/products/:id/price', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const prezzo = Number(req.body.prezzo);

    if (!id) {
      return res.status(400).json({ error: 'ID prodotto non valido' });
    }

    if (!isNonNegativeNumber(prezzo)) {
      return res.status(400).json({ error: 'Prezzo non valido' });
    }

    const { data: product, error: productError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .eq('id', id)
      .maybeSingle();

    if (productError) {
      console.error('Errore lettura prodotto prezzo:', productError);
      return res.status(500).json({ error: 'Errore lettura prodotto' });
    }

    if (!product) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    const { data, error } = await supabase
      .from('prodotti')
      .update({ prezzo })
      .eq('id', id)
      .select('id, nome, prezzo, stock')
      .single();

    if (error) {
      console.error('Errore update prezzo:', error);
      return res.status(500).json({ error: 'Errore aggiornamento prezzo' });
    }

    return res.json({
      success: true,
      prodotto: data
    });
  } catch (error) {
    console.error('Errore update price:', error);

    return res.status(500).json({
      error: 'Errore aggiornamento prezzo',
      dettaglio: error.message
    });
  }
});

// =========================
// DELETE PRODUCT
// =========================
app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID prodotto non valido' });
    }

    const { data: product, error: productError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .eq('id', id)
      .maybeSingle();

    if (productError) {
      console.error('Errore check delete product:', productError);
      return res.status(500).json({ error: 'Errore verifica prodotto' });
    }

    if (!product) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    const { data, error } = await supabase
      .from('prodotti')
      .delete()
      .eq('id', id)
      .select('id, nome, prezzo, stock');

    if (error) {
      console.error('Errore delete product:', error);
      return res.status(500).json({ error: 'Errore eliminazione prodotto' });
    }

    return res.json({
      success: true,
      deleted: data
    });
  } catch (error) {
    console.error('Errore delete product:', error);

    return res.status(500).json({
      error: 'Errore eliminazione prodotto',
      dettaglio: error.message
    });
  }
});

// =========================
// DELETE USER
// =========================
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID utente non valido' });
    }

    const { data: user, error: userError } = await supabase
      .from('profilo')
      .select('id, username, crediti, role')
      .eq('id', id)
      .maybeSingle();

    if (userError) {
      console.error('Errore check delete user:', userError);
      return res.status(500).json({ error: 'Errore verifica utente' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Non puoi eliminare admin' });
    }

    const { data, error } = await supabase
      .from('profilo')
      .delete()
      .eq('id', id)
      .select('id, username, crediti, role');

    if (error) {
      console.error('Errore delete user:', error);
      return res.status(500).json({ error: 'Errore eliminazione utente' });
    }

    return res.json({
      success: true,
      deleted: data
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
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`Server acceso sulla porta ${PORT}`);
});