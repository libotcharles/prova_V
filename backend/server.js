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
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    res.json({
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

    res.status(500).json({
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

    const { data: existingUser } = await supabase
      .from('profilo')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

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
      user: data
    });

  } catch (error) {

    console.error('Errore register:', error);

    res.status(500).json({
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

    const { data: prodotti } = await supabase
      .from('prodotti')
      .select('*')
      .order('id');

    const { data: profili } = await supabase
      .from('profilo')
      .select('*')
      .order('id');

    res.json({
      prodotti,
      profili
    });

  } catch (error) {

    console.error('Errore data:', error);

    res.status(500).json({
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

    const { data: prod } = await supabase
      .from('prodotti')
      .select('*')
      .eq('id', prodottoId)
      .maybeSingle();

    if (!prod) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    const { data: user } = await supabase
      .from('profilo')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (prod.stock <= 0) {
      return res.status(409).json({ error: 'Prodotto esaurito' });
    }

    if (user.crediti < prod.prezzo) {
      return res.status(409).json({ error: 'Crediti insufficienti' });
    }

    await supabase
      .from('prodotti')
      .update({ stock: prod.stock - 1 })
      .eq('id', prodottoId);

    await supabase
      .from('profilo')
      .update({ crediti: user.crediti - prod.prezzo })
      .eq('id', userId);

    res.json({
      success: true,
      message: 'Acquisto completato'
    });

  } catch (error) {

    console.error('Errore buy:', error);

    res.status(500).json({
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

    const { data, error } = await supabase
      .from('prodotti')
      .insert([{ nome, prezzo, stock }])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      prodotto: data
    });

  } catch (error) {

    console.error('Errore create product:', error);

    res.status(500).json({
      error: 'Errore creazione prodotto'
    });

  }

});

// =========================
// DELETE PRODUCT
// =========================
app.delete('/api/admin/products/:id', async (req, res) => {

  try {

    const id = Number(req.params.id);

    const { data } = await supabase
      .from('prodotti')
      .delete()
      .eq('id', id)
      .select();

    res.json({
      success: true,
      deleted: data
    });

  } catch (error) {

    console.error('Errore delete product:', error);

    res.status(500).json({
      error: 'Errore eliminazione prodotto'
    });

  }

});

// =========================
// DELETE USER
// =========================
app.delete('/api/admin/users/:id', async (req, res) => {

  try {

    const id = Number(req.params.id);

    const { data: user } = await supabase
      .from('profilo')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Non puoi eliminare admin' });
    }

    const { data } = await supabase
      .from('profilo')
      .delete()
      .eq('id', id)
      .select();

    res.json({
      success: true,
      deleted: data
    });

  } catch (error) {

    console.error('Errore delete user:', error);

    res.status(500).json({
      error: 'Errore eliminazione utente'
    });

  }

});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {

  console.log(`Server acceso sulla porta ${PORT}`);

});