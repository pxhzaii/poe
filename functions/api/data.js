// Pages Function: /api/data
// 词缀数据读写（单密码模式 + GitHub Gist 存储）
//   GET  → 从 Gist 拉取词缀数据
//   POST → 推送词缀数据到 Gist
// 环境变量：APP_PASSWORD（验证密码）、GIST_TOKEN（GitHub token）、GIST_ID（Gist ID）

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

const GIST_FILE = 'affixes.json';

export async function onRequestGet(context) {
  const { request, env } = context;

  const authResult = authenticate(request, env);
  if (!authResult.ok) {
    return jsonResponse({ error: authResult.error }, 401);
  }

  if (!env.GIST_TOKEN || !env.GIST_ID) {
    return jsonResponse({ error: '服务端未配置 Gist 信息' }, 500);
  }

  try {
    const resp = await fetch('https://api.github.com/gists/' + env.GIST_ID, {
      headers: {
        'Authorization': 'token ' + env.GIST_TOKEN,
        'User-Agent': 'poe-affix-sync',
        'Accept': 'application/vnd.github+json',
      },
    });
    if (!resp.ok) {
      return jsonResponse({ error: 'Gist 读取失败 (HTTP ' + resp.status + ')' }, 502);
    }
    const gist = await resp.json();
    const file = gist.files && gist.files[GIST_FILE];
    if (!file || !file.content) {
      return jsonResponse({ affixes: [], categories: [], updated_at: null });
    }
    const data = JSON.parse(file.content);
    return jsonResponse({
      affixes: Array.isArray(data.affixes) ? data.affixes : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      updated_at: data.updated_at || null,
    });
  } catch (e) {
    return jsonResponse({ error: '读取失败：' + e.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const authResult = authenticate(request, env);
  if (!authResult.ok) {
    return jsonResponse({ error: authResult.error }, 401);
  }

  if (!env.GIST_TOKEN || !env.GIST_ID) {
    return jsonResponse({ error: '服务端未配置 Gist 信息' }, 500);
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

  const data = {
    affixes: body.affixes,
    categories: Array.isArray(body.categories) ? body.categories : [],
    updated_at: new Date().toISOString(),
  };

  try {
    const resp = await fetch('https://api.github.com/gists/' + env.GIST_ID, {
      method: 'PATCH',
      headers: {
        'Authorization': 'token ' + env.GIST_TOKEN,
        'User-Agent': 'poe-affix-sync',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILE]: { content: JSON.stringify(data) },
        },
      }),
    });
    if (!resp.ok) {
      return jsonResponse({ error: 'Gist 写入失败 (HTTP ' + resp.status + ')' }, 502);
    }
    return jsonResponse({ ok: true, updated_at: data.updated_at, count: data.affixes.length });
  } catch (e) {
    return jsonResponse({ error: '写入失败：' + e.message }, 500);
  }
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
