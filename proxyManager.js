const fetch = require('node-fetch');
require('dotenv').config();

// Nginx Proxy Manager API Configuration
const NPM_API_BASE = process.env.PROXY_URL; // Replace with your NPM API domain
const NPM_AUTH = {
  identity: process.env.PROXY_EMAIL, // Replace with your NPM admin email
  secret: process.env.PROXY_PASSWORD,     // Replace with your NPM admin password
};

let jwtToken = null;

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
    jwtToken = data.token;
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
    	console.log(response);
      throw new Error(`Failed to update proxy host: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Proxy host ${hostID} updated successfully:`, data);
    return data;
  } catch (error) {
    console.error(`Error updating proxy host ${hostID}:`, error.message);
    throw error;
  }
}

// Example usage
(async function main() {
  const hostID = 2; // Replace with the ID of the proxy host to update
  const payload = {
    domain_names: ["1CHl-$_-okWOI-6OxVkoz2hfM[JeP3M3["],
    forward_scheme: "http",
    forward_host: "string",
    forward_port: 1,
    certificate_id: 0,
    ssl_forced: true,
    hsts_enabled: true,
    hsts_subdomains: true,
    http2_support: true,
    block_exploits: true,
    caching_enabled: true,
    allow_websocket_upgrade: true,
    access_list_id: 0,
    advanced_config: "string",
    enabled: true,
    meta: {},
    locations: [
      {
        id: 0,
        path: "string",
        forward_scheme: "http",
        forward_host: "string",
        forward_port: 1,
        forward_path: "string",
        advanced_config: "string",
      },
    ],
  };

  try {
    const result = await updateProxyHost(hostID, payload);
    console.log('Update result:', result);
  } catch (error) {
    console.error('Error in main:', error);
  }
})();
