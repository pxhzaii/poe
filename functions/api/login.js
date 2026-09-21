// Pages Function: /api/login
// 多用户登录：校验密码 → 返回 token（30 天有效）

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

  if (!username || !password) {
    return jsonResponse({ error: '请输入用户名和密码' }, 400);
  }

  const kv = env.AFFIX_KV;
  if (!kv) {
    return jsonResponse({ error: 'KV 未绑定，请联系管理员' }, 500);
  }

  const userRaw = await kv.get('user:' + username);
  if (!userRaw) {
    return jsonResponse({ error: '用户名或密码错误' }, 401);
  }

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch (e) {
    return jsonResponse({ error: '用户数据损坏' }, 500);
  }

  if (hashPassword(password, user.salt) !== user.passwordHash) {
    return jsonResponse({ error: '用户名或密码错误' }, 401);
  }

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