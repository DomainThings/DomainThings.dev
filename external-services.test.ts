import { describe, test, expect } from 'vitest'

describe('External Services - HTTP and Response Format Tests', () => {
  
  test('Cloudflare DNS - HTTP status and JSON format', async () => {
    const response = await fetch('https://cloudflare-dns.com/dns-query?name=example.com&type=A', {
      headers: {
        'Accept': 'application/dns-json'
      }
    })
    
    // Test HTTP status code
    expect(response.status).toBe(200)
    expect(response.ok).toBe(true)
    
    // Test response format
    const data = await response.json()
    expect(data).toHaveProperty('Status')
    expect(typeof data.Status).toBe('number')
    expect(data).toHaveProperty('Question')
    expect(Array.isArray(data.Question)).toBe(true)
  })

  test('RDAP Bootstrap IANA - HTTP status and structure', async () => {
    const response = await fetch('https://data.iana.org/rdap/dns.json')
    
    // Test HTTP status code
    expect(response.status).toBe(200)
    expect(response.ok).toBe(true)
    
    // Test response structure
    const data = await response.json()
    expect(data).toHaveProperty('services')
    expect(Array.isArray(data.services)).toBe(true)
    expect(data.services.length).toBeGreaterThan(0)
  })

  test('RDAP Service (.com) - Response format', async () => {
    const response = await fetch('https://rdap.verisign.com/com/v1/domain/example.com')
    
    // Test HTTP status code
    expect(response.status).toBe(200)
    expect(response.ok).toBe(true)
    
    // Test required RDAP fields
    const data = await response.json()
    expect(data).toHaveProperty('objectClassName')
    expect(data.objectClassName).toBe('domain')
    expect(data).toHaveProperty('ldhName')
    expect(typeof data.ldhName).toBe('string')
  })

  test('Error handling - Non-existent domain', async () => {
    const response = await fetch('https://cloudflare-dns.com/dns-query?name=non-existent-domain-12345.com&type=A', {
      headers: {
        'Accept': 'application/dns-json'
      }
    })
    
    // Even for non-existent domains, API should respond with 200
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data).toHaveProperty('Status')
    // Status 3 = NXDOMAIN (non-existent domain)
    expect([0, 3]).toContain(data.Status)
  })
})
