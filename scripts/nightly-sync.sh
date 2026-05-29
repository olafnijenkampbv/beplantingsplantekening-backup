#!/usr/bin/env bash
# =============================================================================
# nightly-sync.sh — Nachtelijke plant-feed sync voor beplantingsplantekening
# =============================================================================
#
# Dit script roept de /api/admin/sync endpoint aan om de plantendata in SQLite
# te verversen op basis van de live Google Shopping feed.
#
# Bij een mislukte sync (feed onbereikbaar, leeg antwoord, etc.) blijft de
# bestaande database gewoon intact — de app merkt niets en blijft werken.
#
# -----------------------------------------------------------------------------
# Installatie (eenmalig op de server)
# -----------------------------------------------------------------------------
#
# 1. Maak het script uitvoerbaar:
#      chmod +x /pad/naar/project/scripts/nightly-sync.sh
#
# 2. Open de crontab van de deployment-gebruiker:
#      crontab -e
#
# 3. Voeg de volgende regels toe (sync elke nacht om 02:00):
#
#      SITE_URL=https://jouwsite.nl
#      SYNC_SECRET=jouw-geheime-wachtwoord
#      0 2 * * * /pad/naar/project/scripts/nightly-sync.sh >> /var/log/plant-sync.log 2>&1
#
#    Of met een absoluut pad naar het script voor extra zekerheid:
#      0 2 * * * cd /pad/naar/project && bash scripts/nightly-sync.sh >> /var/log/plant-sync.log 2>&1
#
# 4. Controleer dat de log na de eerste nacht iets bevat:
#      tail -50 /var/log/plant-sync.log
#
# 5. Controleer de sync-status via de API:
#      curl https://jouwsite.nl/api/admin/sync-status \
#           -H "x-sync-secret: jouw-geheime-wachtwoord"
#
# -----------------------------------------------------------------------------
# Omgevingsvariabelen
# -----------------------------------------------------------------------------
#
# SITE_URL      — de basis-URL van de app (zonder trailing slash)
#                 Standaard: http://localhost:3000
# SYNC_SECRET   — de geheime sleutel uit .env.local (SYNC_SECRET=...)
#                 Vereist — het script stopt als deze niet is ingesteld.
#
# =============================================================================

set -euo pipefail

# --- Configuratie ------------------------------------------------------------

SITE_URL="${SITE_URL:-http://localhost:3000}"
SYNC_SECRET="${SYNC_SECRET:-}"
TIMEOUT_SECONDS=120      # max wachttijd op de sync (de feed kan ~10 s nodig hebben)
CONNECT_TIMEOUT=10       # max wachttijd voor de TCP-verbinding

# --- Hulpfuncties ------------------------------------------------------------

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# --- Validatie ---------------------------------------------------------------

if [ -z "$SYNC_SECRET" ]; then
    log "FOUT: SYNC_SECRET is niet ingesteld. Stel deze in als omgevingsvariabele in de crontab."
    exit 1
fi

# --- Sync uitvoeren ----------------------------------------------------------

log "Starten nachtelijke plant-sync → ${SITE_URL}/api/admin/sync"

# curl schrijft de HTTP-body naar stdout en de statuscode op de laatste regel
HTTP_RESPONSE=$(curl --silent \
    --write-out "\n%{http_code}" \
    --request POST "${SITE_URL}/api/admin/sync" \
    --header "x-sync-secret: ${SYNC_SECRET}" \
    --header "Content-Type: application/json" \
    --connect-timeout "${CONNECT_TIMEOUT}" \
    --max-time "${TIMEOUT_SECONDS}")

# Splits body en statuscode
HTTP_BODY=$(echo "$HTTP_RESPONSE" | head -n -1)
HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n 1)

# --- Resultaat verwerken -----------------------------------------------------

if [ "${HTTP_STATUS}" -eq 200 ]; then
    # Lees plantsImported uit de JSON-response (vereist geen jq)
    PLANTS=$(echo "$HTTP_BODY" | grep -oP '"plantsImported":\s*\K[0-9]+' || echo "?")
    VARIANTS=$(echo "$HTTP_BODY" | grep -oP '"variantsImported":\s*\K[0-9]+' || echo "?")
    DURATION=$(echo "$HTTP_BODY" | grep -oP '"durationMs":\s*\K[0-9]+' || echo "?")
    log "Sync geslaagd — ${PLANTS} planten, ${VARIANTS} varianten, ${DURATION}ms"
    exit 0
else
    log "Sync mislukt (HTTP ${HTTP_STATUS}): ${HTTP_BODY}"
    exit 1
fi
