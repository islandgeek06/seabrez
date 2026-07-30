import { describe, it, expect } from 'vitest'
import { isProbablyUrl, resolveOmniboxInput, safeOrigin } from '../shared/url'

describe('isProbablyUrl', () => {
  it('recognizes schemes and hosts', () => {
    expect(isProbablyUrl('https://example.com')).toBe(true)
    expect(isProbablyUrl('example.com')).toBe(true)
    expect(isProbablyUrl('sub.example.co.uk/path')).toBe(true)
    expect(isProbablyUrl('localhost:3000')).toBe(true)
    expect(isProbablyUrl('intelleson://newtab')).toBe(true)
  })
  it('rejects search queries', () => {
    expect(isProbablyUrl('how to make pasta')).toBe(false)
    expect(isProbablyUrl('react hooks')).toBe(false)
    expect(isProbablyUrl('just text')).toBe(false)
    expect(isProbablyUrl('')).toBe(false)
  })
})

describe('resolveOmniboxInput', () => {
  it('passes through full URLs', () => {
    expect(resolveOmniboxInput('https://a.com', 'google')).toBe('https://a.com')
  })
  it('adds https to bare hosts', () => {
    expect(resolveOmniboxInput('example.com', 'google')).toBe('https://example.com')
  })
  it('searches non-URL text with the chosen engine', () => {
    expect(resolveOmniboxInput('hello world', 'google')).toBe(
      'https://www.google.com/search?q=hello%20world',
    )
    expect(resolveOmniboxInput('hello', 'duckduckgo')).toBe('https://duckduckgo.com/?q=hello')
    expect(resolveOmniboxInput('hi', 'brave')).toBe('https://search.brave.com/search?q=hi')
  })
  it('handles empty input', () => {
    expect(resolveOmniboxInput('   ', 'google')).toBe('about:blank')
  })
  it('turns Windows file paths (even with spaces) into file:// URLs', () => {
    expect(resolveOmniboxInput('C:\\Users\\Island Boss\\index.html', 'google')).toBe(
      'file:///C:/Users/Island%20Boss/index.html',
    )
    expect(resolveOmniboxInput('C:/Users/x/site/index.html', 'google')).toBe(
      'file:///C:/Users/x/site/index.html',
    )
  })
  it('passes file:// URLs through (encoded)', () => {
    expect(resolveOmniboxInput('file:///C:/a b/index.html', 'google')).toBe(
      'file:///C:/a%20b/index.html',
    )
  })
})

describe('isProbablyUrl — local paths', () => {
  it('treats file paths as navigable, not searches', () => {
    expect(isProbablyUrl('C:\\Users\\Island Boss\\index.html')).toBe(true)
    expect(isProbablyUrl('C:/Users/x/index.html')).toBe(true)
    expect(isProbablyUrl('file:///C:/x/index.html')).toBe(true)
    expect(isProbablyUrl('/home/user/page.html')).toBe(true)
  })
})

describe('safeOrigin', () => {
  it('extracts origin', () => {
    expect(safeOrigin('https://a.com/x?y=1')).toBe('https://a.com')
  })
  it('returns empty on garbage', () => {
    expect(safeOrigin('not a url')).toBe('')
  })
})
