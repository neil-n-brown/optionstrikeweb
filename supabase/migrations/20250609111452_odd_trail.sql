/*
  # OptionStrike Database Schema

  1. New Tables
    - `earnings_calendar` - Stores earnings announcement data for stocks
      - `id` (serial, primary key)
      - `symbol` (varchar, stock ticker)
      - `earnings_date` (date, announcement date)
      - `estimated_eps` (decimal, estimated earnings per share)
      - `eps_growth` (decimal, earnings growth percentage)
      - `market_cap` (bigint, market capitalization)
      - `created_at`, `updated_at` (timestamps)

    - `options_data` - Stores options chain information
      - `id` (serial, primary key)
      - `symbol` (varchar, stock ticker)
      - `strike_price` (decimal, option strike price)
      - `expiration_date` (date, option expiration)
      - `option_type` (varchar, put/call)
      - `premium`, `delta`, `implied_volatility` (decimal, option metrics)
      - `volume`, `open_interest` (integer, trading metrics)
      - `bid`, `ask`, `stock_price` (decimal, pricing data)
      - `created_at`, `updated_at` (timestamps)

    - `recommendations` - Stores processed trading recommendations
      - `id` (serial, primary key)
      - `symbol` (varchar, stock ticker)
      - `strike_price` (decimal, recommended strike)
      - `expiration_date` (date, option expiration)
      - `premium` (decimal, option premium)
      - `confidence_score` (decimal, calculated confidence rating)
      - `pop` (decimal, probability of profit)
      - `delta`, `implied_volatility` (decimal, option greeks)
      - `premium_percentage` (decimal, premium as % of stock price)
      - `max_loss`, `breakeven` (decimal, risk metrics)
      - `earnings_date` (date, related earnings announcement)
      - `created_at` (timestamp)
      - `is_active` (boolean, recommendation status)

    - `api_cache` - Caches API responses to reduce external calls
      - `id` (serial, primary key)
      - `cache_key` (varchar, unique cache identifier)
      - `data` (jsonb, cached response data)
      - `expires_at` (timestamp, cache expiration)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their data
    - Public read access for recommendations (display purposes)

  3. Indexes
    - Performance indexes on frequently queried columns
    - Unique constraints where appropriate
*/

-- Create earnings_calendar table
CREATE TABLE IF NOT EXISTS earnings_calendar (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  earnings_date DATE NOT NULL,
  estimated_eps DECIMAL(10,4) DEFAULT 0,
  eps_growth DECIMAL(8,2) DEFAULT 0,
  market_cap BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create options_data table
CREATE TABLE IF NOT EXISTS options_data (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  strike_price DECIMAL(10,2) NOT NULL,
  expiration_date DATE NOT NULL,
  option_type VARCHAR(4) DEFAULT 'put',
  premium DECIMAL(8,2) DEFAULT 0,
  delta DECIMAL(6,4) DEFAULT 0,
  implied_volatility DECIMAL(6,4) DEFAULT 0,
  volume INTEGER DEFAULT 0,
  open_interest INTEGER DEFAULT 0,
  bid DECIMAL(8,2) DEFAULT 0,
  ask DECIMAL(8,2) DEFAULT 0,
  stock_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  strike_price DECIMAL(10,2) NOT NULL,
  expiration_date DATE NOT NULL,
  premium DECIMAL(8,2) DEFAULT 0,
  confidence_score DECIMAL(5,2) DEFAULT 0,
  pop DECIMAL(5,2) DEFAULT 0,
  delta DECIMAL(6,4) DEFAULT 0,
  implied_volatility DECIMAL(6,4) DEFAULT 0,
  premium_percentage DECIMAL(5,2) DEFAULT 0,
  max_loss DECIMAL(10,2) DEFAULT 0,
  breakeven DECIMAL(10,2) DEFAULT 0,
  earnings_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create api_cache table
CREATE TABLE IF NOT EXISTS api_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE earnings_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE options_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for earnings_calendar
CREATE POLICY "Public read access for earnings_calendar"
  ON earnings_calendar
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage earnings_calendar"
  ON earnings_calendar
  FOR ALL
  TO authenticated
  USING (true);

-- Create RLS policies for options_data
CREATE POLICY "Public read access for options_data"
  ON options_data
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage options_data"
  ON options_data
  FOR ALL
  TO authenticated
  USING (true);

-- Create RLS policies for recommendations
CREATE POLICY "Public read access for recommendations"
  ON recommendations
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage recommendations"
  ON recommendations
  FOR ALL
  TO authenticated
  USING (true);

-- Create RLS policies for api_cache
CREATE POLICY "Public read access for api_cache"
  ON api_cache
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage api_cache"
  ON api_cache
  FOR ALL
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_symbol ON earnings_calendar(symbol);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_date ON earnings_calendar(earnings_date);
CREATE INDEX IF NOT EXISTS idx_options_data_symbol ON options_data(symbol);
CREATE INDEX IF NOT EXISTS idx_options_data_expiration ON options_data(expiration_date);
CREATE INDEX IF NOT EXISTS idx_recommendations_symbol ON recommendations(symbol);
CREATE INDEX IF NOT EXISTS idx_recommendations_confidence ON recommendations(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_active ON recommendations(is_active);
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);