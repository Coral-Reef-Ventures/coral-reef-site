#!/bin/sh
# Gives dev's or staging's door and Driftline site addresses of their own: dev.coralreefventures.com and
# dev.driftline.app, or staging's. Each name goes on that environment's Amplify app, in its own account, and its
# records go in the domain's zone, which is prod's. Run once per environment by the product owner, signed in to the
# accounts (`aws sso login --sso-session crv`): agents never change the dev, staging or prod accounts (CLAUDE.md).
# README.md, "Each environment's address", says when.
#
#   apps/web/hosting/claim-env-domains.sh dev
set -eu

env=${1:-}
case "$env" in
  dev) driftline=d1w6lg1l5ckq66 ;;
  staging) driftline=d26r6p2ps7cfly ;;
  *) echo "usage: $0 dev|staging" >&2; exit 2 ;;
esac
here=$(cd "$(dirname "$0")" && pwd)
door=$(node --input-type=module -e "
  const { environments } = await import('$here/environments.ts');
  console.log(environments['$env'].appId);
")
export AWS_REGION=us-east-2

# Upserts one record from Amplify's "<name> CNAME <value>" form into the domain's zone in prod. A name without a
# trailing dot is relative to the domain.
upsert() {
  domain=$1 record=$2
  name=$(echo "$record" | awk '{print $1}')
  value=$(echo "$record" | awk '{print $3}')
  case "$name" in
    *.) ;;
    "") name="$domain." ;;
    *) name="$name.$domain." ;;
  esac
  zone=$(AWS_PROFILE=crv-prod aws route53 list-hosted-zones-by-name --dns-name "$domain." --max-items 1 \
    --query "HostedZones[?Name=='$domain.'].Id | [0]" --output text)
  echo "  $name CNAME $value"
  AWS_PROFILE=crv-prod aws route53 change-resource-record-sets --hosted-zone-id "$zone" --change-batch "{\"Changes\":[{
    \"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$name\",\"Type\":\"CNAME\",\"TTL\":300,
    \"ResourceRecords\":[{\"Value\":\"$value\"}]}}]}" > /dev/null
}

# Adds `<env>.<domain>` to an app and writes the records Amplify asks for, then waits for it.
claim() {
  app=$1 domain=$2
  export AWS_PROFILE="crv-$env"
  echo "$env.$domain on $app"
  if ! aws amplify get-domain-association --app-id "$app" --domain-name "$domain" > /dev/null 2>&1; then
    aws amplify create-domain-association --app-id "$app" --domain-name "$domain" \
      --sub-domain-settings "prefix=$env,branchName=main" > /dev/null
  fi
  written=""
  while :; do
    association=$(aws amplify get-domain-association --app-id "$app" --domain-name "$domain" --output json)
    status=$(echo "$association" | jq -r .domainAssociation.domainStatus)
    for record in "$(echo "$association" | jq -r '.domainAssociation.certificate.certificateVerificationDNSRecord // .domainAssociation.certificateVerificationDNSRecord // empty')" \
      "$(echo "$association" | jq -r '.domainAssociation.subDomains[]?.dnsRecord // empty')"; do
      [ -n "$record" ] || continue
      case "$written" in *"|$record|"*) continue ;; esac
      upsert "$domain" "$record"
      written="$written|$record|"
    done
    echo "  $status"
    case "$status" in
      AVAILABLE) break ;;
      FAILED) echo "$association" | jq -r .domainAssociation.statusReason >&2; exit 1 ;;
    esac
    sleep 30
  done
}

claim "$door" coralreefventures.com
claim "$driftline" driftline.app
echo "https://$env.coralreefventures.com/ and https://$env.driftline.app/ answer. Merge the change that names them next."
