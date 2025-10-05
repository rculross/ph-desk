/**
 * Tests for Bottleneck-based chunk processor
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { 
  createChunkProcessor, 
  processInChunks, 
  processDataTransformation,
  processBatchOperations,
  StreamProcessor 
} from '../chunk-processor'

describe('ChunkProcessor with Bottleneck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processInChunks', () => {
    it('should process items in chunks using Bottleneck', async () => {
      const data = Array.from({ length: 50 }, (_, i) => ({ id: i, value: i * 2 }))
      const processedItems: any[] = []
      
      await processInChunks(
        data,
        (item, index) => {
          processedItems.push({ ...item, processed: true, index })
        },
        {
          concurrency: 2,
          chunkSize: 10,
          useHybridMode: false // Use direct scheduler processing for test
        }
      )

      expect(processedItems).toHaveLength(50)
      expect(processedItems.every(item => item.processed)).toBe(true)
    })

    it('should handle async processors', async () => {
      const data = Array.from({ length: 20 }, (_, i) => ({ id: i }))
      const results: number[] = []
      
      await processInChunks(
        data,
        async (item, index) => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 1))
          results.push(item.id)
        },
        {
          concurrency: 3,
          chunkSize: 5,
          useHybridMode: false
        }
      )

      expect(results).toHaveLength(20)
      // Results should contain all IDs (order may vary due to concurrency)
      expect(results.sort()).toEqual(Array.from({ length: 20 }, (_, i) => i))
    })
  })

  describe('processDataTransformation', () => {
    it('should transform data using Bottleneck', async () => {
      const input = [
        { name: 'john', age: 25 },
        { name: 'jane', age: 30 },
        { name: 'bob', age: 35 }
      ]

      const result = await processDataTransformation(
        input,
        (item, index) => ({
          fullName: item.name.toUpperCase(),
          ageNextYear: item.age + 1,
          index
        }),
        {
          concurrency: 2,
          useHybridMode: false
        }
      )

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        fullName: 'JOHN',
        ageNextYear: 26,
        index: 0
      })
    })

    it('should handle async transformations', async () => {
      const input = [1, 2, 3, 4, 5]

      const result = await processDataTransformation(
        input,
        async (item, index) => {
          await new Promise(resolve => setTimeout(resolve, 1))
          return item * item
        },
        {
          concurrency: 2,
          useHybridMode: false
        }
      )

      expect(result).toEqual([1, 4, 9, 16, 25])
    })
  })

  describe('processBatchOperations', () => {
    it('should process batch operations with retries', async () => {
      const items = ['item1', 'item2', 'item3', 'fail', 'item4']
      let attempts = 0
      
      const result = await processBatchOperations(
        items,
        async (item, index) => {
          attempts++
          if (item === 'fail' && attempts <= 2) {
            throw new Error('Simulated failure')
          }
          return `processed_${item}`
        },
        {
          maxRetries: 2,
          retryDelay: 10,
          continueOnError: true,
          concurrency: 2
        }
      )

      expect(result.results).toHaveLength(5)
      expect(result.errors).toHaveLength(0) // Should succeed on retry
      expect(result.results).toContain('processed_fail')
    })

    it('should collect errors when items permanently fail', async () => {
      const items = ['success', 'fail1', 'fail2']
      
      const result = await processBatchOperations(
        items,
        async (item, index) => {
          if (item.startsWith('fail')) {
            throw new Error(`${item} always fails`)
          }
          return `processed_${item}`
        },
        {
          maxRetries: 1,
          continueOnError: true,
          concurrency: 1
        }
      )

      expect(result.results).toHaveLength(1)
      expect(result.results[0]).toBe('processed_success')
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0]?.item).toBe('fail1')
      expect(result.errors[1]?.item).toBe('fail2')
    })
  })

  describe('StreamProcessor', () => {
    it('should process streaming data', async () => {
      const processor = new StreamProcessor<number>(
        (item, index) => {
          // Process item but don't return value
          const processed = item * 2
          // Store result somewhere or use it
        },
        {
          concurrency: 2
        }
      )

      // Simulate streaming data
      for (let i = 0; i < 10; i++) {
        processor.push(i)
      }

      await processor.flush()

      const stats = processor.getStats()
      expect(stats.processed).toBe(10)
      expect(stats.errors).toBe(0)
    })

    it('should handle batch pushes', async () => {
      const processor = new StreamProcessor<string>(
        (item, index) => {
          // Simple processing
        },
        {
          concurrency: 3
        }
      )

      const batch = ['a', 'b', 'c', 'd', 'e']
      processor.pushBatch(batch)

      await processor.flush()

      const stats = processor.getStats()
      expect(stats.processed).toBe(5)
    })
  })

  describe('createChunkProcessor interface', () => {
    it('should provide proper control methods', () => {
      const data = [1, 2, 3, 4, 5]
      const processor = createChunkProcessor(
        data,
        (item, index) => {},
        { useHybridMode: false }
      )

      expect(typeof processor.start).toBe('function')
      expect(typeof processor.cancel).toBe('function')
      expect(typeof processor.pause).toBe('function')
      expect(typeof processor.resume).toBe('function')
      expect(typeof processor.isProcessing).toBe('function')
      expect(typeof processor.getProgress).toBe('function')
      expect(typeof processor.getQueueStats).toBe('function')
    })

    it('should track progress correctly', () => {
      const data = Array.from({ length: 100 }, (_, i) => i)
      const processor = createChunkProcessor(
        data,
        (item, index) => {},
        { useHybridMode: false }
      )

      const initialProgress = processor.getProgress()
      expect(initialProgress.processed).toBe(0)
      expect(initialProgress.total).toBe(100)
      expect(initialProgress.percentage).toBe(0)
    })
  })
})