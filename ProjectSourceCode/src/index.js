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

// -------------------------------------  START THE SERVER   ----------------------------------------------
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
