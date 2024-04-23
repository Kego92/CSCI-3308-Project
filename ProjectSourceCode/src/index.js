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
  partialsDir: __dirname + '/views/partials',
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
app.get('/portfolio', auth, async (req, res) => {
  let v = 20;

  //to start, we'll set up our axis
  //our x axis is time. We'll get today's date, then go back two days at a time 7 times.
  //new Date generates an object with today's date and time

  let today = new Date();
  //today = today.getUTCDate();
  //console.log("THE DATE IS");
  //console.log(today);
  //document.getElementById("demo").innerHTML = today.toUTCString();

  //now we'll make 2 arrays
  //one has the time values, and is passed to the API for data
  //the other has time strings, and is used to label the graph
  let timeValues = [];
  let timeStrings = [];

  for (let i = 0; i < 4; i++)
  {
    let dayOfMonth = today.getDate();
    let exDate = new Date();
    exDate.setDate(dayOfMonth - 4 + i);
    timeValues.push(exDate);
    //this gets a yyyy-mm-dd string, which we need to query the API
    timeStrings.push(exDate.toISOString().split('T')[0]);
  }
  for (let i=0; i < 4; i++)
  {
    console.log(timeStrings[i]);
  }
  //Now we'll assemble the portfolio into 2 arrays, one representing ticker symbols and the other shares owned
  //They're matched by index, so for the table, what you'd probably want to do is to take their sizes from the num_of_results variable
  //And then loop through them in the partial using that value.

  let portTickers = [];
  let portShares = [];

  console.log("user id is ", req.session.user.user_id);
  const result = await db.any(`SELECT ticker_symbol FROM users_to_favorite_stocks
    INNER JOIN stocks ON users_to_favorite_stocks.stock_id = stocks.stock_id WHERE user_id = ${req.session.user.user_id}`);

  console.log("result: ", result);

  let num_of_results = result.length;
  for (let i = 0; i < num_of_results; i++)
  {
    portTickers.push(result[i].ticker_symbol);
    console.log(portTickers[i]);
    portShares.push(1);
  }
  
  //now that we have the contents of the user's portfolio in order, we'll get our data points
  //at each given date in timeValues, we'll query the API for each of our stocks to get the price of that stock at that date
  //Then, we'll multiply the values returned by the shares owned for those stocks and sum them up

  //Because putting everything we need in one API call makes things so complicated, I couldn't handle more than three data points
  //yesterday_sum is for yesterday
  //db_yesterday is day before yesterday (2 days ago)
  //db_db_yesterday is day before day before yesterday (3 days ago)

  let yesterday_sum = 0;
  let db_yesterday_sum = 0;
  let db_db_yesterday_sum = 0;
 
  let tickerConcat = portTickers[0];
  for (let i = 1; i < num_of_results; i++)
  {
    tickerConcat += ','
    tickerConcat += portTickers[i];
  }

  console.log(tickerConcat);
  
  //From this point forwards I'm not gonna lie, I can't explain jack
  //This absolute mess of an API call is how we actually get the data for our graph

  const result_2 = await axios({
      url: `http://api.marketstack.com/v1/eod`,
      method: `GET`,
      dataType: `json`,
      headers: {},
      params: {
      access_key: `33b6822b22ee82763a83ffddb98acaf5`,
      symbols: tickerConcat,
      date_from: timeStrings[1],
      date_to: timeStrings[3],
  }});
  
  let datasize = result_2.data.data.length;
  for (let i = 0; i < datasize; i++)
  {
    tickIndex = i % num_of_results;
    if (result_2.data.data[i].date.split('T')[0] == timeStrings[1])
    {
      db_db_yesterday_sum += portShares[tickIndex] * result_2.data.data[i].close;
      console.log("THIS IS FROM 3 DAYS AGO");
      console.log(`WE HAVE ${portShares[tickIndex]} OF THESE SHARES THAT COSTED ${result_2.data.data[i].close}`);
      console.log(`${portShares[tickIndex] * result_2.data.data[i].close} IS ADDED`);

    }
    else if (result_2.data.data[i].date.split('T')[0] == timeStrings[2])
    {
      db_yesterday_sum += portShares[tickIndex] * result_2.data.data[i].close;
      console.log("THIS IS FROM 2 DAYS AGO");
      console.log(`WE HAVE ${portShares[tickIndex]} OF THESE SHARES THAT COSTED ${result_2.data.data[i].close}`);
      console.log(`${portShares[tickIndex] * result_2.data.data[i].close} IS ADDED`);
    }
    else if (result_2.data.data[i].date.split('T')[0] == timeStrings[3])
    {
      yesterday_sum += portShares[tickIndex] * result_2.data.data[i].close;
      console.log("THIS IS FROM 1 DAY AGO");
      console.log(`WE HAVE ${portShares[tickIndex]} OF THESE SHARES THAT COSTED ${result_2.data.data[i].close}`);
      console.log(`${portShares[tickIndex] * result_2.data.data[i].close} IS ADDED`);
    }
    console.log(result_2.data.data[i]);
  }
  console.log("HERE ARE OUR SUMS");
  console.log(yesterday_sum);
  console.log(db_yesterday_sum);
  console.log(db_db_yesterday_sum);

  res.render('pages/portfolio', {db_db_yesterday_sum, db_yesterday_sum, yesterday_sum}, (err, html) => {
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
