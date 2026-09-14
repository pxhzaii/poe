// 设置 Cloudflare Pages 项目环境变量（GIST_TOKEN / SYNC_KEY）
// 通过环境变量读取：
//   CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN - CF 凭据
//   GIST_TOKEN_VALUE / SYNC_KEY_VALUE             - 要写入的值（来自 GitHub secrets）
// 说明：Pages PATCH /pages/projects/{name} 的 deployment_configs 为整体替换语义，
//       故先 GET 现有配置合并后回写，避免丢失 production_branch 等字段。
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const GIST_TOKEN = process.env.GIST_TOKEN_VALUE;
const SYNC_KEY = process.env.SYNC_KEY_VALUE;
const PROJECT = 'poe-affix';
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}`;

if (!ACCOUNT || !TOKEN || !GIST_TOKEN || !SYNC_KEY) {
    console.error('缺少必需的环境变量（CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN/GIST_TOKEN_VALUE/SYNC_KEY_VALUE）');
    process.exit(1);
}

async function main() {
    // 1. GET 现有项目配置
    const getRes = await fetch(BASE, { headers: { Authorization: 'Bearer ' + TOKEN } });
    const getJson = await getRes.json();
    if (!getJson.success) {
        console.error('获取项目失败：', JSON.stringify(getJson.errors));
        process.exit(1);
    }
    const cur = (getJson.result && getJson.result.deployment_configs) || {};

    // 2. 合并环境变量（保留已有 env_vars，覆盖同名项）
    const inject = (slot) => {
        const envVars = Object.assign({}, (slot && slot.env_vars) || {});
        envVars.GIST_TOKEN = { type: 'secret_value', value: GIST_TOKEN };
        envVars.SYNC_KEY = { type: 'secret_value', value: SYNC_KEY };
        return { env_vars: envVars };
    };
    const body = JSON.stringify({
        deployment_configs: {
            production: inject(cur.production),
            preview: inject(cur.preview)
        }
    });

    // 3. PATCH 回写
    const patchRes = await fetch(BASE, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body
    });
    const patchJson = await patchRes.json();
    if (!patchJson.success) {
        console.error('设置环境变量失败：', JSON.stringify(patchJson.errors));
        process.exit(1);
    }
    console.log('done');
}

main().catch(e => { console.error('异常：', e.message); process.exit(1); });
