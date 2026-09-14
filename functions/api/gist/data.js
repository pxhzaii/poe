// Pages Function: /api/gist/data
// GET  -> read affix data from Gist and return JSON
// POST -> write affix data from client into Gist
//
// Environment variables (Pages project settings):
//   GIST_TOKEN  - GitHub Token (gist scope), server-side only, client never sees it
//   SYNC_KEY   - sync password, client request header X-Sync-Key must match this
//
// Gist strategy:
//   First push auto-creates a secret Gist (file: poe-affix-data.json), ID tracked via Gist description
//   Subsequent ops list user Gists, find ours by description marker
//   Data stored as plaintext JSON (Gist is secret, not public)

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
            'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key'
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
    // List all user gists, find one matching our description
    const listRes = await gh('/gists?per_page=100', 'GET', token);
    if (listRes.ok && Array.isArray(listRes.json)) {
        const found = listRes.json.find(g => g.description === GIST_DESC);
        if (found) return found.id;
    }
    // Not found, create new Gist
    const createRes = await gh('/gists', 'POST', token, {
        description: GIST_DESC,
        public: false,
        files: { [GIST_FILE]: { content: JSON.stringify({ affixes: [], updated_at: null }) } }
    });
    if (!createRes.ok || !createRes.json || !createRes.json.id) {
        throw new Error('Failed to create Gist: ' + (createRes.json && createRes.json.message ? createRes.json.message : 'HTTP ' + createRes.status));
    }
    return createRes.json.id;
}

export async function onRequest(context) {
    const { request, env } = context;

    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key'
        }});
    }

    // Sync key validation
    const clientKey = request.headers.get('X-Sync-Key');
    if (!env.SYNC_KEY || !clientKey || clientKey !== env.SYNC_KEY) {
        return json({ message: 'Invalid sync key' }, 401);
    }

    // Only allow GET and POST
    if (request.method !== 'GET' && request.method !== 'POST') {
        return json({ message: 'Only GET / POST supported' }, 405);
    }

    // Check environment variable
    if (!env.GIST_TOKEN) {
        return json({ message: 'GIST_TOKEN not configured on server' }, 500);
    }

    const token = env.GIST_TOKEN;

    try {
        const gistId = await findOrCreateGist(token);

        if (request.method === 'GET') {
            const gistRes = await gh('/gists/' + gistId, 'GET', token);
            if (!gistRes.ok) {
                return json({ message: 'Failed to read Gist: ' + (gistRes.json && gistRes.json.message ? gistRes.json.message : 'HTTP ' + gistRes.status) }, gistRes.status);
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
                return json({ message: 'Failed to write Gist: ' + (patchRes.json && patchRes.json.message ? patchRes.json.message : 'HTTP ' + patchRes.status) }, patchRes.status);
            }
            return json({ count: affixes.length, updated_at: new Date().toISOString() }, 200);
        }
    } catch (e) {
        return json({ message: 'Operation failed: ' + (e.message || e) }, 500);
    }
}
