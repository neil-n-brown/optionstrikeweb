import { supabase } from './supabase'

/**
 * Retrieves cached data if it exists and hasn't expired
 * @param {string} cacheKey - Unique identifier for cached data
 * @returns {Object|null} - Cached data or null if not found/expired
 */
export async function getCachedData(cacheKey) {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('data')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single()
    
    if (error) {
      console.log(`No valid cache found for key: ${cacheKey}`)
      return null
    }
    
    console.log(`Cache hit for key: ${cacheKey}`)
    return data?.data
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
    
    const { error } = await supabase
      .from('api_cache')
      .upsert({
        cache_key: cacheKey,
        data: data,
        expires_at: expiresAt.toISOString()
      })
    
    if (error) throw error
    
    console.log(`Data cached for key: ${cacheKey}, expires: ${expiresAt.toISOString()}`)
  } catch (error) {
    console.error('Error caching data:', error)
  }
}

/**
 * Clears expired cache entries
 */
export async function clearExpiredCache() {
  try {
    const { error } = await supabase
      .from('api_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
    
    if (error) throw error
    
    console.log('Expired cache entries cleared')
  } catch (error) {
    console.error('Error clearing expired cache:', error)
  }
}