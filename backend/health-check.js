#!/usr/bin/env node

/**
 * Simple health check for the backend
 * This checks if the backend can start and if dependencies are available
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkDependencies() {
  console.log('Checking Node.js version...');
  try {
    const { stdout } = await execAsync('node --version');
    console.log(`  ✓ Node.js: ${stdout.trim()}`);
  } catch (error) {
    console.log(`  ✗ Node.js not found: ${error.message}`);
    return false;
  }

  console.log('Checking npm version...');
  try {
    const { stdout } = await execAsync('npm --version');
    console.log(`  ✓ npm: ${stdout.trim()}`);
  } catch (error) {
    console.log(`  ✗ npm not found: ${error.message}`);
    return false;
  }

  return true;
}

async function checkPackageDependencies() {
  console.log('Checking package.json...');
  try {
    const packageJson = await import('./package.json', { with: { type: 'json' } });
    console.log(`  ✓ Package: ${packageJson.default.name} v${packageJson.default.version}`);
    
    // Check critical dependencies
    const criticalDeps = ['express', 'mongoose', 'cors', 'dotenv', 'uuid'];
    const missingDeps = [];
    
    for (const dep of criticalDeps) {
      if (!packageJson.default.dependencies?.[dep]) {
        missingDeps.push(dep);
      }
    }
    
    if (missingDeps.length > 0) {
      console.log(`  ✗ Missing critical dependencies: ${missingDeps.join(', ')}`);
      return false;
    }
    
    console.log(`  ✓ All critical dependencies found`);
    return true;
  } catch (error) {
    console.log(`  ✗ Error reading package.json: ${error.message}`);
    return false;
  }
}

async function checkEnvironmentVariables() {
  console.log('Checking environment variables...');
  
  // These are the required variables for production
  const requiredVars = [
    'STORAGE_MONGODB_URI',
    'JWT_SECRET',
    'FRONTEND_URL'
  ];
  
  const missingVars = [];
  
  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }
  
  if (missingVars.length > 0) {
    console.log(`  ⚠ Missing environment variables: ${missingVars.join(', ')}`);
    console.log('    Note: This is expected in development. Set these in production.');
  } else {
    console.log('  ✓ All required environment variables found');
  }
  
  return missingVars.length === 0;
}

async function runHealthCheck() {
  console.log('=== Backend Health Check ===\n');
  
  const results = [];
  
  results.push(await checkDependencies());
  results.push(await checkPackageDependencies());
  results.push(await checkEnvironmentVariables());
  
  console.log('\n=== Health Check Summary ===');
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('✅ Backend health check PASSED');
    console.log('\nRecommendations:');
    console.log('1. Run "npm run build" in the frontend directory');
    console.log('2. Set production environment variables');
    console.log('3. Test the API endpoints');
    process.exit(0);
  } else {
    console.log('❌ Backend health check FAILED');
    console.log('\nIssues to fix:');
    if (!results[0]) console.log('- Install Node.js and npm');
    if (!results[1]) console.log('- Install missing dependencies: npm install');
    if (!results[2]) console.log('- Set required environment variables (see .env.production.example)');
    process.exit(1);
  }
}

runHealthCheck().catch(error => {
  console.error('Health check failed with error:', error);
  process.exit(1);
});