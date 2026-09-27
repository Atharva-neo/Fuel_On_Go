#!/usr/bin/env node

/**
 * Installation Verification Script for Fuel on Go
 * 
 * Run with: node verify-installation.js
 * 
 * This script checks if all prerequisites are installed and configured correctly
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const checks = [];

function log(type, message) {
  const colors = {
    success: '\x1b[32m',
    error: '\x1b[31m',
    info: '\x1b[36m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  const symbol = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${symbol} ${message}`);
}

function checkCommand(command, name) {
  return new Promise(resolve => {
    exec(`${command} --version`, (error, stdout) => {
      if (error) {
        log('error', `${name} not found`);
        checks.push({ name, status: false });
      } else {
        log('success', `${name} is installed`);
        checks.push({ name, status: true });
      }
      resolve();
    });
  });
}

function fileExists(filePath, name) {
  if (fs.existsSync(filePath)) {
    log('success', `${name} exists`);
    checks.push({ name, status: true });
  } else {
    log('warning', `${name} not found`);
    checks.push({ name, status: false });
  }
}

async function verify() {
  console.log('\n🔍 Verifying Fuel on Go Installation...\n');

  // Check Node.js
  await checkCommand('node', 'Node.js');

  // Check npm
  await checkCommand('npm', 'npm');

  // Check project structure
  log('info', 'Checking project structure...');
  fileExists(path.join(__dirname, 'backend/package.json'), 'Backend package.json');
  fileExists(path.join(__dirname, 'frontend/package.json'), 'Frontend package.json');

  // Check backend setup
  log('info', 'Checking backend configuration...');
  fileExists(path.join(__dirname, 'backend/.env'), 'Backend .env');
  fileExists(path.join(__dirname, 'backend/src/index.js'), 'Backend main file');

  // Check frontend setup
  log('info', 'Checking frontend configuration...');
  fileExists(path.join(__dirname, 'frontend/.env.local'), 'Frontend .env.local');
  fileExists(path.join(__dirname, 'frontend/app/page.tsx'), 'Frontend main page');

  // Check node_modules
  log('info', 'Checking dependencies...');
  const backendModules = fs.existsSync(path.join(__dirname, 'backend/node_modules'));
  const frontendModules = fs.existsSync(path.join(__dirname, 'frontend/node_modules'));
  
  if (backendModules) {
    log('success', 'Backend dependencies installed');
    checks.push({ name: 'Backend dependencies', status: true });
  } else {
    log('warning', 'Backend dependencies not installed (run: cd backend && npm install)');
    checks.push({ name: 'Backend dependencies', status: false });
  }

  if (frontendModules) {
    log('success', 'Frontend dependencies installed');
    checks.push({ name: 'Frontend dependencies', status: true });
  } else {
    log('warning', 'Frontend dependencies not installed (run: cd frontend && npm install)');
    checks.push({ name: 'Frontend dependencies', status: false });
  }

  // Summary
  console.log('\n📊 Verification Summary:\n');
  const passed = checks.filter(c => c.status).length;
  const total = checks.length;
  
  checks.forEach(check => {
    const status = check.status ? '✅' : '❌';
    console.log(`${status} ${check.name}`);
  });

  console.log(`\n${passed}/${total} checks passed\n`);

  if (passed === total) {
    log('success', 'All checks passed! Ready to start development.');
    console.log('\n🚀 Next steps:');
    console.log('1. cd backend && npm run dev');
    console.log('2. cd frontend && npm run dev (in another terminal)');
    console.log('3. Open http://localhost:3000\n');
  } else {
    log('warning', 'Some checks failed. Please fix the issues above.');
    console.log('\n📝 Troubleshooting:');
    console.log('- Install Node.js 18+: https://nodejs.org/');
    console.log('- Run: cd backend && npm install');
    console.log('- Run: cd frontend && npm install');
    console.log('- Check .env files exist and are configured\n');
  }

  process.exit(passed === total ? 0 : 1);
}

// Check for MongoDB connection (optional)
function checkMongoDB() {
  exec('mongod --version', (error) => {
    if (error) {
      log('warning', 'MongoDB not found locally (use MongoDB Atlas: https://mongodb.com/cloud/atlas)');
    } else {
      log('success', 'MongoDB is installed');
    }
  });
}

// Run verification
verify().catch(err => {
  log('error', err.message);
  process.exit(1);
});

// Check MongoDB separately
checkMongoDB();
