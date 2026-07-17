import { describe, it, expect } from 'vitest'
import { fileToBase64 } from '../../../client/src/lib/imageCapture'

describe('fileToBase64', () => {
  it('resolves to the base64-encoded data (without the data: URL prefix) and the file\'s media type', async () => {
    const file = new File(['fake image bytes'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await fileToBase64(file)
    expect(result.mediaType).toBe('image/jpeg')
    expect(result.data).not.toContain('data:')
    expect(result.data.length).toBeGreaterThan(0)
  })
})
