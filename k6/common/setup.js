import http from 'k6/http';
import { check } from 'k6';

// ** 경로 설정 **
const BASE_URL = 'http://localhost:3000';
const SIGNUP_PATH = '/api/auth/signup';
const LOGIN_PATH = '/api/auth/login';

/**
 * 테스트용 사용자를 등록하고 세션 쿠키를 반환
 * express-session 기반 인증 사용
 * 각 VU는 독립적인 사용자와 세션을 가짐
 */
export function registerTestUser() {
  const res = http.post(`${BASE_URL}${SIGNUP_PATH}`, null, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(res, {
    'setup register status is 201': (r) => r.status === 201,
    'setup register returns userId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body?.userId);
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    console.error(`Setup user registration failed: ${res.status} ${res.body}`);
    return null;
  }

  try {
    const body = JSON.parse(res.body);
    return {
      userId: body.userId,
      balance: body.balance,
    };
  } catch (err) {
    console.error('Failed to parse setup registration response', err);
    return null;
  }
}

export function loginTestUser(userId) {
  const payload = JSON.stringify({ userId });

  const res = http.post(`${BASE_URL}${LOGIN_PATH}`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login response returns userId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body?.userId === userId;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    console.error(
      `Login failed for userId ${userId}: ${res.status} ${res.body}`,
    );
    return null;
  }

  return {
    userId,
    success: true,
  };
}
