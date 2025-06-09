import { supabase } from './supabase'

/**
 * Retrieves cached data if it exists and hasn't expired
 * @param {string} cacheKey - Unique identifier for cached data
 * @returns {Object|null} - Cached data or null if not found/expired
 */
export async function getCachedData(cacheKey) {
  try {
    console.log(`🔍 CACHE: Checking cache for key: ${cacheKey}`)
    
    const { data, error } = await supabase
      .from('api_cache')
      .select('data')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle() // Use maybeSingle() instead of single() to handle no results gracefully
    
    if (error) {
      console.warn(`⚠️ CACHE: Query error for key ${cacheKey}:`, error)
      return null
    }
    
    if (!data) {
      console.log(`❌ CACHE: No valid cache found for key: ${cacheKey}`)
      return null
    }
    
    console.log(`✅ CACHE: Cache hit for key: ${cacheKey}`, { dataSize: JSON.stringify(data.data).length })
    return data.data
    
  } catch (error) {
    console.error('💥 CACHE: Error retrieving cached data:', error)
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
    
    console.log(`💾 CACHE: Caching data for key: ${cacheKey}`, {
      dataSize: JSON.stringify(data).length,
      expiresAt: expiresAt.toISOString(),
      expirationMinutes
    })
    
    // First try to update existing record
    const { data: existingData, error: selectError } = await supabase
      .from('api_cache')
      .select('id')
      .eq('cache_key', cacheKey)
      .maybeSingle()
    
    if (selectError) {
      console.warn(`⚠️ CACHE: Error checking existing cache for ${cacheKey}:`, selectError)
    }
    
    let result
    if (existingData) {
      console.log(`🔄 CACHE: Updating existing cache record for ${cacheKey}`)
      // Update existing record
      result = await supabase
        .from('api_cache')
        .update({
          data: data,
          expires_at: expiresAt.toISOString()
        })
        .eq('cache_key', cacheKey)
    } else {
      console.log(`➕ CACHE: Creating new cache record for ${cacheKey}`)
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
      console.error(`💥 CACHE: Error caching data for ${cacheKey}:`, result.error)
      
      // If it's an RLS error, provide more specific guidance
      if (result.error.code === '42501') {
        console.error('🔒 CACHE: RLS Policy Error - api_cache table policies may need to be updated')
      }
      
      return false
    }
    
    console.log(`✅ CACHE: Successfully cached data for key: ${cacheKey}`)
    return true
    
  } catch (error) {
    console.error('💥 CACHE: Error caching data:', error)
    return false
  }
}

/**
 * Clears expired cache entries
 */
export async function clearExpiredCache() {
  try {
    console.log('🧹 CACHE: Clearing expired cache entries...')
    
    const currentTime = new Date().toISOString()
    console.log(`🕐 CACHE: Current time: ${currentTime}`)
    
    // First, check how many expired entries exist
    const { data: expiredCheck, error: checkError } = await supabase
      .from('api_cache')
      .select('id, cache_key, expires_at')
      .lt('expires_at', currentTime)
    
    if (checkError) {
      console.error('💥 CACHE: Error checking expired entries:', checkError)
      return false
    }
    
    console.log(`📊 CACHE: Found ${expiredCheck?.length || 0} expired entries to delete`)
    if (expiredCheck && expiredCheck.length > 0) {
      console.log('🗑️ CACHE: Expired entries:', expiredCheck.map(e => ({ key: e.cache_key, expired: e.expires_at })))
    }
    
    const { error, count } = await supabase
      .from('api_cache')
      .delete()
      .lt('expires_at', currentTime)
    
    if (error) {
      console.error('💥 CACHE: Error clearing expired cache:', error)
      return false
    }
    
    console.log(`✅ CACHE: Cleared ${count || 0} expired cache entries`)
    return true
    
  } catch (error) {
    console.error('💥 CACHE: Error clearing expired cache:', error)
    return false
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats() {
  try {
    console.log('📊 CACHE: Getting cache statistics...')
    
    const currentTime = new Date().toISOString()
    
    const { data: totalCount, error: totalError } = await supabase
      .from('api_cache')
      .select('id', { count: 'exact', head: true })
    
    const { data: expiredCount, error: expiredError } = await supabase
      .from('api_cache')
      .select('id', { count: 'exact', head: true })
      .lt('expires_at', currentTime)
    
    if (totalError || expiredError) {
      console.warn('⚠️ CACHE: Error getting cache stats:', totalError || expiredError)
      return null
    }
    
    const stats = {
      total: totalCount || 0,
      expired: expiredCount || 0,
      active: (totalCount || 0) - (expiredCount || 0)
    }
    
    console.log('📊 CACHE: Statistics:', stats)
    return stats
    
  } catch (error) {
    console.error('💥 CACHE: Error getting cache statistics:', error)
    return null
  }
}

/**
 * Clear all cache entries (use with caution)
 */
export async function clearAllCache() {
  try {
    console.log('🧹 CACHE: Starting to clear ALL cache entries...')
    
    // First, get count of all entries
    const { data: allEntries, error: countError } = await supabase
      .from('api_cache')
      .select('id, cache_key, expires_at')
    
    if (countError) {
      console.error('💥 CACHE: Error getting cache entries for clearing:', countError)
      return false
    }
    
    console.log(`📊 CACHE: Found ${allEntries?.length || 0} total cache entries to delete`)
    if (allEntries && allEntries.length > 0) {
      console.log('🗑️ CACHE: All entries to be deleted:', allEntries.map(e => ({ 
        key: e.cache_key, 
        expires: e.expires_at,
        expired: new Date(e.expires_at) < new Date()
      })))
    }
    
    // Delete all records using a condition that matches all records
    const { error, count } = await supabase
      .from('api_cache')
      .delete()
      .gte('id', 0) // This should match all records since id is always >= 0
    
    if (error) {
      console.error('💥 CACHE: Error clearing all cache:', error)
      
      // Try alternative deletion method
      console.log('🔄 CACHE: Trying alternative deletion method...')
      const { error: altError, count: altCount } = await supabase
        .from('api_cache')
        .delete()
        .not('id', 'is', null) // Alternative way to match all records
      
      if (altError) {
        console.error('💥 CACHE: Alternative deletion also failed:', altError)
        return false
      }
      
      console.log(`✅ CACHE: Alternative method cleared ${altCount || 0} cache entries`)
      return true
    }
    
    console.log(`✅ CACHE: Successfully cleared ${count || 0} cache entries`)
    return true
    
  } catch (error) {
    console.error('💥 CACHE: Error clearing all cache:', error)
    return false
  }
}