#!/usr/bin/env node

/**
 * Test script to verify admin login functionality
 */

import http from 'http';

const API_BASE_URL = 'https://ai-interview-system-eewl.vercel.app';
const TEST_CREDENTIALS = {
  email: 'admin@gmail.com',
  password: 'admin@123'
};

async function testAdminLogin() {
  console.log('=== Testing Admin Login ===\n');
  console.log(`Testing credentials:`);
  console.log(`  Email: ${TEST_CREDENTIALS.email}`);
  console.log(`  Password: ${TEST_CREDENTIALS.password}\n`);

  return new Promise((resolve) => {
    const postData = JSON.stringify(TEST_CREDENTIALS);
    
    const options = {
      hostname: 'ai-interview-system-eewl.vercel.app',
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Status Message: ${res.statusMessage}`);
      
      // Check for Set-Cookie header
      const cookieHeader = res.headers['set-cookie'];
      if (cookieHeader) {
        console.log(`\n✅ Authentication cookie set successfully`);
        console.log(`   Cookie: ${cookieHeader[0].substring(0, 50)}...`);
      }

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          console.log(`\nResponse Body:`);
          console.log(JSON.stringify(json, null, 2));
          
          if (res.statusCode === 200 && json.user) {
            console.log('\n✅ Admin login test PASSED!');
            console.log(`   User: ${json.user.name} (${json.user.email})`);
            console.log(`   Role: ${json.user.role}`);
            resolve(true);
          } else {
            console.log('\n❌ Admin login test FAILED');
            console.log(`   Error: ${json.message || 'Unknown error'}`);
            resolve(false);
          }
        } catch (error) {
          console.log('\n❌ Failed to parse response:', error.message);
          console.log('Raw response:', responseData.substring(0, 200));
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log('\n❌ Request failed:', error.message);
      console.log('Make sure the backend server is running on port 5000');
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

async function testHealthEndpoint() {
  console.log('\n=== Testing Health Endpoint ===\n');
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'ai-interview-system-eewl.vercel.app',
      port: 443,
      path: '/api/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      console.log(`Status Code: ${res.statusCode}`);
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          if (res.statusCode === 200 && json.success) {
            console.log('✅ Health endpoint is working');
            console.log(`   Message: ${json.message}`);
            resolve(true);
          } else {
            console.log('❌ Health endpoint failed');
            resolve(false);
          }
        } catch (error) {
          console.log('❌ Failed to parse health response');
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Health check request failed:', error.message);
      resolve(false);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Starting admin authentication tests...\n');
  
  const healthPassed = await testHealthEndpoint();
  if (!healthPassed) {
    console.log('\n❌ Server is not responding. Please start the backend server first.');
    console.log('   Command: cd backend && npm run dev');
    process.exit(1);
  }
  
  const loginPassed = await testAdminLogin();
  
  console.log('\n=== Test Summary ===');
  console.log(`Health Check: ${healthPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Admin Login: ${loginPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (loginPassed) {
    console.log('\n✅ Admin authentication is working correctly!');
    console.log('   You can now login to the admin panel with:');
    console.log(`   Email: ${TEST_CREDENTIALS.email}`);
    console.log(`   Password: ${TEST_CREDENTIALS.password}`);
    process.exit(0);
  } else {
    console.log('\n❌ Admin authentication test failed.');
    console.log('   Please check:');
    console.log('   1. Backend server is running');
    console.log('   2. .env file has correct DEMO_ADMIN credentials');
    console.log('   3. MongoDB is connected');
    process.exit(1);
  }
}

runTests().catch(console.error);