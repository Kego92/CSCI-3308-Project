DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE IF NOT EXISTS users {
    user_id SERIAL PRIMARY KEY,
    email NOT NULL VARCHAR(50),
    password NOT NULL VARCHAR(50),
};

DROP TABLE IF EXISTS stocks CASCADE;
CREATE TABLE IF NOT EXISTS stocks {
    stock_id SERIAL PRIMARY KEY,
    ticker_symbol NOT NULL VARCHAR(15),
    shares_owned INT,
};

DROP TABLE IF EXISTS users_to_stocks CASCADE;
CREATE TABLE IF NOT EXISTS users_to_stocks {
    user_id INT NOT NULL,
    stock_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id) REFERENCES stocks (stock_id) ON DELETE CASCADE,
};