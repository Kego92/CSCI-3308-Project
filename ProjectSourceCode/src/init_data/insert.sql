
INSERT INTO users (email, password) VALUES ('1@1.com', 'pass');

INSERT INTO stocks (ticker_symbol) VALUES
('AAPL'),   
('GOOGL'),  
('MSFT'),   
('AMZN'),   
('TSLA'),   
('FB'),     
('NFLX'),   
('INTC'),   
('AMD'),    
('NVDA');   

INSERT INTO users_to_favorite_stocks (user_id, stock_id)
VALUES 
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), 
(1, 6), (1, 7), (1, 8), (1, 9), (1, 10);

INSERT INTO users_to_portfolio_stocks (user_id, stock_ticker, shares_owned)
VALUES
(1, 'AAPL', 1), (1, 'GOOGL', 2);
