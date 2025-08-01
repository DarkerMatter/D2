#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# --- FIX: Use a robust method to load environment variables ---
if [ -f .env ]; then
  # This tells the shell to automatically export all variables that are set.
  set -a
  source .env
  # This stops the automatic export.
  set +a
else
  echo "Error: .env file not found. Please create one and fill in your details."
  exit 1
fi

# Check if DOMAIN_NAME is set
if [ -z "${DOMAIN_NAME}" ]; then
  echo "Error: DOMAIN_NAME is not set in the .env file."
  exit 1
fi

# --- Use DOMAIN_NAME and EMAIL from .env file ---
domains=($DOMAIN_NAME)
email=$EMAIL
# -------------------------------------------------

# --- Generate Nginx config from template ---
echo "### Creating Nginx configuration for ${DOMAIN_NAME}..."
mkdir -p ./nginx/conf.d
# Use sed to replace the placeholder with the actual domain name
sed "s/%%DOMAIN_NAME%%/${DOMAIN_NAME}/g" ./nginx/app.conf.template > ./nginx/conf.d/app.conf
echo "### Nginx configuration created."
echo

# --- The rest of the script is now fully automated ---
data_path="./data/certbot"
rsa_key_size=4096
staging=0 # Set to 1 to use the Let's Encrypt staging environment for testing

if [ -d "$data_path" ]; then
  read -p "Existing certificate data found for $domains. Continue and replace it? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
  echo
fi

echo "### Creating dummy certificate for ${DOMAIN_NAME} ..."
path="/etc/letsencrypt/live/${DOMAIN_NAME}"
mkdir -p "$data_path/conf/live/${DOMAIN_NAME}"
docker-compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

echo "### Starting nginx ..."
docker-compose up --force-recreate -d nginx
echo

echo "### Deleting dummy certificate for ${DOMAIN_NAME} ..."
docker-compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/${DOMAIN_NAME} && \
  rm -Rf /etc/letsencrypt/archive/${DOMAIN_NAME} && \
  rm -Rf /etc/letsencrypt/renewal/${DOMAIN_NAME}.conf" certbot
echo

echo "### Requesting Let's Encrypt certificate for ${DOMAIN_NAME} ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

email_arg="--email $email"
if [ -z "$email" ]; then email_arg="--register-unsafely-without-email"; fi

if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### Reloading nginx ..."
docker-compose exec nginx nginx -s reload

echo
echo "### Your stack is now running with a real SSL certificate! ###"