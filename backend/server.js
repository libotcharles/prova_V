require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// CONFIG
// =========================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
const isProduction = process.env.NODE_ENV === 'production';

if (!supabaseUrl || !supabaseKey || !jwtSecret) {
  console.error('Errore: variabili ambiente mancanti (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =========================
// MIDDLEWARE SICUREZZA
// =========================
app.use(helmet());

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://prova-v.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin non consentita da CORS"));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: '10kb' }));

// Servi solo una cartella pubblica, non tutta __dirname
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// RATE LIMIT
// =========================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Troppi tentativi di login. Riprova più tardi.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// =========================
// HELPERS
// =========================
function isValidPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 6 &&
    /\d/.test(password)
  );
}

function isValidUsername(username) {
  return (
    typeof username === 'string' &&
    username.length >= 3 &&
    username.length <= 30 &&
    /^[a-zA-Z0-9_]+$/.test(username)
  );
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: message
  });
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    jwtSecret,
    { expiresIn: '2h' }
  );
}

// =========================
// AUTH MIDDLEWARE
// =========================
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Token mancante o non valido');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    req.user = decoded;
    next();
  } catch (error) {
    return sendError(res, 401, 'Sessione non valida o scaduta');
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return sendError(res, 403, 'Accesso riservato agli admin');
  }
  next();
}

// =========================
// ROOT
// =========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================
// AUTH LOGIN
// =========================
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();

    if (!username || !password) {
      return sendError(res, 400, 'Username e password obbligatori');
    }

    const { data: user, error } = await supabase
      .from('profilo')
      .select('id, username, crediti, role, password')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      console.error('Errore query login:', error);
      return sendError(res, 500, 'Errore interno durante il login');
    }

    if (!user) {
      return sendError(res, 401, 'Credenziali non valide');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return sendError(res, 401, 'Credenziali non valide');
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        crediti: user.crediti,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Errore login:', error);
    return sendError(res, 500, 'Errore interno durante il login');
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
      return sendError(res, 400, 'Username e password obbligatori');
    }

    if (!isValidUsername(username)) {
      return sendError(
        res,
        400,
        'Username non valido: usa 3-30 caratteri, solo lettere, numeri e underscore'
      );
    }

    if (!isValidPassword(password)) {
      return sendError(
        res,
        400,
        'La password deve avere almeno 6 caratteri e almeno un numero'
      );
    }

    const { data: existingUser, error: existingError } = await supabase
      .from('profilo')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingError) {
      console.error('Errore controllo username:', existingError);
      return sendError(res, 500, 'Errore controllo username');
    }

    if (existingUser) {
      return sendError(res, 409, 'Username già esistente');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('profilo')
      .insert([
        {
          username,
          password: hashedPassword,
          crediti: 1000,
          role: 'user'
        }
      ])
      .select('id, username, crediti, role')
      .single();

    if (error) {
      console.error('Errore registrazione:', error);
      return sendError(res, 500, 'Errore registrazione');
    }

    const token = generateToken(data);

    return res.status(201).json({
      success: true,
      token,
      user: data
    });
  } catch (error) {
    console.error('Errore register:', error);
    return sendError(res, 500, 'Errore interno durante la registrazione');
  }
});

// =========================
// PROFILO UTENTE LOGGATO
// =========================
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('profilo')
      .select('id, username, crediti, role')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('Errore lettura profilo:', error);
      return sendError(res, 500, 'Errore caricamento profilo');
    }

    if (!user) {
      return sendError(res, 404, 'Utente non trovato');
    }

    return res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Errore /api/me:', error);
    return sendError(res, 500, 'Errore caricamento profilo');
  }
});

// =========================
// PRODOTTI PUBBLICI
// =========================
app.get('/api/products', async (req, res) => {
  try {
    const { data: prodotti, error } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .order('id');

    if (error) {
      console.error('Errore lettura prodotti:', error);
      return sendError(res, 500, 'Errore caricamento prodotti');
    }

    return res.json({
      success: true,
      prodotti: prodotti || []
    });
  } catch (error) {
    console.error('Errore /api/products:', error);
    return sendError(res, 500, 'Errore caricamento prodotti');
  }
});

// =========================
// ADMIN: TUTTI I DATI
// =========================
app.get('/api/admin/data', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: prodotti, error: prodottiError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .order('id');

    if (prodottiError) {
      console.error('Errore lettura prodotti admin:', prodottiError);
      return sendError(res, 500, 'Errore caricamento prodotti');
    }

    const { data: profili, error: profiliError } = await supabase
      .from('profilo')
      .select('id, username, crediti, role')
      .order('id');

    if (profiliError) {
      console.error('Errore lettura profili admin:', profiliError);
      return sendError(res, 500, 'Errore caricamento profili');
    }

    return res.json({
      success: true,
      prodotti: prodotti || [],
      profili: profili || []
    });
  } catch (error) {
    console.error('Errore /api/admin/data:', error);
    return sendError(res, 500, 'Errore caricamento dati admin');
  }
});

// =========================
// BUY PRODUCT
// Nota: per un progetto scolastico va bene così,
// ma in produzione sarebbe meglio una transazione DB.
// =========================
app.post('/api/buy', requireAuth, async (req, res) => {
  try {
    const prodottoId = Number(req.body.prodottoId);
    const userId = req.user.id;

    if (!isNonNegativeInteger(prodottoId) || prodottoId <= 0) {
      return sendError(res, 400, 'ID prodotto non valido');
    }

    const { data: prod, error: prodError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .eq('id', prodottoId)
      .maybeSingle();

    if (prodError) {
      console.error('Errore lettura prodotto:', prodError);
      return sendError(res, 500, 'Errore lettura prodotto');
    }

    if (!prod) {
      return sendError(res, 404, 'Prodotto non trovato');
    }

    const { data: user, error: userError } = await supabase
      .from('profilo')
      .select('id, username, crediti, role')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('Errore lettura utente:', userError);
      return sendError(res, 500, 'Errore lettura utente');
    }

    if (!user) {
      return sendError(res, 404, 'Utente non trovato');
    }

    if (prod.stock <= 0) {
      return sendError(res, 409, 'Prodotto esaurito');
    }

    if (user.crediti < prod.prezzo) {
      return sendError(res, 409, 'Crediti insufficienti');
    }

    const newStock = prod.stock - 1;
    const newCredits = user.crediti - prod.prezzo;

    const { error: updateProdError } = await supabase
      .from('prodotti')
      .update({ stock: newStock })
      .eq('id', prodottoId);

    if (updateProdError) {
      console.error('Errore update stock acquisto:', updateProdError);
      return sendError(res, 500, 'Errore aggiornamento stock');
    }

    const { error: updateUserError } = await supabase
      .from('profilo')
      .update({ crediti: newCredits })
      .eq('id', userId);

    if (updateUserError) {
      console.error('Errore update crediti acquisto:', updateUserError);
      return sendError(res, 500, 'Errore aggiornamento crediti');
    }

    return res.json({
      success: true,
      message: 'Acquisto completato',
      acquisto: {
        prodottoId: prod.id,
        nome: prod.nome,
        prezzo: prod.prezzo,
        creditiRimanenti: newCredits,
        stockRimanente: newStock
      }
    });
  } catch (error) {
    console.error('Errore buy:', error);
    return sendError(res, 500, 'Errore acquisto');
  }
});

// =========================
// ADMIN - CREATE PRODUCT
// =========================
app.post('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const prezzo = Number(req.body.prezzo);
    const stock = Number(req.body.stock);

    if (!nome || nome.length < 2 || nome.length > 100) {
      return sendError(res, 400, 'Nome prodotto non valido');
    }

    if (!isNonNegativeNumber(prezzo)) {
      return sendError(res, 400, 'Prezzo non valido');
    }

    if (!isNonNegativeInteger(stock)) {
      return sendError(res, 400, 'Stock non valido');
    }

    const { data, error } = await supabase
      .from('prodotti')
      .insert([{ nome, prezzo, stock }])
      .select('id, nome, prezzo, stock')
      .single();

    if (error) {
      console.error('Errore create product:', error);
      return sendError(res, 500, 'Errore creazione prodotto');
    }

    return res.status(201).json({
      success: true,
      prodotto: data
    });
  } catch (error) {
    console.error('Errore create product:', error);
    return sendError(res, 500, 'Errore creazione prodotto');
  }
});

// =========================
// ADMIN - CREATE USER
// =========================
app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();
    const role = req.body.role === 'admin' ? 'admin' : 'user';

    if (!username || !password) {
      return sendError(res, 400, 'Username e password obbligatori');
    }

    if (!isValidUsername(username)) {
      return sendError(
        res,
        400,
        'Username non valido: usa 3-30 caratteri, solo lettere, numeri e underscore'
      );
    }

    if (!isValidPassword(password)) {
      return sendError(
        res,
        400,
        'La password deve avere almeno 6 caratteri e almeno un numero'
      );
    }

    const { data: existingUser, error: existingError } = await supabase
      .from('profilo')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingError) {
      console.error('Errore controllo username admin:', existingError);
      return sendError(res, 500, 'Errore controllo username');
    }

    if (existingUser) {
      return sendError(res, 409, 'Username già esistente');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('profilo')
      .insert([
        {
          username,
          password: hashedPassword,
          crediti: 1000,
          role
        }
      ])
      .select('id, username, crediti, role')
      .single();

    if (error) {
      console.error('Errore creazione utente admin:', error);
      return sendError(res, 500, 'Errore creazione utente');
    }

    return res.status(201).json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error('Errore create user admin:', error);
    return sendError(res, 500, 'Errore creazione utente');
  }
});

// =========================
// ADMIN - UPDATE USER CREDITS
// body: { credits }
// =========================
app.patch('/api/admin/users/:id/credits', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const credits = Number(req.body.credits);

    if (!isNonNegativeInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID utente non valido');
    }

    if (!isNonNegativeInteger(credits)) {
      return sendError(res, 400, 'Crediti non validi');
    }

    const { data: user, error: userError } = await supabase
      .from('profilo')
      .select('id, username, crediti, role')
      .eq('id', id)
      .maybeSingle();

    if (userError) {
      console.error('Errore lettura utente credits:', userError);
      return sendError(res, 500, 'Errore lettura utente');
    }

    if (!user) {
      return sendError(res, 404, 'Utente non trovato');
    }

    const { data, error } = await supabase
      .from('profilo')
      .update({ crediti: credits })
      .eq('id', id)
      .select('id, username, crediti, role')
      .single();

    if (error) {
      console.error('Errore update crediti:', error);
      return sendError(res, 500, 'Errore aggiornamento crediti');
    }

    return res.json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error('Errore update credits:', error);
    return sendError(res, 500, 'Errore aggiornamento crediti');
  }
});

// =========================
// ADMIN - UPDATE PRODUCT STOCK
// body: { stock }
// =========================
app.patch('/api/admin/products/:id/stock', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const stock = Number(req.body.stock);

    if (!isNonNegativeInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID prodotto non valido');
    }

    if (!isNonNegativeInteger(stock)) {
      return sendError(res, 400, 'Stock non valido');
    }

    const { data: product, error: productError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .eq('id', id)
      .maybeSingle();

    if (productError) {
      console.error('Errore lettura prodotto stock:', productError);
      return sendError(res, 500, 'Errore lettura prodotto');
    }

    if (!product) {
      return sendError(res, 404, 'Prodotto non trovato');
    }

    const { data, error } = await supabase
      .from('prodotti')
      .update({ stock })
      .eq('id', id)
      .select('id, nome, prezzo, stock')
      .single();

    if (error) {
      console.error('Errore update stock:', error);
      return sendError(res, 500, 'Errore aggiornamento stock');
    }

    return res.json({
      success: true,
      prodotto: data
    });
  } catch (error) {
    console.error('Errore update stock:', error);
    return sendError(res, 500, 'Errore aggiornamento stock');
  }
});

// =========================
// ADMIN - UPDATE PRODUCT PRICE
// body: { prezzo }
// =========================
app.patch('/api/admin/products/:id/price', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const prezzo = Number(req.body.prezzo);

    if (!isNonNegativeInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID prodotto non valido');
    }

    if (!isNonNegativeNumber(prezzo)) {
      return sendError(res, 400, 'Prezzo non valido');
    }

    const { data: product, error: productError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .eq('id', id)
      .maybeSingle();

    if (productError) {
      console.error('Errore lettura prodotto prezzo:', productError);
      return sendError(res, 500, 'Errore lettura prodotto');
    }

    if (!product) {
      return sendError(res, 404, 'Prodotto non trovato');
    }

    const { data, error } = await supabase
      .from('prodotti')
      .update({ prezzo })
      .eq('id', id)
      .select('id, nome, prezzo, stock')
      .single();

    if (error) {
      console.error('Errore update prezzo:', error);
      return sendError(res, 500, 'Errore aggiornamento prezzo');
    }

    return res.json({
      success: true,
      prodotto: data
    });
  } catch (error) {
    console.error('Errore update price:', error);
    return sendError(res, 500, 'Errore aggiornamento prezzo');
  }
});

// =========================
// ADMIN - DELETE PRODUCT
// =========================
app.delete('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!isNonNegativeInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID prodotto non valido');
    }

    const { data: product, error: productError } = await supabase
      .from('prodotti')
      .select('id, nome, prezzo, stock')
      .eq('id', id)
      .maybeSingle();

    if (productError) {
      console.error('Errore check delete product:', productError);
      return sendError(res, 500, 'Errore verifica prodotto');
    }

    if (!product) {
      return sendError(res, 404, 'Prodotto non trovato');
    }

    const { data, error } = await supabase
      .from('prodotti')
      .delete()
      .eq('id', id)
      .select('id, nome, prezzo, stock');

    if (error) {
      console.error('Errore delete product:', error);
      return sendError(res, 500, 'Errore eliminazione prodotto');
    }

    return res.json({
      success: true,
      deleted: data
    });
  } catch (error) {
    console.error('Errore delete product:', error);
    return sendError(res, 500, 'Errore eliminazione prodotto');
  }
});

// =========================
// ADMIN - DELETE USER
// =========================
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!isNonNegativeInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID utente non valido');
    }

    if (id === req.user.id) {
      return sendError(res, 400, 'Non puoi eliminare te stesso');
    }

    const { data: user, error: userError } = await supabase
      .from('profilo')
      .select('id, username, crediti, role')
      .eq('id', id)
      .maybeSingle();

    if (userError) {
      console.error('Errore check delete user:', userError);
      return sendError(res, 500, 'Errore verifica utente');
    }

    if (!user) {
      return sendError(res, 404, 'Utente non trovato');
    }

    if (user.role === 'admin') {
      return sendError(res, 403, 'Non puoi eliminare un admin');
    }

    const { data, error } = await supabase
      .from('profilo')
      .delete()
      .eq('id', id)
      .select('id, username, crediti, role');

    if (error) {
      console.error('Errore delete user:', error);
      return sendError(res, 500, 'Errore eliminazione utente');
    }

    return res.json({
      success: true,
      deleted: data
    });
  } catch (error) {
    console.error('Errore delete user:', error);
    return sendError(res, 500, 'Errore eliminazione utente');
  }
});

// =========================
// 404 HANDLER
// =========================
app.use((req, res) => {
  return sendError(res, 404, 'Endpoint non trovato');
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`Server acceso sulla porta ${PORT}`);
  console.log(`Ambiente: ${isProduction ? 'production' : 'development'}`);
});