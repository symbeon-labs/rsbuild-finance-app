#!/usr/bin/env node
/**
 * Data Intake V1 - Quick API Health Check
 * Tests API endpoints without authentication to verify they're responding
 */

const API_BASE = 'http://localhost:3001';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, url, options = {}) {
  try {
    const response = await fetch(url, options);
    const status = response.status;
    const expected = options.expectedStatus || [200, 400, 401, 403, 404, 405, 500];
    
    if (expected.includes(status)) {
      log('green', `✅ ${name}: ${status}`);
      return true;
    } else {
      log('red', `❌ ${name}: ${status} (unexpected)`);
      return false;
    }
  } catch (error) {
    log('red', `❌ ${name}: ${error.message}`);
    return false;
  }
}

async function runHealthChecks() {
  log('cyan', '╔══════════════════════════════════════════════════════════════╗');
  log('cyan', '║     Data Intake V1 - API Health Check                      ║');
  log('cyan', '╚══════════════════════════════════════════════════════════════╝\n');

  const results = [];

  // Test 1: GET /api/data-intake (should return 401 without auth)
  results.push(await testEndpoint(
    'GET /api/data-intake',
    `${API_BASE}/api/data-intake?organizationId=00000000-0000-0000-0000-000000000000`,
    { method: 'GET', expectedStatus: [401, 400, 403] }
  ));

  // Test 2: POST /api/data-intake/upload-intent (should return 401 without auth)
  results.push(await testEndpoint(
    'POST /api/data-intake/upload-intent',
    `${API_BASE}/api/data-intake/upload-intent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: '00000000-0000-0000-0000-000000000000',
        fileName: 'test.pdf',
        fileSize: 1024,
        documentType: 'financial_support'
      }),
      expectedStatus: [401, 400, 403]
    }
  ));

  // Test 3: POST /api/data-intake/complete (should return 401 without auth)
  results.push(await testEndpoint(
    'POST /api/data-intake/complete',
    `${API_BASE}/api/data-intake/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: '00000000-0000-0000-0000-000000000000',
        fileName: 'test.pdf',
        path: 'test/path',
        documentType: 'financial_support'
      }),
      expectedStatus: [401, 400, 403]
    }
  ));

  // Test 4: GET /api/data-intake/[documentId]/download (should return 401 without auth)
  results.push(await testEndpoint(
    'GET /api/data-intake/[documentId]/download',
    `${API_BASE}/api/data-intake/00000000-0000-0000-0000-000000000000/download`,
    { method: 'GET', expectedStatus: [401, 400, 403, 404] }
  ));

  // Summary
  log('cyan', '\n╔══════════════════════════════════════════════════════════════╗');
  log('cyan', '║                        SUMMARY                               ║');
  log('cyan', '╚══════════════════════════════════════════════════════════════╝');
  
  const passed = results.filter(r => r === true).length;
  const total = results.length;
  
  log('green', `✅ Passed: ${passed}/${total}`);
  
  if (passed === total) {
    log('green', '\n🎉 All API endpoints are responding correctly!');
    log('yellow', '\n📝 Note: These tests verify endpoints exist and return proper auth errors.');
    log('yellow', '   Full functionality testing requires authenticated session.');
  } else {
    log('red', '\n❌ Some endpoints failed health check.');
  }
}

runHealthChecks();
