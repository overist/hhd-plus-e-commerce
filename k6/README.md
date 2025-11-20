# k6 부하테스트 가이드

## 시작하기

- 경합이 발생하는 API에 대해 p55, p95, p99 응답시간 목표치를 설정하고, 스모크 테스트를 실행합니다.
- 사전 설치 명령어로 k6 바이너리를 호스트에 설치한 뒤 사용합니다.
- 가상 환경 비권장, 하드웨어가 격리된 환경에서 테스트를 권장합니다.
- 프로덕션 사양과 동등하거나 그보다 낮은 수준의 STAGE 서버를 구성하여 테스트를 권장합니다.

## 사전 설치 명령어

### Windows

```powershell
choco install k6
```

### macOS

```bash
brew install k6
```

### CI (Docker 기반)

```bash
docker pull grafana/k6
```

GitHub Actions 예:

```yaml
- uses: grafana/k6-action@v0.2.0
	 with:
		 filename: test/k6/minimal-smoke.test.js
		 flags: --env K6_TARGET_URL=${{ env.K6_TARGET_URL }}
```

## 실행

### 잔액 충전 부하 테스트

```bash
k6 run k6/balance-charge.script.js
```
