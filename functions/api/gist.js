// Pages Functions：/api/gist 代理
// GitHub Token 读环境变量 GIST_TOKEN（Pages 项目环境变量，密文保存），前端无需携带 Token
// 访问保护：请求须携带 X-Sync-Key 头且与环境变量 SYNC_KEY 一致，否则 401
const GITHUB_API = 'https://api.github.com';
const ALLOWED_PREFIXES = ['/gists'];       // 仅放行 Gist API
const BLOCKED_METHODS = ['DELETE'];       // 禁止删 Gist，降低误删风险

function json(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/gist/, '') || '/gists';

    // 1) 同步密钥校验
    const syncKey = request.headers.get('X-Sync-Key') || '';
    if (!env.SYNC_KEY || syncKey !== env.SYNC_KEY) {
        return json({ message: '同步密钥不正确（Sync Key）' }, 401);
    }

    // 2) GitHub Token 必须配置
    if (!env.GIST_TOKEN) {
        return json({ message: '服务端未配置 GIST_TOKEN 环境变量' }, 500);
    }

    // 3) 白名单与危险方法拦截
    if (BLOCKED_METHODS.includes(request.method)) {
        return json({ message: '该代理不允许 DELETE 请求' }, 405);
    }
    const allowed = ALLOWED_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
    if (!allowed) {
        return json({ message: '仅允许访问 Gist API' }, 403);
    }

    // 4) 转发到 GitHub
    const headers = {
        'Authorization': 'Bearer ' + env.GIST_TOKEN,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'poe-affix-pages-proxy'
    };
    const init = { method: request.method, headers };
    if (request.method === 'POST' || request.method === 'PATCH') {
        init.body = await request.text();
        headers['Content-Type'] = 'application/json';
    }

    try {
        const resp = await fetch(GITHUB_API + path, init);
        const text = await resp.text();
        let body;
        try { body = JSON.parse(text); } catch (e) { body = { message: text.slice(0, 500) }; }
        if (!resp.ok) {
            const msg = (body && body.message) ? body.message : ('HTTP ' + resp.status);
            return json({ message: msg }, resp.status === 404 ? 404 : resp.status);
        }
        return json(body, 200);
    } catch (e) {
        return json({ message: '上游请求失败：' + (e.message || e) }, 502);
    }
}
