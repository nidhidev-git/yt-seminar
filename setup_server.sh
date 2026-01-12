# Server Setup Script (Ubuntu) for HexSeminar
# Installs Node.js, Nginx, Certbot, PM2 and configures Firewall

echo "--- Updating System ---"
sudo apt-get update && sudo apt-get upgrade -y

echo "--- Installing Basic Tools ---"
sudo apt-get install -y curl git unzip build-essential

echo "--- Installing Node.js 22 ---"
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "--- Installing PM2 ---"
sudo npm install -g pm2

echo "--- Installing Nginx & Certbot ---"
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "--- Configuring Firewall (UFW) ---"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# Allow Mediasoup Ports
sudo ufw allow 40000:40100/udp
sudo ufw allow 40000:40100/tcp
sudo ufw --force enable

echo "--- Setup Complete ---"
echo "Node Version: $(node -v)"
echo "NPM Version: $(npm -v)"
echo "PM2 Version: $(pm2 -v)"
