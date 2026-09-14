// Pages Function: /api/gist/data
// GET  鈫?璇诲彇 Gist 涓殑璇嶇紑鏁版嵁骞惰繑鍥?JSON
// POST 鈫?灏嗗墠绔彂鏉ョ殑璇嶇紑鏁版嵁鍐欏叆 Gist
//
// 鐜鍙橀噺锛圥ages 椤圭洰璁剧疆锛夛細
//   GIST_TOKEN  鈥?GitHub Token锛坓ist 鏉冮檺锛夛紝鏈嶅姟绔繚绠★紝鍓嶇鏃犳劅鐭?//   SYNC_KEY   鈥?鍚屾瀵嗙爜锛屽墠绔姹傚ご X-Sync-Key 蹇呴』涓庢鍖归厤
//
// Gist 绠＄悊绛栫暐锛?//   棣栨鎺ㄩ€佹椂鑷姩鍒涘缓 secret Gist锛堟枃浠跺悕 poe-affix-data.json锛夛紝ID 瀛樺湪 Gist description 涓?//   鍚庣画鎿嶄綔鍏堝垪鍑虹敤鎴?Gists锛屾寜 description 鏍囪鎵惧埌鎴戜滑鐨勬暟鎹?Gist
//   鏁版嵁鏄庢枃 JSON 瀛樺偍锛圙ist 鏈韩鏄?secret锛屼笉鍏紑锛?
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
    // 鍒楀嚭鐢ㄦ埛鎵€鏈?Gists锛屾煡鎵?description 鍖归厤鐨?    const listRes = await gh('/gists?per_page=100', 'GET', token);
    if (listRes.ok && Array.isArray(listRes.json)) {
        const found = listRes.json.find(g => g.description === GIST_DESC);
        if (found) return found.id;
    }
    // 娌℃壘鍒帮紝鍒涘缓鏂?Gist
    const createRes = await gh('/gists', 'POST', token, {
        description: GIST_DESC,
        public: false,
        files: { [GIST_FILE]: { content: JSON.stringify({ affixes: [], updated_at: null }) } }
    });
    if (!createRes.ok || !createRes.json || !createRes.json.id) {
        throw new Error('鍒涘缓 Gist 澶辫触: ' + (createRes.json && createRes.json.message ? createRes.json.message : 'HTTP ' + createRes.status));
    }
    return createRes.json.id;
}

export async function onRequest(context) {
    const { request, env } = context;

    // CORS 棰勬
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key'
        });
    }

    // 鍚屾瀵嗙爜鏍￠獙
    const clientKey = request.headers.get('X-Sync-Key');
    if (!env.SYNC_KEY || !clientKey || clientKey !== env.SYNC_KEY) {
        return json({ message: '瀵嗙爜涓嶆纭? }, 401);
    }

    // 浠呭厑璁?GET 鍜?POST
    if (request.method !== 'GET' && request.method !== 'POST') {
        return json({ message: '浠呮敮鎸?GET / POST' }, 405);
    }

    // 鐜鍙橀噺妫€鏌?    if (!env.GIST_TOKEN) {
        return json({ message: '鏈嶅姟绔湭閰嶇疆 GIST_TOKEN' }, 500);
    }

    const token = env.GIST_TOKEN;

    try {
        const gistId = await findOrCreateGist(token);

        if (request.method === 'GET') {
            const gistRes = await gh('/gists/' + gistId, 'GET', token);
            if (!gistRes.ok) {
                return json({ message: '璇诲彇 Gist 澶辫触: ' + (gistRes.json && gistRes.json.message ? gistRes.json.message : 'HTTP ' + gistRes.status) }, gistRes.status);
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
                return json({ message: '鍐欏叆 Gist 澶辫触: ' + (patchRes.json && patchRes.json.message ? patchRes.json.message : 'HTTP ' + patchRes.status) }, patchRes.status);
            }
            return json({ count: affixes.length, updated_at: new Date().toISOString() }, 200);
        }
    } catch (e) {
        return json({ message: '鎿嶄綔澶辫触: ' + (e.message || e) }, 500);
    }
}
