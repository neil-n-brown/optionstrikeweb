/*
  # Fix RLS policies for api_cache table

  1. Security Changes
    - Drop existing restrictive RLS policies
    - Create new policies allowing anonymous access for caching
    - Enable proper read/write access for the api_cache table

  2. Policy Details
    - Allow anonymous users to read from api_cache (for cache retrieval)
    - Allow anonymous users to insert/update api_cache (for cache storage)
    - Allow authenticated users full access to api_cache
*/

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Authenticated users can manage api_cache" ON api_cache;
DROP POLICY IF EXISTS "Public read access for api_cache" ON api_cache;

-- Create new policies for anonymous access to api_cache
CREATE POLICY "Allow anonymous read access to api_cache"
  ON api_cache
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous write access to api_cache"
  ON api_cache
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to api_cache"
  ON api_cache
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to api_cache"
  ON api_cache
  FOR DELETE
  TO anon
  USING (true);

-- Also allow authenticated users full access
CREATE POLICY "Allow authenticated users full access to api_cache"
  ON api_cache
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;