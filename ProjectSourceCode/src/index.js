// ----------------------------------   DEPENDENCIES  ----------------------------------------------
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
//I've added in axios here to make my API call
const axios = require('axios');
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

// ------------------------------------------  ROUTES  --------------------------------------------

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

app.get('/login', (req, res) => {
  res.render('pages/login',{});
});

app.post('/login', (req, res) => {
  const email = req.body.email;
  const query = 'select * from users where users.email = $1 LIMIT 1';
  const values = [email];

  // get the user_id based on the emailid
  db.one(query, values)
    .then(data => {
      user.user_id = data.user_id;
      user.email = data.email;

      req.session.user = user;
      req.session.save();

      res.redirect('/');
    })
    .catch(err => {
      console.log(err);
      res.redirect('/login');
    });
});

// logout endpoint
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('pages/logout');
});


//This is the get endpoint for search. All it does is render the website by itself
//Any actual search functionality will be relegated to 
app.get('/search', (req, res) => {
  res.render('pages/search');
})

//This is the post method, which is called when you click the "search" button
//It passes the searched string into a call to the API, which returns a list of stocks and their info
//We then render the page again, passing that info to build cards for each searched stock.
app.post('/search', (req, res) =>{
  var searched_stock = [0, 1, 2];
  //Here's the 
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
      search: req.body.input,
      limit: 20,
    }
  })
    .then(results => {
      console.log(results.data); // the results will be displayed on the terminal if the docker containers are running // Send some parameters
      searched_stock = results.data;
      res.render('pages/search', {searched_stock});
    })
    .catch(error => {
      res.render('pages/search');
    });

});

// -------------------------------------  START THE SERVER   ----------------------------------------------
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
