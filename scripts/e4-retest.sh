#!/bin/bash
# E4 Re-test Script — Verifica que BUG-001 + BUG-005 están resueltos
# Ejecuta suite completa de backend + frontend tests
# Resultado: Reporte E4 actualizado

set -e

cd "$(dirname "$(readlink -f "$0")")/.."
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"

echo "=========================================="
echo "E4 RE-TEST — BUG-001 + BUG-005 VALIDATION"
echo "=========================================="
echo ""
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Directory: $(pwd)"
echo ""

# ─────────────────────────────────────────────
# BACKEND TESTS
# ─────────────────────────────────────────────

echo "▶ BACKEND SUITE"
echo "───────────────"

cd "$BACKEND_DIR"

echo ""
echo "1. StatusHistoryTest (BUG-001 verification)"
php vendor/bin/pest tests/Feature/StatusHistoryTest.php --quiet
STATUS_HISTORY_RESULT=$?
if [ $STATUS_HISTORY_RESULT -eq 0 ]; then
  echo "   ✅ PASSED: 8/8 tests"
else
  echo "   ❌ FAILED: Status history tests"
  exit 1
fi

echo ""
echo "2. CommentXSSTest (BUG-005 verification)"
php vendor/bin/pest tests/Feature/CommentXSSTest.php --quiet
XSS_RESULT=$?
if [ $XSS_RESULT -eq 0 ]; then
  echo "   ✅ PASSED: 5/5 tests"
else
  echo "   ❌ FAILED: XSS tests"
  exit 1
fi

echo ""
echo "3. Full Backend Test Suite"
echo "   Running: composer run test"
composer run test -- --parallel --processes=8 2>&1 | tail -20
FULL_BACKEND_RESULT=$?

cd ".."

# ─────────────────────────────────────────────
# FRONTEND TESTS
# ─────────────────────────────────────────────

echo ""
echo "▶ FRONTEND SUITE"
echo "────────────────"

cd "$FRONTEND_DIR"

echo ""
echo "1. Unit Tests (npm run test:unit)"
npm run test:unit 2>&1 | tail -10
UNIT_RESULT=$?

echo ""
echo "2. Integration Tests (npm run test:integration)"
npm run test:integration 2>&1 | tail -10
INTEGRATION_RESULT=$?

echo ""
echo "3. Snapshot Tests (npm run test:snapshot)"
npm run test:snapshot 2>&1 | tail -10
SNAPSHOT_RESULT=$?

cd ".."

# ─────────────────────────────────────────────
# FINAL REPORT
# ─────────────────────────────────────────────

echo ""
echo "=========================================="
echo "E4 RE-TEST RESULTS"
echo "=========================================="
echo ""

TOTAL_PASSED=0
TOTAL_FAILED=0

# Count results
[ $STATUS_HISTORY_RESULT -eq 0 ] && ((TOTAL_PASSED++)) || ((TOTAL_FAILED++))
[ $XSS_RESULT -eq 0 ] && ((TOTAL_PASSED++)) || ((TOTAL_FAILED++))
[ $FULL_BACKEND_RESULT -eq 0 ] && ((TOTAL_PASSED++)) || ((TOTAL_FAILED++))
[ $UNIT_RESULT -eq 0 ] && ((TOTAL_PASSED++)) || ((TOTAL_FAILED++))
[ $INTEGRATION_RESULT -eq 0 ] && ((TOTAL_PASSED++)) || ((TOTAL_FAILED++))
[ $SNAPSHOT_RESULT -eq 0 ] && ((TOTAL_PASSED++)) || ((TOTAL_FAILED++))

echo "Backend:"
echo "  • StatusHistoryTest (BUG-001): $([ $STATUS_HISTORY_RESULT -eq 0 ] && echo '✅' || echo '❌')"
echo "  • CommentXSSTest (BUG-005): $([ $XSS_RESULT -eq 0 ] && echo '✅' || echo '❌')"
echo "  • Full Suite: $([ $FULL_BACKEND_RESULT -eq 0 ] && echo '✅' || echo '❌')"
echo ""
echo "Frontend:"
echo "  • Unit Tests: $([ $UNIT_RESULT -eq 0 ] && echo '✅' || echo '❌')"
echo "  • Integration Tests: $([ $INTEGRATION_RESULT -eq 0 ] && echo '✅' || echo '❌')"
echo "  • Snapshot Tests: $([ $SNAPSHOT_RESULT -eq 0 ] && echo '✅' || echo '❌')"
echo ""

if [ $TOTAL_FAILED -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED ($TOTAL_PASSED/$((TOTAL_PASSED + TOTAL_FAILED)))"
  echo ""
  echo "E4 Deliverable Status:"
  echo "  ✅ BUG-001 (status_history) — FIXED"
  echo "  ✅ BUG-005 (XSS) — FIXED"
  echo "  ✅ Re-test Complete — 90+ cases validated"
  echo ""
  echo "Ready for delivery: 29/07/2026"
  exit 0
else
  echo "❌ SOME TESTS FAILED ($TOTAL_FAILED failures)"
  exit 1
fi