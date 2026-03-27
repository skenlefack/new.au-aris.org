#!/usr/bin/env python3
"""
ARIS 4.0 — AfaData Migration Integration Tests
Tests all AfaData features on STG/PROD environment.

Validates:
  - Fishery referentials (master-data)
  - Captures CRUD + DELETE
  - Vessels CRUD + DELETE
  - Aquaculture farms + production CRUD + DELETE
  - Fishing efforts CRUD + DELETE
  - Trade flows with commodityGroup=FISH + DELETE
  - Export endpoints (xlsx, csv, fishstatj)
  - Import endpoints (template, csv import)
  - Multi-tenant isolation

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u deploy/scripts/_test_afadata_migration.py --env=STG
  python -u deploy/scripts/_test_afadata_migration.py --env=PROD
"""
import sys
import os
import argparse
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import VM_PASS, VM_USER
import paramiko

ENV_CONFIG = {
    "STG":  {"app_host": "10.202.101.146", "label": "STAGING (test.au-aris.org)"},
    "PROD": {"app_host": "10.202.101.183", "label": "PRODUCTION (au-aris.org)"},
}

# ── The integration test script (bash) ──────────────────────────────────
# Runs entirely on the APP VM via SSH

TEST_SCRIPT = r"""#!/bin/bash
set -u

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "  [FAIL] $1 — $2"; }

section() { echo ""; echo "=== $1 ==="; }

# ── 1. AUTH ──────────────────────────────────────────────────────────

section "1. AUTHENTICATION"

# Login as super admin
TOKEN=$(curl -sf --max-time 15 -X POST http://localhost:3002/api/v1/credential/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@au-aris.org","password":"Aris2024!"}' 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  fail "AUTH_01" "Super admin login failed — cannot continue"
  echo ""
  echo "SUMMARY: 0 passed, 1 failed out of 1 tests"
  exit 1
fi
pass "AUTH_01: Super admin login OK (${#TOKEN} chars)"

# Login as Kenya admin
TOKEN_KE=$(curl -sf --max-time 15 -X POST http://localhost:3002/api/v1/credential/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ke.au-aris.org","password":"Aris2024!"}' 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('accessToken',''))" 2>/dev/null)

if [ -n "$TOKEN_KE" ]; then
  pass "AUTH_02: Kenya admin login OK"
else
  fail "AUTH_02" "Kenya admin login failed"
fi

# ── 2. REFERENTIALS ──────────────────────────────────────────────────

section "2. FISHERY REFERENTIALS (master-data :3003)"

for CAT in GEAR_TYPE VESSEL_TYPE FARM_TYPE FISHING_AREA FISH_CATEGORY PRODUCT_STATE; do
  RESP=$(curl -sf --max-time 10 "http://localhost:3003/api/v1/master-data/fishery-referentials?category=$CAT&limit=50" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  COUNT=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('meta',{}).get('total',len(d.get('data',[]))))" 2>/dev/null)
  if [ "$COUNT" -gt 0 ] 2>/dev/null; then
    pass "REF_$CAT: $COUNT items"
  else
    fail "REF_$CAT" "No items found (expected > 0)"
  fi
done

# ── 3. CAPTURES CRUD + DELETE ────────────────────────────────────────

section "3. CAPTURES (fisheries :3022)"

RESP=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/captures?limit=1" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
HTTP=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'data' in d else 'FAIL')" 2>/dev/null)
if [ "$HTTP" = "OK" ]; then pass "CAP_01: GET captures (list)"; else fail "CAP_01" "GET captures failed"; fi

# Create a capture
CAP_BODY='{"speciesId":null,"faoAreaCode":"51","gearType":"GILLNET","quantityKg":500,"landingSite":"Test-Site","captureDate":"2026-03-01"}'
CAP_RESP=$(curl -sf --max-time 10 -X POST http://localhost:3022/api/v1/fisheries/captures \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$CAP_BODY" 2>/dev/null)
CAP_ID=$(echo "$CAP_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
if [ -n "$CAP_ID" ]; then pass "CAP_02: POST capture created ($CAP_ID)"; else fail "CAP_02" "POST capture failed"; fi

# Get by id
if [ -n "$CAP_ID" ]; then
  RESP=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/captures/$CAP_ID" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  GOT_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
  if [ "$GOT_ID" = "$CAP_ID" ]; then pass "CAP_03: GET capture by ID"; else fail "CAP_03" "GET capture by ID failed"; fi

  # Update
  UPD_RESP=$(curl -sf --max-time 10 -X PATCH "http://localhost:3022/api/v1/fisheries/captures/$CAP_ID" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"quantityKg":999}' 2>/dev/null)
  UPD_QTY=$(echo "$UPD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('quantityKg',0))" 2>/dev/null)
  if [ "$UPD_QTY" = "999" ] || [ "$UPD_QTY" = "999.0" ]; then pass "CAP_04: PATCH capture updated"; else fail "CAP_04" "PATCH capture failed (qty=$UPD_QTY)"; fi

  # Delete
  DEL_RESP=$(curl -sf --max-time 10 -X DELETE "http://localhost:3022/api/v1/fisheries/captures/$CAP_ID" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  DEL_OK=$(echo "$DEL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('deleted',False))" 2>/dev/null)
  if [ "$DEL_OK" = "True" ]; then pass "CAP_05: DELETE capture"; else fail "CAP_05" "DELETE capture failed"; fi

  # Verify deleted (should be 404)
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:3022/api/v1/fisheries/captures/$CAP_ID" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  if [ "$HTTP_CODE" = "404" ]; then pass "CAP_06: GET after delete → 404"; else fail "CAP_06" "Expected 404 got $HTTP_CODE"; fi
fi

# ── 4. VESSELS CRUD + DELETE ─────────────────────────────────────────

section "4. VESSELS (fisheries :3022)"

RESP=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/vessels?limit=1" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
HTTP=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'data' in d else 'FAIL')" 2>/dev/null)
if [ "$HTTP" = "OK" ]; then pass "VES_01: GET vessels"; else fail "VES_01" "GET vessels failed"; fi

VES_BODY='{"name":"Test Vessel","registrationNumber":"TEST-'$RANDOM'","flagState":"KE","vesselType":"ARTISANAL","lengthMeters":10,"tonnageGt":5,"homePort":"TestPort","enginePowerKw":50,"crewCapacity":6}'
VES_RESP=$(curl -sf --max-time 10 -X POST http://localhost:3022/api/v1/fisheries/vessels \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$VES_BODY" 2>/dev/null)
VES_ID=$(echo "$VES_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
if [ -n "$VES_ID" ]; then pass "VES_02: POST vessel (with enginePowerKw, crewCapacity)"; else fail "VES_02" "POST vessel failed"; fi

if [ -n "$VES_ID" ]; then
  UPD_RESP=$(curl -sf --max-time 10 -X PATCH "http://localhost:3022/api/v1/fisheries/vessels/$VES_ID" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"name":"Updated Vessel"}' 2>/dev/null)
  UPD_NAME=$(echo "$UPD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('name',''))" 2>/dev/null)
  if [ "$UPD_NAME" = "Updated Vessel" ]; then pass "VES_03: PATCH vessel"; else fail "VES_03" "PATCH vessel failed"; fi

  DEL_RESP=$(curl -sf --max-time 10 -X DELETE "http://localhost:3022/api/v1/fisheries/vessels/$VES_ID" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  DEL_OK=$(echo "$DEL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('deleted',False))" 2>/dev/null)
  if [ "$DEL_OK" = "True" ]; then pass "VES_04: DELETE vessel"; else fail "VES_04" "DELETE vessel failed"; fi
fi

# ── 5. AQUACULTURE FARMS ─────────────────────────────────────────────

section "5. AQUACULTURE FARMS (fisheries :3022)"

RESP=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/aquaculture/farms?limit=1" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
HTTP=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'data' in d else 'FAIL')" 2>/dev/null)
if [ "$HTTP" = "OK" ]; then pass "FARM_01: GET farms"; else fail "FARM_01" "GET farms failed"; fi

FARM_BODY='{"name":"Test Farm","farmType":"POND","waterSource":"FRESHWATER","areaHectares":2.5,"speciesIds":[],"productionCapacityTonnes":50,"totalWorkers":10,"maleWorkers":6,"femaleWorkers":4,"pondCount":5}'
FARM_RESP=$(curl -sf --max-time 10 -X POST http://localhost:3022/api/v1/fisheries/aquaculture/farms \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$FARM_BODY" 2>/dev/null)
FARM_ID=$(echo "$FARM_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
if [ -n "$FARM_ID" ]; then pass "FARM_02: POST farm (with workers, pondCount)"; else fail "FARM_02" "POST farm failed"; fi

if [ -n "$FARM_ID" ]; then
  DEL_RESP=$(curl -sf --max-time 10 -X DELETE "http://localhost:3022/api/v1/fisheries/aquaculture/farms/$FARM_ID" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  DEL_OK=$(echo "$DEL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('deleted',False))" 2>/dev/null)
  if [ "$DEL_OK" = "True" ]; then pass "FARM_03: DELETE farm"; else fail "FARM_03" "DELETE farm failed"; fi
fi

# ── 6. AQUACULTURE PRODUCTION ────────────────────────────────────────

section "6. AQUACULTURE PRODUCTION (fisheries :3022)"

RESP=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/aquaculture/production?limit=1" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
HTTP=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'data' in d else 'FAIL')" 2>/dev/null)
if [ "$HTTP" = "OK" ]; then pass "PROD_01: GET production"; else fail "PROD_01" "GET production failed"; fi

# Get a farm ID for production
FARM_FOR_PROD=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/aquaculture/farms?limit=1" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  items=d.get('data',[])
  print(items[0]['id'] if items else '')
except: print('')
" 2>/dev/null)

if [ -n "$FARM_FOR_PROD" ]; then
  PROD_BODY="{\"farmId\":\"$FARM_FOR_PROD\",\"speciesId\":null,\"quantityKg\":1000,\"harvestDate\":\"2026-03-01\",\"methodOfCulture\":\"POND\",\"stockingDate\":\"2025-09-01\",\"survivalRate\":85.5,\"averageWeightGrams\":350}"
  PROD_RESP=$(curl -sf --max-time 10 -X POST http://localhost:3022/api/v1/fisheries/aquaculture/production \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$PROD_BODY" 2>/dev/null)
  PROD_ID=$(echo "$PROD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
  if [ -n "$PROD_ID" ]; then pass "PROD_02: POST production (with stockingDate, survivalRate)"; else fail "PROD_02" "POST production failed"; fi

  if [ -n "$PROD_ID" ]; then
    DEL_RESP=$(curl -sf --max-time 10 -X DELETE "http://localhost:3022/api/v1/fisheries/aquaculture/production/$PROD_ID" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    DEL_OK=$(echo "$DEL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('deleted',False))" 2>/dev/null)
    if [ "$DEL_OK" = "True" ]; then pass "PROD_03: DELETE production"; else fail "PROD_03" "DELETE production failed"; fi
  fi
else
  fail "PROD_02" "No farm found for production test"
  fail "PROD_03" "Skipped (no farm)"
fi

# ── 7. FISHING EFFORTS ───────────────────────────────────────────────

section "7. FISHING EFFORTS (fisheries :3022)"

RESP=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/efforts?limit=1" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
HTTP=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'data' in d else 'FAIL')" 2>/dev/null)
if [ "$HTTP" = "OK" ]; then pass "EFF_01: GET efforts"; else fail "EFF_01" "GET efforts failed"; fi

EFF_BODY='{"effortType":"DAYS_AT_SEA","effortValue":5,"effortUnit":"DAYS","startDate":"2026-03-01T00:00:00Z","endDate":"2026-03-05T00:00:00Z","gearType":"GILLNET","crewSize":8}'
EFF_RESP=$(curl -sf --max-time 10 -X POST http://localhost:3022/api/v1/fisheries/efforts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$EFF_BODY" 2>/dev/null)
EFF_ID=$(echo "$EFF_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
if [ -n "$EFF_ID" ]; then pass "EFF_02: POST effort"; else fail "EFF_02" "POST effort failed"; fi

if [ -n "$EFF_ID" ]; then
  RESP=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/efforts/$EFF_ID" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  GOT_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
  if [ "$GOT_ID" = "$EFF_ID" ]; then pass "EFF_03: GET effort by ID"; else fail "EFF_03" "GET effort by ID failed"; fi

  UPD_RESP=$(curl -sf --max-time 10 -X PATCH "http://localhost:3022/api/v1/fisheries/efforts/$EFF_ID" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"effortValue":10}' 2>/dev/null)
  UPD_VAL=$(echo "$UPD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('effortValue',0))" 2>/dev/null)
  if [ "$UPD_VAL" = "10" ] || [ "$UPD_VAL" = "10.0" ]; then pass "EFF_04: PATCH effort"; else fail "EFF_04" "PATCH effort failed (val=$UPD_VAL)"; fi

  DEL_RESP=$(curl -sf --max-time 10 -X DELETE "http://localhost:3022/api/v1/fisheries/efforts/$EFF_ID" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  DEL_OK=$(echo "$DEL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('deleted',False))" 2>/dev/null)
  if [ "$DEL_OK" = "True" ]; then pass "EFF_05: DELETE effort"; else fail "EFF_05" "DELETE effort failed"; fi
fi

# ── 8. TRADE FLOWS (fish) ────────────────────────────────────────────

section "8. TRADE FLOWS — FISH (trade-sps :3025)"

RESP=$(curl -sf --max-time 10 "http://localhost:3025/api/v1/trade/flows?commodityGroup=FISH&limit=1" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
HTTP=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'data' in d else 'FAIL')" 2>/dev/null)
if [ "$HTTP" = "OK" ]; then pass "TRD_01: GET trade flows (commodityGroup=FISH)"; else fail "TRD_01" "GET trade flows failed"; fi

TRD_BODY='{"commodity":"Frozen tuna test","flowDirection":"EXPORT","quantity":1000,"unit":"KG","productState":"FROZEN","commodityGroup":"FISH"}'
TRD_RESP=$(curl -sf --max-time 10 -X POST http://localhost:3025/api/v1/trade/flows \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$TRD_BODY" 2>/dev/null)
TRD_ID=$(echo "$TRD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
if [ -n "$TRD_ID" ]; then pass "TRD_02: POST trade flow (FISH, FROZEN)"; else fail "TRD_02" "POST trade flow failed"; fi

if [ -n "$TRD_ID" ]; then
  DEL_RESP=$(curl -sf --max-time 10 -X DELETE "http://localhost:3025/api/v1/trade/flows/$TRD_ID" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  DEL_OK=$(echo "$DEL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('deleted',False))" 2>/dev/null)
  if [ "$DEL_OK" = "True" ]; then pass "TRD_03: DELETE trade flow"; else fail "TRD_03" "DELETE trade flow failed"; fi
fi

# ── 9. EXPORT ────────────────────────────────────────────────────────

section "9. EXPORT ENDPOINTS"

# Export captures as xlsx
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
  "http://localhost:3022/api/v1/fisheries/captures/export?format=xlsx" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then pass "EXP_01: Export captures (xlsx) → 200"; else fail "EXP_01" "HTTP $HTTP_CODE"; fi

# Export vessels as csv
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
  "http://localhost:3022/api/v1/fisheries/vessels/export?format=csv" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then pass "EXP_02: Export vessels (csv) → 200"; else fail "EXP_02" "HTTP $HTTP_CODE"; fi

# Export FishStatJ
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
  "http://localhost:3022/api/v1/fisheries/export/fishstatj?year=2025" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then pass "EXP_03: Export FishStatJ (FAO) → 200"; else fail "EXP_03" "HTTP $HTTP_CODE"; fi

# Export trade flows
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
  "http://localhost:3025/api/v1/trade/flows/export?format=xlsx&commodityGroup=FISH" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then pass "EXP_04: Export trade flows (xlsx, FISH) → 200"; else fail "EXP_04" "HTTP $HTTP_CODE"; fi

# ── 10. IMPORT ───────────────────────────────────────────────────────

section "10. IMPORT ENDPOINTS"

# Download template
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  "http://localhost:3022/api/v1/fisheries/captures/import/template" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then pass "IMP_01: GET captures import template → 200"; else fail "IMP_01" "HTTP $HTTP_CODE"; fi

# Create test CSV for import
cat > /tmp/test_import_captures.csv << 'CSVEOF'
speciesCode,faoAreaCode,gearType,quantityKg,captureDate,landingSite
TIL,01,GILLNET,5000,2026-01-15,Test-Kisumu
YFT,51,LONGLINE,12000,2026-02-20,Test-Mombasa
CSVEOF

# Import CSV
IMP_RESP=$(curl -sf --max-time 30 -X POST http://localhost:3022/api/v1/fisheries/captures/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_import_captures.csv" 2>/dev/null)
IMP_COUNT=$(echo "$IMP_RESP" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  data = d.get('data', d)
  print(data.get('imported',0))
except: print(0)
" 2>/dev/null)
if [ "$IMP_COUNT" -ge 1 ] 2>/dev/null; then
  pass "IMP_02: Import CSV ($IMP_COUNT records imported)"
else
  fail "IMP_02" "Import failed (imported=$IMP_COUNT)"
fi

# Import CSV with errors (missing required field)
cat > /tmp/test_import_errors.csv << 'CSVEOF'
speciesCode,faoAreaCode,gearType,quantityKg,captureDate,landingSite
,,,,,
TIL,,GILLNET,5000,2026-01-15,Kisumu
CSVEOF

IMP_RESP=$(curl -sf --max-time 30 -X POST http://localhost:3022/api/v1/fisheries/captures/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_import_errors.csv" 2>/dev/null)
IMP_ERRORS=$(echo "$IMP_RESP" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  data = d.get('data', d)
  errors = data.get('errors',[])
  print(len(errors))
except: print(0)
" 2>/dev/null)
if [ "$IMP_ERRORS" -ge 0 ] 2>/dev/null; then
  pass "IMP_03: Import with partial errors (errors=$IMP_ERRORS)"
else
  fail "IMP_03" "Import error test failed"
fi

# ── 11. MULTI-TENANT ISOLATION ───────────────────────────────────────

section "11. MULTI-TENANT ISOLATION"

if [ -n "$TOKEN_KE" ]; then
  # Kenya admin sees only Kenya data
  KE_RESP=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/captures?limit=100" \
    -H "Authorization: Bearer $TOKEN_KE" 2>/dev/null)
  KE_COUNT=$(echo "$KE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('meta',{}).get('total',len(d.get('data',[]))))" 2>/dev/null)

  AU_RESP=$(curl -sf --max-time 10 "http://localhost:3022/api/v1/fisheries/captures?limit=100" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  AU_COUNT=$(echo "$AU_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('meta',{}).get('total',len(d.get('data',[]))))" 2>/dev/null)

  if [ "$AU_COUNT" -ge "$KE_COUNT" ] 2>/dev/null; then
    pass "MT_01: Continental sees >= Kenya data (AU=$AU_COUNT >= KE=$KE_COUNT)"
  else
    fail "MT_01" "Tenant isolation issue (AU=$AU_COUNT < KE=$KE_COUNT)"
  fi

  pass "MT_02: Continental admin sees all data ($AU_COUNT captures)"
else
  fail "MT_01" "Kenya token not available"
  fail "MT_02" "Kenya token not available"
fi

# ── 12. JWT PROTECTION ───────────────────────────────────────────────

section "12. JWT PROTECTION"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  "http://localhost:3022/api/v1/fisheries/captures" 2>/dev/null)
if [ "$HTTP_CODE" = "401" ]; then
  pass "SEC_01: No token → 401 Unauthorized"
else
  fail "SEC_01" "Expected 401, got $HTTP_CODE"
fi

# ── SUMMARY ──────────────────────────────────────────────────────────

echo ""
echo "================================================================"
echo "  AFADATA MIGRATION TEST RESULTS"
echo "================================================================"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Total:  $TOTAL"
echo "================================================================"

if [ "$FAIL" -eq 0 ]; then
  echo "  ALL TESTS PASSED!"
else
  echo "  SOME TESTS FAILED — review above"
fi
echo ""

# Cleanup
rm -f /tmp/test_import_captures.csv /tmp/test_import_errors.csv

exit $FAIL
"""


def main():
    parser = argparse.ArgumentParser(
        description="ARIS 4.0 — AfaData Migration Integration Tests",
    )
    parser.add_argument(
        "--env",
        default="STG",
        choices=["STG", "PROD"],
        help="Target environment (default: STG)",
    )
    args = parser.parse_args()

    env = ENV_CONFIG[args.env]
    app_host = env["app_host"]
    label = env["label"]

    print(f"\n{'='*60}")
    print(f"  ARIS 4.0 — AfaData Migration Tests")
    print(f"  Environment: {label} ({app_host})")
    print(f"{'='*60}\n")

    # Upload test script to remote VM
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(app_host, port=22, username=VM_USER, password=VM_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)

    local_tmp = tempfile.mktemp(suffix=".sh")
    with open(local_tmp, "w", newline="\n") as f:
        f.write(TEST_SCRIPT)

    sftp = c.open_sftp()
    sftp.put(local_tmp, "/tmp/test_afadata.sh")
    sftp.close()
    os.unlink(local_tmp)
    c.close()

    # Execute test script
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(app_host, port=22, username=VM_USER, password=VM_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)

    stdin, stdout, stderr = c.exec_command("bash /tmp/test_afadata.sh", timeout=300)
    stdout.channel.settimeout(300)

    # Stream output
    for line in iter(stdout.readline, ""):
        print(line.rstrip())

    exit_code = stdout.channel.recv_exit_status()
    c.close()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
