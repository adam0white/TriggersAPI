#!/usr/bin/env node

/**
 * Seeds local development KV with test token
 * Run this after starting wrangler dev
 */

const TOKEN = 'sk_test_abc123xyz789';
const KV_KEY = `auth:token:${TOKEN}`;
const KV_VALUE = JSON.stringify({
  valid: true,
  created_at: new Date().toISOString()
});

console.log('🔑 Seeding development KV with test token...');
console.log(`Token: ${TOKEN}`);
console.log(`KV Key: ${KV_KEY}`);

// Make HTTP request to seed via Worker
fetch('http://localhost:8787/__dev__/seed-kv', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: KV_KEY, value: KV_VALUE })
})
.then(res => res.ok ? console.log('✅ Token seeded successfully') : console.error('❌ Failed to seed token'))
.catch(err => console.error('❌ Error:', err.message));
