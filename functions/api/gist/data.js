// Pages Function: /api/gist/data
// GET  → 读取 Gist 中的词缀数据并返回 JSON
// POST → 将前端发来的词缀数据写入 Gist
//
// 环境变量（Pages 项目设置）：
//   GIST_TOKEN  — GitHub Token（gist 权限），服务端保管，前端无感知
//
// Gist 管理策略：
//   首次推送时自动创建 secret Gist（文件名 poe-affix-data.json），ID 存在 Gist description 中
//   后续操作先列出用户 Gists，按 description 标记找到我们的数据 Gist
//   数据明文 JSON 存储（Gist 本身是 secret，不公开）

const GITHUB_API = 'https://api.github.com';
const GIST_FILE = 'poe-affix-data.json';
const GIST_DESC = 'poe-affix-cloud-sync-do-not-delete';

function json(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

async function gh(path, method, token, body) {
    const headers = {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'poe-affix-pages-function'
    };
    const init = { method, headers };
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }
    const resp = await fetch(GITHUB_API + path, init);
    const text = await resp.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch (e) {}
    return { ok: resp.ok, status: resp.status, json: parsed, text };
}

async function findOrCreateGist(token) {
    // 列出用户所有 Gists，查找 description 匹配的
    const listRes = await gh('/gists?per_page=100', 'GET', token);
    if (listRes.ok && Array.isArray(listRes.json)) {
        const found = listRes.json.find(g => g.description === GIST_DESC);
        if (found) return found.id;
    }
    // 没找到，创建新 Gist
    const createRes = await gh('/gists', 'POST', token, {
        description: GIST_DESC,
        public: false,
        files: { [GIST_FILE]: { content: JSON.stringify({ affixes: [], updated_at: null }) } }
    });
    if (!createRes.ok || !createRes.json || !createRes.json.id) {
        throw new Error('创建 Gist 失败: ' + (createRes.json && createRes.json.message ? createRes.json.message : 'HTTP ' + createRes.status));
    }
    return createRes.json.id;
}

export async function onRequest(context) {
    const { request, env } = context;

    // CORS 预检
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }});
    }

    // 仅允许 GET 和 POST
    if (request.method !== 'GET' && request.method !== 'POST') {
        return json({ message: '仅支持 GET / POST' }, 405);
    }

    // 环境变量检查
    if (!env.GIST_TOKEN) {
        return json({ message: '服务端未配置 GIST_TOKEN' }, 500);
    }

    const token = env.GIST_TOKEN;

    try {
        const gistId = await findOrCreateGist(token);

        if (request.method === 'GET') {
            const gistRes = await gh('/gists/' + gistId, 'GET', token);
            if (!gistRes.ok) {
                return json({ message: '读取 Gist 失败: ' + (gistRes.json && gistRes.json.message ? gistRes.json.message : 'HTTP ' + gistRes.status) }, gistRes.status);
            }
            const file = gistRes.json.files && gistRes.json.files[GIST_FILE];
            if (!file || !file.content) {
                return json({ affixes: [], updated_at: null });
            }
            const data = JSON.parse(file.content);
            return json(data, 200);
        }

        if (request.method === 'POST') {
            const reqBody = await request.json();
            const affixes = Array.isArray(reqBody.affixes) ? reqBody.affixes : [];
            const content = JSON.stringify({
                affixes: affixes,
                updated_at: new Date().toISOString()
            });
            const patchRes = await gh('/gists/' + gistId, 'PATCH', token, {
                files: { [GIST_FILE]: { content } }
            });
            if (!patchRes.ok) {
                return json({ message: '写入 Gist 失败: ' + (patchRes.json && patchRes.json.message ? patchRes.json.message : 'HTTP ' + patchRes.status) }, patchRes.status);
            }
            return json({ count: affixes.length, updated_at: new Date().toISOString() }, 200);
        }
    } catch (e) {
        return json({ message: '操作失败: ' + (e.message || e) }, 500);
    }
}
