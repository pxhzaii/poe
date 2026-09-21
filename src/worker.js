/**
 * 流放之路词缀库 · 多用户云同步 Worker
 *
 * 接口说明：
 *   POST /api/register   { username, password }             → 注册
 *   POST /api/login      { username, password }             → 登录，返回 { token }
 *   GET  /api/data       Header: Authorization: Bearer <token> → 拉取当前用户的词缀
 *   POST /api/data       Header: Authorization: Bearer <token> → 推送当前用户的词缀
 *   OPTIONS              → CORS 预检
 *
 * 数据结构（KV 中按用户隔离）：
 *   user:<username>  → { passwordHash, salt }
 *   data:<username>  → { affixes: [...], updated_at: "..." }
 */

const CORS_ORIGIN = '*';

// ===== 简易哈希（不依赖 crypto.subtle，用 djb2 + salt） =====
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
  // 生成随机 token：时间戳 + 随机数 + base36
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
}

function generateSalt() {
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const path = url.pathname.replace(/\/+$/, '');

    try {
      // ===== 注册 =====
      if (request.method === 'POST' && path === '/api/register') {
        const body = await request.json();
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

        const userKey = 'user:' + username;
        const existing = await env.AFFIX_KV.get(userKey);
        if (existing) {
          return jsonResponse({ error: '该用户名已被注册' }, 409);
        }

        const salt = generateSalt();
        const passwordHash = hashPassword(password, salt);
        await env.AFFIX_KV.put(userKey, JSON.stringify({ passwordHash, salt }));

        // 自动登录，返回 token
        const token = generateToken();
        await env.AFFIX_KV.put('token:' + token, JSON.stringify({ username, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 }));

        return jsonResponse({ ok: true, token, username });
      }

      // ===== 登录 =====
      if (request.method === 'POST' && path === '/api/login') {
        const body = await request.json();
        const username = (body.username || '').trim();
        const password = body.password || '';

        if (!username || !password) {
          return jsonResponse({ error: '请输入用户名和密码' }, 400);
        }

        const userKey = 'user:' + username;
        const userRaw = await env.AFFIX_KV.get(userKey);
        if (!userRaw) {
          return jsonResponse({ error: '用户名或密码错误' }, 401);
        }

        const user = JSON.parse(userRaw);
        const inputHash = hashPassword(password, user.salt);
        if (inputHash !== user.passwordHash) {
          return jsonResponse({ error: '用户名或密码错误' }, 401);
        }

        const token = generateToken();
        await env.AFFIX_KV.put('token:' + token, JSON.stringify({ username, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 }));

        return jsonResponse({ ok: true, token, username });
      }

      // ===== 数据读写（需鉴权） =====
      if (path === '/api/data') {
        // 鉴权
        const authResult = await authenticate(request, env);
        if (!authResult.ok) {
          return jsonResponse({ error: authResult.error }, 401);
        }
        const username = authResult.username;

        if (request.method === 'GET') {
          const raw = await env.AFFIX_KV.get('data:' + username);
          if (!raw) {
            return jsonResponse({ affixes: [], updated_at: null });
          }
          try {
            const data = JSON.parse(raw);
            return jsonResponse({
              affixes: Array.isArray(data.affixes) ? data.affixes : [],
              categories: Array.isArray(data.categories) ? data.categories : [],
              updated_at: data.updated_at || null,
            });
          } catch (e) {
            return jsonResponse({ error: '云端数据解析失败' }, 500);
          }
        }

        if (request.method === 'POST') {
          const body = await request.json();
          if (!Array.isArray(body.affixes)) {
            return jsonResponse({ error: '缺少 affixes 数组' }, 400);
          }
          const data = {
            affixes: body.affixes,
            categories: Array.isArray(body.categories) ? body.categories : [],
            updated_at: new Date().toISOString(),
          };
          await env.AFFIX_KV.put('data:' + username, JSON.stringify(data));
          return jsonResponse({ ok: true, updated_at: data.updated_at, count: data.affixes.length });
        }
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (e) {
      return jsonResponse({ error: '服务器内部错误: ' + e.message }, 500);
    }
  },
};

async function authenticate(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return { ok: false, error: '未授权：Token 缺失' };
  }
  const token = auth.slice(7);
  const tokenRaw = await env.AFFIX_KV.get('token:' + token);
  if (!tokenRaw) {
    return { ok: false, error: '未授权：Token 无效或已过期' };
  }
  try {
    const tokenData = JSON.parse(tokenRaw);
    if (tokenData.expires && Date.now() > tokenData.expires) {
      await env.AFFIX_KV.delete('token:' + token);
      return { ok: false, error: 'Token 已过期，请重新登录' };
    }
    return { ok: true, username: tokenData.username };
  } catch (e) {
    return { ok: false, error: 'Token 解析失败' };
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  });
}
