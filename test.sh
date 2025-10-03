ENDPOINT="https://github-bridge-odrhjpaps-devs-projects-ddeec7cf.vercel.app/api/agent/execute"
SECRET="6768257cf023af94bae9283fb11eae7ef46035850f3637c09ed73208f3c4c82c"
REPO="mea-world/glor.ia-core"

# Costruisco il body JSON in UNA sola riga, così la firma combacia al 100%
BODY=$(cat <<EOF
{"agentId":"gloria","repo":"$REPO","action":"CREATE_ISSUE","payload":{"title":"Prova issue da bridge","body":"Issue creata via bridge HMAC"}} 
EOF
)

# Calcolo firma HMAC SHA256 sul RAW BODY
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256)"

# Chiamata
curl -i -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIG" \
  --data "$BODY"
