import http from 'http';
import https from 'https';
import { parse } from 'url';

/**
 * Simple API connectivity test for production environment
 * This checks if the backend API endpoints are reachable
 */

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function testEndpoint(endpoint, method = 'GET', data = null) {
  return new Promise((resolve) => {
    const url = parse(`${API_BASE_URL}${endpoint}`);
    
    const isHttps = url.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = requestModule.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({
            endpoint,
            status: res.statusCode,
            success: res.statusCode >= 200 && res.statusCode < 300,
            data: json,
          });
        } catch (error) {
          resolve({
            endpoint,
            status: res.statusCode,
            success: false,
            error: 'Invalid JSON response',
            raw: responseData.substring(0, 100),
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        endpoint,
        status: 0,
        success: false,
        error: error.message,
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        endpoint,
        status: 0,
        success: false,
        error: 'Request timeout',
      });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runConnectivityTests() {
  console.log('=== API Connectivity Tests ===');
  console.log(`Testing API at: ${API_BASE_URL}`);
  console.log('');

  const tests = [
    { endpoint: '/', method: 'GET', description: 'Root endpoint' },
    { endpoint: '/api/health', method: 'GET', description: 'Health check' },
    { endpoint: '/api/interviews/slots', method: 'GET', description: 'Enhanced slots endpoint' },
  ];

  const results = [];

  for (const test of tests) {
    console.log(`Testing: ${test.description} (${test.endpoint})`);
    const result = await testEndpoint(test.endpoint, test.method);
    results.push(result);
    
    if (result.success) {
      console.log(`  ✓ Success (Status: ${result.status})`);
    } else {
      console.log(`  ✗ Failed (Status: ${result.status}, Error: ${result.error || 'Unknown error'})`);
    }
    console.log('');
  }

  console.log('=== Test Summary ===');
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\nFailed endpoints:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.endpoint}: ${r.error || 'Unknown error'}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runConnectivityTests().catch(console.error);
}

export { testEndpoint, runConnectivityTests };