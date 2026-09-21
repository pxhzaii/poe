// Pages Function: /api/data
// 词缀数据读写（需 Bearer Token 鉴权，按用户隔离）
//   GET  → 拉取当前用户的词缀
//   POST → 覆盖推送当前用户的词缀

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

async function authenticate(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return { ok: false, error: '未授权：Token 缺失' };
  }
  const token = auth.slice(7);
  const kv = env.AFFIX_KV;
  if (!kv) {
    return { ok: false, error: 'KV 未绑定，请联系管理员' };
  }
  const tokenRaw = await kv.get('token:' + token);
  if (!tokenRaw) {
    return { ok: false, error: '未授权：Token 无效或已过期' };
  }
  try {
    const tokenData = JSON.parse(tokenRaw);
    if (tokenData.expires && Date.now() > tokenData.expires) {
      await kv.delete('token:' + token);
      return { ok: false, error: 'Token 已过期，请重新登录' };
    }
    return { ok: true, username: tokenData.username };
  } catch (e) {
    return { ok: false, error: 'Token 解析失败' };
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const authResult = await authenticate(request, env);
  if (!authResult.ok) {
    return jsonResponse({ error: authResult.error }, 401);
  }

  const kv = env.AFFIX_KV;
  const raw = await kv.get('data:' + authResult.username);
  if (!raw) {
    return jsonResponse({ affixes: [], updated_at: null });
  }
  try {
    const data = JSON.parse(raw);
    return jsonResponse({
      affixes: Array.isArray(data.affixes) ? data.affixes : [],
      updated_at: data.updated_at || null,
    });
  } catch (e) {
    return jsonResponse({ error: '云端数据解析失败' }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const authResult = await authenticate(request, env);
  if (!authResult.ok) {
    return jsonResponse({ error: authResult.error }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: '请求体不是合法 JSON' }, 400);
  }

  if (!Array.isArray(body.affixes)) {
    return jsonResponse({ error: '缺少 affixes 数组' }, 400);
  }

  const kv = env.AFFIX_KV;
  const data = {
    affixes: body.affixes,
    updated_at: new Date().toISOString(),
  };
  await kv.put('data:' + authResult.username, JSON.stringify(data));

  return jsonResponse({ ok: true, updated_at: data.updated_at, count: data.affixes.length });
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