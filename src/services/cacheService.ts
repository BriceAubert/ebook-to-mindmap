import type { MindElixirData } from 'mind-elixir'

// Define cache key types
export type CacheKeyType =
  // Chapter-level cache
  | 'summary'           // Chapter summary
  | 'mindmap'          // Chapter mind map
  // Book-level cache
  | 'connections'      // Chapter connection analysis
  | 'overall_summary'  // Overall book summary
  | 'combined_mindmap' // Combined book mind map (generated directly from the whole book content)
  | 'merged_mindmap'   // Merged mind map (merged from chapter mind maps)
  | 'mindmap_arrows'   // Mind map arrows

// Define cache value types
export type CacheValue = string | MindElixirData | null

// Define the structure of cache items stored in localStorage
interface CacheItem {
  data: CacheValue
  timestamp: number
}

export class CacheService {
  private cache: Map<string, CacheValue>
  private readonly STORAGE_KEY = 'ebook-processor-cache'
  private readonly MAX_CACHE_SIZE = 999 // Maximum number of cache entries
  private readonly CACHE_EXPIRY = 999 * 24 * 60 * 60 * 1000

  constructor() {
    this.cache = new Map()
    this.loadFromLocalStorage()
  }

  // Load cache from localStorage
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as Record<string, CacheItem>
        const now = Date.now()

  // Filter expired cache items
        Object.entries(data).forEach(([key, value]: [string, CacheItem]) => {
          if (value.timestamp && (now - value.timestamp) < this.CACHE_EXPIRY) {
            this.cache.set(key, value.data)
          }
        })
      }
    } catch (error) {
  console.warn('Failed to load cache:', error)
  // Remove corrupted cache
      localStorage.removeItem(this.STORAGE_KEY)
    }
  }

  // Save cache to localStorage
  private saveToLocalStorage(): void {
    try {
      const data: Record<string, CacheItem> = {}
      const now = Date.now()

      this.cache.forEach((value, key) => {
        data[key] = {
          data: value,
          timestamp: now
        }
      })

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
  console.warn('Failed to save cache:', error)
    }
  }

  // Get cache value of type string
  getString(filename: string, type: CacheKeyType, chapterId?: string): string | null {
    const key = CacheService.generateKey(filename, type, chapterId)
    const value = this.cache.get(key)
    return typeof value === 'string' ? value : null
  }

  // Get cache value of type MindElixirData
  getMindMap(filename: string, type: CacheKeyType, chapterId?: string): MindElixirData | null {
    const key = CacheService.generateKey(filename, type, chapterId)
    const value = this.cache.get(key)
    return value && typeof value === 'object' && 'nodeData' in value ? value as MindElixirData : null
  }

  // Set cache value
  setCache(filename: string, type: CacheKeyType, value: CacheValue, chapterId?: string): void {
    const key = CacheService.generateKey(filename, type, chapterId)

  // If cache is full, delete the oldest entry
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, value)
    this.saveToLocalStorage()
  }

  // Delete cache
  private deleteCache(filename: string, type: CacheKeyType, chapterId?: string): boolean {
    const key = CacheService.generateKey(filename, type, chapterId)
    return this.deleteByKey(key)
  }

  // Delete cache by key
  private deleteByKey(key: string): boolean {
    const result = this.cache.delete(key)
    if (result) {
      this.saveToLocalStorage()
    }
    return result
  }

  // Get cache statistics (used to find related keys when clearing the whole book cache)
  private getStats(): { keys: string[] } {
    return {
      keys: Array.from(this.cache.keys())
    }
  }

  // Unified cache key generation rule
  static generateKey(filename: string, type: CacheKeyType, chapterId?: string): string {
  // Clean filename, remove extension and special characters
    const cleanFilename = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')

    if (chapterId) {
  // Chapter-level cache: book_filename_chapter_chapterId_type
      return `book_${cleanFilename}_chapter_${chapterId}_${type}`
    } else {
  // Book-level cache: book_filename_type
      return `book_${cleanFilename}_${type}`
    }
  }

  // Clear chapter cache
  clearChapterCache(fileName: string, chapterId: string, type: 'summary' | 'mindmap'): boolean {
    const cacheType: CacheKeyType = type
    return this.deleteCache(fileName, cacheType, chapterId)
  }

  // Clear specific type cache
  clearSpecificCache(fileName: string, cacheType: 'connections' | 'overall_summary' | 'combined_mindmap' | 'merged_mindmap'): boolean {
    const type: CacheKeyType = cacheType
    return this.deleteCache(fileName, type)
  }

  // Clear whole book cache
  clearBookCache(fileName: string, processingMode: 'summary' | 'mindmap' | 'combined_mindmap'): number {
    let deletedCount = 0

    if (processingMode === 'summary') {
  // Text summary mode: clear chapter summary, chapter connection, and overall book summary related cache
      if (this.deleteCache(fileName, 'connections')) deletedCount++
      if (this.deleteCache(fileName, 'overall_summary')) deletedCount++

  // Clear all chapter summary cache
      const stats = this.getStats()
      const chapterKeys = stats.keys.filter(key =>
        key.includes(`book_${fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_chapter_`) &&
        key.endsWith('_summary')
      )
      chapterKeys.forEach(key => {
        if (this.deleteByKey(key)) deletedCount++
      })

    } else if (processingMode === 'mindmap') {
  // Chapter mind map mode: clear chapter mind map, mind map arrows, and merged mind map related cache
      if (this.deleteCache(fileName, 'mindmap_arrows')) deletedCount++
      if (this.deleteCache(fileName, 'merged_mindmap')) deletedCount++

  // Clear all chapter mind map cache
      const stats = this.getStats()
      const chapterKeys = stats.keys.filter(key =>
        key.includes(`book_${fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_chapter_`) &&
        key.endsWith('_mindmap')
      )
      chapterKeys.forEach(key => {
        if (this.deleteByKey(key)) deletedCount++
      })

    } else if (processingMode === 'combined_mindmap') {
  // Combined book mind map mode: clear combined book mind map related cache
      if (this.deleteCache(fileName, 'combined_mindmap')) deletedCount++
    }

    return deletedCount
  }
}