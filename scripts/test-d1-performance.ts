/**
 * D1 Performance Test Script
 * Tests insertion of 1000 events to verify performance baseline
 * Target: < 100ms for 1000 events
 */

import { EventQueries } from '../src/db/queries';
import { initializeDatabase } from '../src/db/initialize';

interface MockD1Database extends D1Database {}

async function runPerformanceTest() {
  console.log('Starting D1 Performance Test...\n');

  // Mock D1 database (for local testing we'll use wrangler CLI instead)
  console.log('This test must be run via wrangler CLI with actual D1 database');
  console.log('Run the following commands to test performance:\n');

  console.log('1. Generate SQL for 1000 inserts:');
  console.log('   node -e "');
  console.log('   let sql = \"\";');
  console.log('   for(let i = 0; i < 1000; i++) {');
  console.log('     sql += `INSERT INTO events (event_id, payload, status, created_at, updated_at) VALUES (\\'perf-test-\\${i}\\', \\'{\\"test\\":\\"data\\${i}\\"}\\'', \\'pending\\', \\'2025-11-10T\\${String(12+Math.floor(i/60)).padStart(2,\\'0\\')}:\\${String(i%60).padStart(2,\\'0\\')}:00Z\\', \\'2025-11-10T\\${String(12+Math.floor(i/60)).padStart(2,\\'0\\')}:\\${String(i%60).padStart(2,\\'0\\')}:00Z\\');`;');
  console.log('   }');
  console.log('   console.log(sql);');
  console.log('   " > /tmp/insert-1000.sql\n');

  console.log('2. Run performance test:');
  console.log('   time npx wrangler d1 execute triggers-api --file=/tmp/insert-1000.sql\n');

  console.log('3. Verify count:');
  console.log('   npx wrangler d1 execute triggers-api --command="SELECT COUNT(*) as count FROM events;"\n');

  console.log('Expected: Execution time < 100ms for 1000 inserts');
}

runPerformanceTest();
