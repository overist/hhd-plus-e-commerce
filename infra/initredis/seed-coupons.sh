#!/bin/sh
set -e
set -u

REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo "[redis-seed] waiting for redis at ${REDIS_HOST}:${REDIS_PORT}..."
until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; do
  sleep 1
done

# NOTE:
# - MySQL init_data.sql에서 쿠폰을 1개만 삽입하고, 빈 DB 기준으로 id=1이 됩니다.
# - 앱의 쿠폰 발급 로직은 Redis hash 키(data:coupon:{couponId})를 직접 참조하므로,
#   여기서도 동일한 couponId로 데이터를 시딩합니다.

now_ms=$(( $(date +%s) * 1000 ))

echo "[redis-seed] seeding coupon 1..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HSET "data:coupon:1" \
  id "1" \
  name "TESTCOUPON" \
  discountRate "15" \
  totalQuantity "10000000" \
  issuedQuantity "0" \
  expiredAt "1893455999000" \
  createdAt "1893455999000" \
  updatedAt "1893455999000" \
  >/dev/null

redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SET "seed:coupon" "$now_ms" >/dev/null

echo "[redis-seed] done"
