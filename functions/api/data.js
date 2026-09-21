// Pages Function: /api/data
// 词缀数据读写（单密码模式，密码比对环境变量 APP_PASSWORD）
//   GET  → 拉取词缀数据
//   POST → 覆盖推送词缀数据

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Password',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function authenticate(request, env) {
  const password = request.headers.get('X-Sync-Password') || '';
  const appPassword = env.APP_PASSWORD || '';
  if (!appPassword) {
    return { ok: false, error: '服务端未配置密码，请联系管理员' };
  }
  if (!password || password !== appPassword) {
    return { ok: false, error: '密码错误' };
  }
  return { ok: true };
}

const DATA_KEY = 'data:affixes';

export async function onRequestGet(context) {
  const { request, env } = context;

  const authResult = authenticate(request, env);
  if (!authResult.ok) {
    return jsonResponse({ error: authResult.error }, 401);
  }

  const kv = env.AFFIX_KV;
  if (!kv) {
    return jsonResponse({ error: 'KV 未绑定，请联系管理员' }, 500);
  }
  const raw = await kv.get(DATA_KEY);
  if (!raw) {
    return jsonResponse({ affixes: [], categories: [], updated_at: null });
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

export async function onRequestPost(context) {
  const { request, env } = context;

  const authResult = authenticate(request, env);
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
  if (!kv) {
    return jsonResponse({ error: 'KV 未绑定，请联系管理员' }, 500);
  }
  const data = {
    affixes: body.affixes,
    categories: Array.isArray(body.categories) ? body.categories : [],
    updated_at: new Date().toISOString(),
  };
  await kv.put(DATA_KEY, JSON.stringify(data));

  return jsonResponse({ ok: true, updated_at: data.updated_at, count: data.affixes.length });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Password',
      'Access-Control-Max-Age': '86400',
    },
  });
}
