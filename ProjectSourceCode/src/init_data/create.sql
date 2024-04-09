/*
This is the list of users. Their IDs, emails, and passwords are shared.
I'm gonna assume we're probably gonna copy the registration system from lab 8,
in which case, the password value here is going to be a hash and not a direct copy.
*/
DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(50) NOT NULL,
    password VARCHAR(50) NOT NULL
);

/*
This is just a list of stocks. It has an ID and a ticker symbol.
*/
DROP TABLE IF EXISTS stocks CASCADE;
CREATE TABLE IF NOT EXISTS stocks (
    stock_id SERIAL PRIMARY KEY,
    ticker_symbol VARCHAR(15) NOT NULL
);

/*
This table describes the relationship between users and stocks that they've favorited.
When a user adds a stock to their favorites, a row is added to this list, and vice versa.
*/
DROP TABLE IF EXISTS users_to_favorite_stocks CASCADE;
CREATE TABLE IF NOT EXISTS users_to_favorite_stocks (
    user_id INT NOT NULL,
    stock_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id) REFERENCES stocks (stock_id) ON DELETE CASCADE
);


/*
This table describes the relationship between users and stocks in their portfolio.
When a user adds a stock to their portfolio, that's recorded here.
Multiple shares owned does NOT correspond to multiple rows.
*/
DROP TABLE IF EXISTS users_to_portfolio_stocks CASCADE;
CREATE TABLE IF NOT EXISTS users_to_portfolio_stocks (
    user_id INT NOT NULL,
    stock_id INT NOT NULL,
    shares_owned INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id) REFERENCES stocks (stock_id) ON DELETE CASCADE
);