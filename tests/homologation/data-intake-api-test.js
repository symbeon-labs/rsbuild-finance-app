#!/usr/bin/env node
/**
 * Data Intake V1 - Automated API Homologation Tests
 * 
 * Usage:
 *   node tests/homologation/data-intake-api-test.js
 * 
 * Requires:
 *   - SUPABASE_URL env var
 *   - SUPABASE_ANON_KEY env var
 *   - TEST_USER_EMAIL env var
 *   - TEST_USER_PASSWORD env var
 *   - TEST_ORG_ID env var (UUID of test organization)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || '';
const TEST_ORG_ID = process.env.TEST_ORG_ID || '';
const API_BASE = 'http://localhost:3001';

// Test files
const TEST_FILES = {
  pdf: path.join(__dirname, '../../INSUMOS_FINANCAS_RECONCILIACAO/4. Outros documentos/categoriasemuso_303631.pdf'),
  xlsx: path.join(__dirname, '../../INSUMOS_FINANCAS_RECONCILIACAO/2. Contas a pagar/CONTAS A PAGAR PAGOS.xlsx'),
  ofx: path.join(__dirname, '../../INSUMOS_FINANCAS_RECONCILIACAO/1. Extratos bancários/ITAU Extrato_7421_996567_17-11-2026.ofx')
};

// Colors for console output
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

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  log(color, `${icon} ${name}${details ? `: ${details}` : ''}`);
}

async function signIn(supabase) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });
  if (error) throw new Error(`Auth failed: ${error.message}`);
  return data.session;
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': options.cookie || '',
      ...options.headers
    }
  });
  return response;
}

async function testListDocuments(session) {
  log('blue', '\n📋 Test 1.1: List documents');
  const response = await apiRequest(`/api/data-intake?organizationId=${TEST_ORG_ID}`, {
    method: 'GET',
    cookie: `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`
  });
  
  if (response.status === 200) {
    const data = await response.json();
    logTest('List documents', 'PASS', `Found ${data.documents?.length || 0} documents`);
    return true;
  } else {
    const error = await response.text();
    logTest('List documents', 'FAIL', `Status ${response.status}: ${error}`);
    return false;
  }
}

async function testUploadIntent(session, fileName, fileSize, documentType = 'financial_support') {
  log('blue', `\n📤 Test 1.2: Upload intent for ${fileName}`);
  const response = await apiRequest('/api/data-intake/upload-intent', {
    method: 'POST',
    cookie: `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`,
    body: JSON.stringify({
      organizationId: TEST_ORG_ID,
      fileName,
      fileSize,
      documentType,
      description: `Test upload ${fileName}`
    })
  });

  if (response.status === 201) {
    const data = await response.json();
    logTest('Upload intent', 'PASS', `Path: ${data.path}`);
    return data;
  } else {
    const error = await response.json();
    logTest('Upload intent', 'FAIL', `Status ${response.status}: ${error.error}`);
    return null;
  }
}

async function testCompleteUpload(session, fileName, storagePath, documentType = 'financial_support') {
  log('blue', `\n✅ Test 1.3: Complete upload for ${fileName}`);
  const response = await apiRequest('/api/data-intake/complete', {
    method: 'POST',
    cookie: `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`,
    body: JSON.stringify({
      organizationId: TEST_ORG_ID,
      fileName,
      path: storagePath,
      documentType,
      description: `Test upload ${fileName}`
    })
  });

  if (response.status === 201) {
    const data = await response.json();
    logTest('Complete upload', 'PASS', `Document ID: ${data.document.id}`);
    return data.document;
  } else {
    const error = await response.json();
    logTest('Complete upload', 'FAIL', `Status ${response.status}: ${error.error}`);
    return null;
  }
}

async function testDownloadDocument(session, documentId) {
  log('blue', `\n⬇️  Test 1.4: Download document ${documentId}`);
  const response = await apiRequest(`/api/data-intake/${documentId}/download`, {
    method: 'GET',
    cookie: `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`
  });

  if (response.status === 200) {
    logTest('Download document', 'PASS', 'File downloaded successfully');
    return true;
  } else {
    const error = await response.text();
    logTest('Download document', 'FAIL', `Status ${response.status}: ${error}`);
    return false;
  }
}

async function testFileTooLarge(session) {
  log('blue', '\n📏 Test 2.1: File too large (>20MB)');
  const largeSize = 21 * 1024 * 1024; // 21MB
  const response = await apiRequest('/api/data-intake/upload-intent', {
    method: 'POST',
    cookie: `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`,
    body: JSON.stringify({
      organizationId: TEST_ORG_ID,
      fileName: 'large-file.pdf',
      fileSize: largeSize,
      documentType: 'financial_support'
    })
  });

  if (response.status === 413) {
    const error = await response.json();
    logTest('File too large', 'PASS', `Error: ${error.error}`);
    return true;
  } else {
    logTest('File too large', 'FAIL', `Expected 413, got ${response.status}`);
    return false;
  }
}

async function testInvalidFileType(session) {
  log('blue', '\n🚫 Test 2.2: Invalid file type (.exe)');
  const response = await apiRequest('/api/data-intake/upload-intent', {
    method: 'POST',
    cookie: `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`,
    body: JSON.stringify({
      organizationId: TEST_ORG_ID,
      fileName: 'malware.exe',
      fileSize: 1024,
      documentType: 'financial_support'
    })
  });

  if (response.status === 415) {
    const error = await response.json();
    logTest('Invalid file type', 'PASS', `Error: ${error.error}`);
    return true;
  } else {
    logTest('Invalid file type', 'FAIL', `Expected 415, got ${response.status}`);
    return false;
  }
}

async function testCrossOrgAccess(session) {
  log('blue', '\n🔒 Test 2.5: Cross-organization access');
  const fakeOrgId = '00000000-0000-0000-0000-000000000000';
  const response = await apiRequest(`/api/data-intake?organizationId=${fakeOrgId}`, {
    method: 'GET',
    cookie: `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`
  });

  if (response.status === 403 || response.status === 400) {
    logTest('Cross-org access', 'PASS', `Denied with status ${response.status}`);
    return true;
  } else {
    logTest('Cross-org access', 'FAIL', `Expected 403/400, got ${response.status}`);
    return false;
  }
}

async function runTests() {
  log('cyan', '╔══════════════════════════════════════════════════════════════╗');
  log('cyan', '║     Data Intake V1 - Automated Homologation Tests          ║');
  log('cyan', '╚══════════════════════════════════════════════════════════════╝\n');

  // Validate environment
  if (!SUPABASE_ANON_KEY || !TEST_USER_EMAIL || !TEST_USER_PASSWORD || !TEST_ORG_ID) {
    log('red', '❌ Missing required environment variables:');
    log('yellow', '   SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_ORG_ID');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  try {
    // Sign in
    log('blue', '🔐 Authenticating...');
    const session = await signIn(supabase);
    log('green', '✅ Authentication successful\n');

    // Run tests
    const results = [];
    
    // Phase 1: Basic API tests
    results.push(await testListDocuments(session));
    
    // Test upload intent with real file
    if (fs.existsSync(TEST_FILES.pdf)) {
      const pdfStats = fs.statSync(TEST_FILES.pdf);
      const intent = await testUploadIntent(session, 'categoriasemuso_303631.pdf', pdfStats.size, 'financial_support');
      
      if (intent) {
        // Note: In real test, we'd need to upload the file to storage first
        // For now, we test the intent creation only
        log('yellow', '   ⚠️  Skipping complete upload (requires actual file upload to storage)');
      }
    } else {
      log('yellow', '⚠️  Test PDF file not found, skipping upload tests');
    }
    
    // Phase 2: Validation tests
    results.push(await testFileTooLarge(session));
    results.push(await testInvalidFileType(session));
    results.push(await testCrossOrgAccess(session));

    // Summary
    log('cyan', '\n╔══════════════════════════════════════════════════════════════╗');
    log('cyan', '║                        SUMMARY                               ║');
    log('cyan', '╚══════════════════════════════════════════════════════════════╝');
    
    const passed = results.filter(r => r === true).length;
    const failed = results.filter(r => r === false).length;
    const total = results.length;
    
    log('green', `✅ Passed: ${passed}/${total}`);
    if (failed > 0) log('red', `❌ Failed: ${failed}/${total}`);
    
    if (failed === 0) {
      log('green', '\n🎉 All automated tests passed!');
    } else {
      log('yellow', '\n⚠️  Some tests failed. Review the output above.');
    }

  } catch (error) {
    log('red', `\n❌ Test execution failed: ${error.message}`);
    process.exit(1);
  }
}

runTests();
