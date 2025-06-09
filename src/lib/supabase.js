import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Helper function to check connection
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('recommendations')
      .select('count', { count: 'exact', head: true })
    
    if (error) throw error
    
    return { 
      status: 'OK', 
      message: 'Connected to Supabase',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Supabase connection error:', error)
    return { 
      status: 'ERROR', 
      message: error.message,
      timestamp: new Date().toISOString()
    }
  }
}