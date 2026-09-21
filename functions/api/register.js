// Pages Function: /api/register
// 多用户注册：用户名+密码 → 存 KV（user:<username>），自动登录返回 token

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

// 简易哈希（djb2 + salt），不依赖 crypto.subtle
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return (hash >>> 0).toString(16);
}

function hashPassword(password, salt) {
  return simpleHash(salt + password + salt);
}

function generateToken() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
}

function generateSalt() {
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: '请求体不是合法 JSON' }, 400);
  }

  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!username || username.length < 2 || username.length > 20) {
    return jsonResponse({ error: '用户名需 2-20 个字符' }, 400);
  }
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
    return jsonResponse({ error: '用户名只能包含中英文、数字、下划线' }, 400);
  }
  if (!password || password.length < 4) {
    return jsonResponse({ error: '密码至少 4 个字符' }, 400);
  }

  const kv = env.AFFIX_KV;
  if (!kv) {
    return jsonResponse({ error: 'KV 未绑定，请联系管理员' }, 500);
  }

  const userKey = 'user:' + username;
  const existing = await kv.get(userKey);
  if (existing) {
    return jsonResponse({ error: '该用户名已被注册' }, 409);
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  await kv.put(userKey, JSON.stringify({ passwordHash, salt }));

  // 自动登录，返回 token
  const token = generateToken();
  await kv.put('token:' + token, JSON.stringify({ username, expires: Date.now() + TOKEN_TTL_MS }));

  return jsonResponse({ ok: true, token, username });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}