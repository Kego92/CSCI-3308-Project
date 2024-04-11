// ----------------------------------   DEPENDENCIES  ----------------------------------------------
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');

// -------------------------------------  APP CONFIG   ----------------------------------------------

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
// set Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: true,
  })
);
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// -------------------------------------  DB CONFIG AND CONNECT   ---------------------------------------
const dbConfig = {
  host: 'db',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};
const db = pgp(dbConfig);

// db test
db.connect()
  .then(obj => {
    // Can check the server version here (pg-promise v10.1.0+):
    console.log('Database connection successful');
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR', error.message || error);
  });


// Authentication middleware.
const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect(`/login?error=${encodeURIComponent('You must be logged in to access this feature')}`);
  }
  next();
};

// ------------------------------------------  ROUTES  --------------------------------------------

app.get('/', auth, (req, res) => {
  res.render('pages/home', {}, (err, html) => {
    if (err) {
      console.error('Render error:', err);
      return res.status(500).send('An error occurred while rendering the home page.');
    }
    res.send(html);
  });
});

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

app.get('/login', (req, res) => {
  const errorMessage = req.query.error ? decodeURIComponent(req.query.error) : null;

  res.render('pages/login', { error: errorMessage }, (err, html) => {
    if (err) {
      console.error('Render error:', err);
      return res.status(500).send('An error occurred while rendering the login page.');
    }
    res.send(html);
  });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const query = 'select * from users where users.email = $1 LIMIT 1';
  const values = [email];

  if (!email && !password) {
    return res.redirect(`/login?error=${encodeURIComponent('Email and password are required')}`);
  }

  if (!email) {
    return res.redirect(`/login?error=${encodeURIComponent('Email is required')}`);
  }

  if (!password) {
    return res.redirect(`/login?error=${encodeURIComponent('Password is required')}`);
  }

  try {
    const user = await db.one(query, values);

    if (user && await bcrypt.compare(password, user.password)) {
      req.session.user = { user_id: user.user_id, email: user.email };
      req.session.save();

      res.redirect('/favorites');
    } else {
      return res.redirect(`/login?error=${encodeURIComponent('Password is incorrect')}`);
    }
  } catch (err) {
    return res.redirect(`/login?error=${encodeURIComponent('ERROR: User not found')}`);
  }
});

// GET route for the registration page
app.get('/register', (req, res) => {
  const errorMessage = req.query.error ? decodeURIComponent(req.query.error) : null;

  res.render('pages/register', { error: errorMessage }, (err, html) => {
    if (err) {
      console.error('Render error:', err);
      return res.status(500).send('An error occurred while rendering the register page.');
    }
    res.send(html);
  });
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email && !password) {
    console.error('Error: Email and password are required');
    return res.redirect(`/login?error=${encodeURIComponent('Email and password are required')}`);
  }

  if (!email) {
    console.error('Error: Email is required');
    return res.redirect(`/register?error=${encodeURIComponent('Email is required')}`);
  }

  if (!password) {
    console.error('Error: Password is required');
    return res.redirect(`/register?error=${encodeURIComponent('Password is required')}`);
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = await db.one(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
      [email, hashedPassword]
    );
    res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);
    return res.redirect(`/register?error=${encodeURIComponent('There was an issue registering your account')}`);
  }
});

// logout endpoint
app.get('/logout', auth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).send('Error logging out');
    }
    // Clear client side cookies
    res.clearCookie('connect.sid');
    res.render('pages/logout');
  });
});

// GET favorites
app.get('/favorites', auth, (req, res) => {
  res.render('pages/favorites', (err, html) => {
    if (err) {
      console.error('Render error:', err);
      return res.status(500).send('An error occurred while rendering the favorites page.');
    }
    res.send(html);
  });
});

// GET portfolio
app.get('/portfolio', auth, (req, res) => {
  res.render('pages/portfolio', (err, html) => {
    if (err) {
      console.error('Render error:', err);
      return res.status(500).send('An error occurred while rendering the portfolio page.');
    }
    res.send(html);
  });
});

// GET search
app.get('/search', auth, (req, res) => {
  res.render('pages/search', (err, html) => {
    if (err) {
      console.error('Render error:', err);
      return res.status(500).send('An error occurred while rendering the search page.');
    }
    res.send(html);
  });
});

// Catch-all error endpoint
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// -------------------------------------  START THE SERVER   ----------------------------------------------
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
