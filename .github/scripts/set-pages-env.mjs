// 诊断 + 设置 Pages 环境变量（两种方式）：
// A. 项目级 PATCH deployment_configs（整体替换语义）
// B. 变量级 API：PATCH .../projects/{name}/env/vars  ←Cloudflare 专用接口
// 先 dump 现有 deployment_configs 结构，再依次尝试
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const GIST_TOKEN = process.env.GIST_TOKEN_VALUE;
const SYNC_KEY = process.env.SYNC_KEY_VALUE;
const PROJECT = 'poe-affix';
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}`;

if (!ACCOUNT || !TOKEN || !GIST_TOKEN || !SYNC_KEY) {
    console.error('缺少必需的环境变量');
    process.exit(1);
}

function redact(obj) {
    // 打印结构时隐藏 secret 值
    const clone = JSON.parse(JSON.stringify(obj));
    const walk = (o) => {
        for (const k of Object.keys(o || {})) {
            if (o[k] && typeof o[k] === 'object') walk(o[k]);
            else if (typeof o[k] === 'string' && o[k].length > 8) o[k] = '***';
        }
    };
    walk(clone);
    return clone;
}

async function main() {
    // 1. GET + dump 结构
    const getRes = await fetch(BASE, { headers: { Authorization: 'Bearer ' + TOKEN } });
    const getJson = await getRes.json();
    if (!getJson.success) {
        console.error('获取项目失败：', JSON.stringify(getJson.errors));
        process.exit(1);
    }
    console.log('=== deployment_configs 原始结构 ===');
    console.log(JSON.stringify(redact(getJson.result.deployment_configs), null, 2).slice(0, 2000));
    console.log('=== source ===');
    console.log(JSON.stringify(redact(getJson.result.source || {})).slice(0, 500));

    const cur = (getJson.result && getJson.result.deployment_configs) || {};

    // 2. 尝试方式 B：变量级 API（PATCH /env/vars）——若 404/405 则回退 A
    const varBody = {
        GIST_TOKEN: { type: 'secret_value', value: GIST_TOKEN },
        SYNC_KEY: { type: 'secret_value', value: SYNC_KEY }
    };
    const varRes = await fetch(BASE + '/env/vars', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(varBody)
    });
    const varJson = await varRes.json().catch(() => ({}));
    console.log('=== 方式 B（/env/vars PATCH）HTTP ' + varRes.status + ' ===');
    console.log(JSON.stringify(varJson).slice(0, 600));
    if (varJson.success) { console.log('B_SUCCESS'); return; }

    // 3. 回退方式 A：完整 deployment_configs PATCH（保留 slot 全字段）
    const inject = (slot) => {
        const out = Object.assign({}, slot || {});
        const read = (slot && slot.env_vars) || {};
        const envVars = {};
        for (const key of Object.keys(read)) {
            const v = read[key];
            if (typeof v === 'string') envVars[key] = { type: 'plain_text', value: v };
            else if (v && typeof v === 'object' && v.value !== undefined) envVars[key] = v;
        }
        envVars.GIST_TOKEN = { type: 'secret_value', value: GIST_TOKEN };
        envVars.SYNC_KEY = { type: 'secret_value', value: SYNC_KEY };
        out.env_vars = envVars;
        return out;
    };
    const body = JSON.stringify({
        deployment_configs: {
            production: inject(cur.production),
            preview: inject(cur.preview)
        }
    });
    const patchRes = await fetch(BASE, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body
    });
    const patchJson = await patchRes.json().catch(() => ({}));
    console.log('=== 方式 A（deployment_configs PATCH）HTTP ' + patchRes.status + ' ===');
    console.log(JSON.stringify(patchJson).slice(0, 600));
    if (!patchJson.success) process.exit(1);
    console.log('A_SUCCESS');
}

main().catch(e => { console.error('异常：', e.message); process.exit(1); });
