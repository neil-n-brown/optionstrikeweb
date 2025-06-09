import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // We're using anonymous access
    autoRefreshToken: false
  }
})

// Helper function to check connection and RLS policies
export async function testConnection() {
  try {
    console.log('Testing Supabase connection...')
    
    // Test basic connection with recommendations table
    const { data: recData, error: recError } = await supabase
      .from('recommendations')
      .select('count', { count: 'exact', head: true })
    
    if (recError) {
      console.warn('Recommendations table access error:', recError)
    }
    
    // Test api_cache table access (this is where RLS issues typically occur)
    const { data: cacheData, error: cacheError } = await supabase
      .from('api_cache')
      .select('count', { count: 'exact', head: true })
    
    if (cacheError) {
      console.warn('API cache table access error:', cacheError)
      
      if (cacheError.code === '42501') {
        return {
          status: 'ERROR',
          message: 'RLS policy error on api_cache table. Please run the RLS migration.',
          timestamp: new Date().toISOString(),
          details: {
            error: cacheError,
            suggestion: 'Run the fix_api_cache_rls.sql migration to fix RLS policies'
          }
        }
      }
    }
    
    // Test cache write access
    const testKey = `connection_test_${Date.now()}`
    const { error: writeError } = await supabase
      .from('api_cache')
      .insert({
        cache_key: testKey,
        data: { test: true },
        expires_at: new Date(Date.now() + 60000).toISOString() // 1 minute
      })
    
    if (writeError) {
      console.warn('Cache write test failed:', writeError)
      
      if (writeError.code === '42501') {
        return {
          status: 'ERROR',
          message: 'Cannot write to api_cache table due to RLS policies',
          timestamp: new Date().toISOString(),
          details: {
            error: writeError,
            suggestion: 'Run the fix_api_cache_rls.sql migration to allow anonymous write access'
          }
        }
      }
    } else {
      // Clean up test record
      await supabase
        .from('api_cache')
        .delete()
        .eq('cache_key', testKey)
    }
    
    return { 
      status: 'OK', 
      message: 'Connected to Supabase with proper RLS access',
      timestamp: new Date().toISOString(),
      details: {
        recommendations_accessible: !recError,
        cache_readable: !cacheError,
        cache_writable: !writeError
      }
    }
    
  } catch (error) {
    console.error('Supabase connection error:', error)
    
    return { 
      status: 'ERROR', 
      message: error.message,
      timestamp: new Date().toISOString(),
      details: {
        error: error,
        suggestion: 'Check environment variables and network connection'
      }
    }
  }
}

/**
 * Test RLS policies specifically
 */
export async function testRLSPolicies() {
  try {
    console.log('Testing RLS policies...')
    
    const tests = []
    
    // Test 1: Read from api_cache
    try {
      await supabase.from('api_cache').select('count', { count: 'exact', head: true })
      tests.push({ test: 'api_cache_read', status: 'PASS' })
    } catch (error) {
      tests.push({ test: 'api_cache_read', status: 'FAIL', error: error.message })
    }
    
    // Test 2: Write to api_cache
    const testKey = `rls_test_${Date.now()}`
    try {
      await supabase.from('api_cache').insert({
        cache_key: testKey,
        data: { test: true },
        expires_at: new Date(Date.now() + 60000).toISOString()
      })
      tests.push({ test: 'api_cache_write', status: 'PASS' })
      
      // Clean up
      await supabase.from('api_cache').delete().eq('cache_key', testKey)
    } catch (error) {
      tests.push({ test: 'api_cache_write', status: 'FAIL', error: error.message })
    }
    
    // Test 3: Read from recommendations
    try {
      await supabase.from('recommendations').select('count', { count: 'exact', head: true })
      tests.push({ test: 'recommendations_read', status: 'PASS' })
    } catch (error) {
      tests.push({ test: 'recommendations_read', status: 'FAIL', error: error.message })
    }
    
    const allPassed = tests.every(t => t.status === 'PASS')
    
    return {
      status: allPassed ? 'OK' : 'ERROR',
      message: allPassed ? 'All RLS tests passed' : 'Some RLS tests failed',
      tests: tests,
      timestamp: new Date().toISOString()
    }
    
  } catch (error) {
    return {
      status: 'ERROR',
      message: 'RLS test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}