const fetch = require('node-fetch');
require('dotenv').config();

// Nginx Proxy Manager API Configuration
const NPM_API_BASE = process.env.PROXY_URL; // Replace with your NPM API domain
const NPM_AUTH = {
  identity: process.env.PROXY_EMAIL, // Replace with your NPM admin email
  secret: process.env.PROXY_PASSWORD, // Replace with your NPM admin password
};

let jwtToken = null;
var forwardHostname = "192.168.1.245";
var forwardPort = 80;	
var forwardSSLCert = 5;

// Function to authenticate and get a JWT token
async function authenticate() {
  try {
    const response = await fetch(`${NPM_API_BASE}/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(NPM_AUTH),
    });
    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const data = await response.json();
    jwtToken = data.token; // Use data.token to get the JWT
    console.log('Authenticated successfully.');
  } catch (error) {
    console.error('Authentication error:', error.message);
    throw error;
  }
}

// Function to send a PUT request to update a proxy host
async function updateProxyHost(hostID, payload) {
  try {
    // Ensure we are authenticated
    if (!jwtToken) {
      await authenticate();
    }

    const response = await fetch(`${NPM_API_BASE}/nginx/proxy-hosts/${hostID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(
        `Failed to update proxy host: ${response.statusText} - ${JSON.stringify(
          errorDetails
        )}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error updating proxy host ${hostID}:`, error.message);
    throw error;
  }
}

async function updateDomains() {
  try {
    await authenticate();

    const hostID = 10; // Replace with the ID of the proxy host to update
    const payload = {
      domain_names: ['test.poyo.study'],
      forward_scheme: 'http',
      forward_host: forwardHostname,
      forward_port: forwardPort,
      certificate_id: forwardSSLCert, // Assuming no SSL certificate is configured
      ssl_forced: false, // false for no SSL
      hsts_enabled: false,
      hsts_subdomains: false,
      http2_support: true,
      block_exploits: true,
      caching_enabled: false,
      allow_websocket_upgrade: true,
      access_list_id: 0, // Set to the ID of any access list you want to use
      advanced_config: '', // Custom Nginx config if needed
      enabled: true,
      meta: { nginx_online: true, nginx_err: null },
      locations: [], // Empty array instead of null
    };

    const updatedHost = await updateProxyHost(hostID, payload);
    console.log('Proxy host updated successfully:', updatedHost);
  } catch (error) {
    console.error('Error in main:', error);
  }
}

updateDomains();
