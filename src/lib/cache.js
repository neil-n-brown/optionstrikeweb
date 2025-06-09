import { supabase } from './supabase'

/**
 * Retrieves cached data if it exists and hasn't expired
 * @param {string} cacheKey - Unique identifier for cached data
 * @returns {Object|null} - Cached data or null if not found/expired
 */
export async function getCachedData(cacheKey) {
  try {
    console.log(`Checking cache for key: ${cacheKey}`)
    
    const { data, error } = await supabase
      .from('api_cache')
      .select('data')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle() // Use maybeSingle() instead of single() to handle no results gracefully
    
    if (error) {
      console.warn(`Cache query error for key ${cacheKey}:`, error)
      return null
    }
    
    if (!data) {
      console.log(`No valid cache found for key: ${cacheKey}`)
      return null
    }
    
    console.log(`Cache hit for key: ${cacheKey}`)
    return data.data
    
  } catch (error) {
    console.error('Error retrieving cached data:', error)
    return null
  }
}

/**
 * Stores data in cache with expiration time
 * @param {string} cacheKey - Unique identifier for cached data
 * @param {Object} data - Data to cache
 * @param {number} expirationMinutes - Cache duration in minutes
 */
export async function setCachedData(cacheKey, data, expirationMinutes = 30) {
  try {
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000)
    
    console.log(`Caching data for key: ${cacheKey}, expires: ${expiresAt.toISOString()}`)
    
    // First try to update existing record
    const { data: existingData, error: selectError } = await supabase
      .from('api_cache')
      .select('id')
      .eq('cache_key', cacheKey)
      .maybeSingle()
    
    if (selectError) {
      console.warn(`Error checking existing cache for ${cacheKey}:`, selectError)
    }
    
    let result
    if (existingData) {
      // Update existing record
      result = await supabase
        .from('api_cache')
        .update({
          data: data,
          expires_at: expiresAt.toISOString()
        })
        .eq('cache_key', cacheKey)
    } else {
      // Insert new record
      result = await supabase
        .from('api_cache')
        .insert({
          cache_key: cacheKey,
          data: data,
          expires_at: expiresAt.toISOString()
        })
    }
    
    if (result.error) {
      console.error(`Error caching data for ${cacheKey}:`, result.error)
      
      // If it's an RLS error, provide more specific guidance
      if (result.error.code === '42501') {
        console.error('RLS Policy Error: The api_cache table policies may need to be updated to allow anonymous access')
        console.error('Please run the RLS migration to fix this issue')
      }
      
      return false
    }
    
    console.log(`Successfully cached data for key: ${cacheKey}`)
    return true
    
  } catch (error) {
    console.error('Error caching data:', error)
    
    // Provide helpful error messages for common issues
    if (error.message?.includes('row-level security')) {
      console.error('RLS Error: Please ensure the api_cache table has proper policies for anonymous access')
    }
    
    return false
  }
}

/**
 * Clears expired cache entries
 */
export async function clearExpiredCache() {
  try {
    console.log('Clearing expired cache entries...')
    
    const { error, count } = await supabase
      .from('api_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
    
    if (error) {
      console.error('Error clearing expired cache:', error)
      return false
    }
    
    console.log(`Cleared ${count || 0} expired cache entries`)
    return true
    
  } catch (error) {
    console.error('Error clearing expired cache:', error)
    return false
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats() {
  try {
    const { data: totalCount, error: totalError } = await supabase
      .from('api_cache')
      .select('id', { count: 'exact', head: true })
    
    const { data: expiredCount, error: expiredError } = await supabase
      .from('api_cache')
      .select('id', { count: 'exact', head: true })
      .lt('expires_at', new Date().toISOString())
    
    if (totalError || expiredError) {
      console.warn('Error getting cache stats:', totalError || expiredError)
      return null
    }
    
    return {
      total: totalCount || 0,
      expired: expiredCount || 0,
      active: (totalCount || 0) - (expiredCount || 0)
    }
    
  } catch (error) {
    console.error('Error getting cache statistics:', error)
    return null
  }
}

/**
 * Clear all cache entries (use with caution)
 */
export async function clearAllCache() {
  try {
    console.log('Clearing all cache entries...')
    
    const { error, count } = await supabase
      .from('api_cache')
      .delete()
      .neq('id', 0) // Delete all records
    
    if (error) {
      console.error('Error clearing all cache:', error)
      return false
    }
    
    console.log(`Cleared ${count || 0} cache entries`)
    return true
    
  } catch (error) {
    console.error('Error clearing all cache:', error)
    return false
  }
}