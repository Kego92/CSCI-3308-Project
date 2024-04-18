// ----------------------------------   DEPENDENCIES  ----------------------------------------------
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const axios = require('axios');
var validator = require('validator');

// -------------------------------------  APP CONFIG   ----------------------------------------------

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials'
});

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/resources'));
// set Session
app.use(session({
  secret: process.env.SESSION_SECRET, 
  saveUninitialized: false,           
  resave: false,                      
  cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'false',
      sameSite: 'lax'
  }
}));

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
  console.log('Session ID:', req.sessionID);
  console.log('Session Data:', req.session.user);
  if (!req.session.user) {
    return res.redirect(`/login?error=${encodeURIComponent('You must be logged in to access this feature')}`);
  }
  next();
};

// ------------------------------------------  ROUTES  --------------------------------------------

app.get('/home', auth, (req, res) => {
  res.render('pages/home', {}, (err, html) => {
    if (err) {
      console.error('Render error:', err);
      return res.send(500, 'An error occurred while rendering the home page.');
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
      return res.send(500, 'An error occurred while rendering the login page.');
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

  const validEmail = validator.isEmail(email); 
  if (!validEmail)
  {
    return res.redirect(`/register?error=${encodeURIComponent('Valid email is required')}`);
  }

  try {
    const user = await db.one(query, values);

    
    if (user && user.password === password) // (user && await bcrypt.compare(password, user.password)) 
    {
      req.session.user = { user_id: user.user_id, email: user.email };
      req.session.save(err => {
      if (err) {
        console.log('Session save error:', err);
      }
        res.redirect('/favorites');
      });
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
      return res.send(500, 'An error occurred while rendering the register page.');
    }
    res.send(html);
  });
});

app.post('/register', async (req, res) => {
  //hash the password using bcrypt library
  const hash = await bcrypt.hash(req.body.password, 10);

  if (!req.body.email && !req.body.password) {
    return res.redirect(`/register?error=${encodeURIComponent('Email and password are required')}`);
  }

  if (!req.body.password) {
    return res.redirect(`/register?error=${encodeURIComponent('Password is required')}`);
  }

  if (!req.body.email)
  {
    return res.redirect(`/register?error=${encodeURIComponent('Email is required')}`);
  }

  const validEmail = validator.isEmail(req.body.email); 
  if (!validEmail)
  {
    return res.redirect(`/register?error=${encodeURIComponent('Valid email is required')}`);
  }

  // To-DO: Insert username and hashed password into the 'users' table
  const query = `insert into users (email, password) values ('${req.body.email}', '${hash}');`;
  
  db.task('get-everything', task => {
    return task.batch([task.any(query)]);
  })

  .then(data => {
    res.redirect('/login');
  })


  .catch(err => {
    res.redirect(`/register?error=${encodeURIComponent('There was an error registering your account')}`);
  })
});

// logout endpoint
app.get('/logout', auth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.send(500, 'Error logging out');
    }
    // Clear client side cookies
    res.clearCookie('connect.sid');
    res.render('pages/logout');
  });
});

app.get('/favorites', auth, async (req, res) => {
  try {
    const query = `
      SELECT stocks.ticker_symbol
      FROM stocks
      JOIN users_to_favorite_stocks ON stocks.stock_id = users_to_favorite_stocks.stock_id
      WHERE users_to_favorite_stocks.user_id = $1;
    `;

    console.log("uid:", req.session.user.user_id);

    const result = await db.query(query, [req.session.user.user_id]);

    console.log("result:", result);

    const favoritesData = result && result.length > 0
      ? result.map(stock => ({
          tickerSymbol: stock.ticker_symbol
        }))
      : [];

    console.log("favdata:",favoritesData);

    res.render('pages/favorites', { favorite: favoritesData });
  } catch (err) {
    console.error('Error fetching favorites:', err);
    res.status(500).send('An error occurred while fetching the favorites.');
  }
});



// GET portfolio
app.get('/portfolio', auth, (req, res) => {
  res.render('pages/portfolio', (err, html) => {
    if (err) {
      console.error('Render error:', err);
      return res.send(500, 'An error occurred while rendering the portfolio page.');
    }
    res.send(html);
  });
});

// GET search
app.get('/search', auth, (req, res) => {
  res.render('pages/search', (err, html) => {
    if (err) {
      console.error('Render error:', err);
      return res.send(500, 'An error occurred while rendering the search page.');
    }
    res.send(html);
  });
});

//This is the post method, which is called when you click the "search" button
//It passes the searched string into a call to the API, which returns a list of stocks and their info
//We then render the page again, passing that info to build cards for each searched stock.
app.post('/search', (req, res) =>{
  //Here's the axios call to the API. This is where we actually get the searched stocks
  axios({
    url: `https://api.polygon.io/v3/reference/tickers`,
    method: 'GET',
    dataType: 'json',
    headers: {
      //This header includes the API key
      //Will it break the minute the code moves setups? Who knows.
      'Authorization': 'Bearer FSgRaU3KnQzDdptepqG3L8Jf_k3jsLzw',
    },
    params: {
      //The search parameter contains the actual text inputted for the search.
      search: req.body.input,
      //The limit parameter is set to 20 so our results aren't a million billion things long
      limit: 20,
    }
  })
    .then(results => {
      //Checking if there are any results to begin with
      if (results.data)
      {
        //I print it out immediately to make things easier to visualize on my end.
        console.log(results.data);
        searched_stock = results.data;
        //Once we have our results, we render the page again while passing the results to search.hbs
        //Within that file, there's a mechanism to build cards from whatever is put in.
        res.render('pages/search', {searched_stock});
      }
      else
      {
        //if an error wasn't returned but there are still no results, we go here.
        //I suppose you could maybe put in a "no results found" thing for this?
        res.render('pages/search');
      }
    })
    .catch(error => {
      //I don't have a rigurous error procedure yet. Once I go back and look at testing stuff I'll see what I can do.
      res.render('pages/search');
    });

});

// Catch-all error endpoint
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.send(500, 'Something went wrong!');
});

// -------------------------------------  START THE SERVER   ----------------------------------------------
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
