#!/bin/bash

# Variables
NGINX_CONF_SRC="./nginx/nginx.conf"
SSL_CERT_SRC="./nginx/ssl/cloudflare-origin.crt"
SSL_KEY_SRC="./nginx/ssl/cloudflare-origin.key"

NGINX_CONF_DEST="/etc/nginx/nginx.conf"
SSL_CERT_DEST="/etc/nginx/ssl/cloudflare-origin.crt"
SSL_KEY_DEST="/etc/nginx/ssl/cloudflare-origin.key"

# Functions
copy_file() {
    local src="$1"
    local dest="$2"
    echo "Copying $src to $dest..."
    sudo cp "$src" "$dest" || { echo "Failed to copy $src to $dest"; exit 1; }
}

set_permissions() {
    local file="$1"
    local perms="$2"
    echo "Setting permissions $perms on $file..."
    sudo chmod "$perms" "$file" || { echo "Failed to set permissions on $file"; exit 1; }
}

reload_nginx() {
    echo "Reloading NGINX..."
    sudo nginx -t || { echo "NGINX configuration test failed"; exit 1; }
    sudo systemctl reload nginx || { echo "Failed to reload NGINX"; exit 1; }
}

# Main Script
echo "Deploying NGINX configuration and SSL certificates..."

# Ensure SSL directory exists
sudo mkdir -p /etc/nginx/ssl

# Copy files
copy_file "$NGINX_CONF_SRC" "$NGINX_CONF_DEST"
copy_file "$SSL_CERT_SRC" "$SSL_CERT_DEST"
copy_file "$SSL_KEY_SRC" "$SSL_KEY_DEST"

# Set permissions
set_permissions "$SSL_KEY_DEST" 600
set_permissions "$SSL_CERT_DEST" 644

# Reload NGINX
reload_nginx

echo "Deployment completed successfully!"
