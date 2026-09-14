// 设置 Cloudflare Pages 项目环境变量（GIST_TOKEN / SYNC_KEY）
// 通过环境变量读取：
//   CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN - CF 凭据
//   GIST_TOKEN_VALUE / SYNC_KEY_VALUE             - 要写入的值（来自 GitHub secrets）
// 说明：PATCH /pages/projects/{name} 的 deployment_configs 为整体替换语义，
//       故先 GET 现有配置，保留 slot 的全部原有字段（build_image 等），
//       仅合并 env_vars；读取到的字符串型变量规范化为 {type:'plain_text'}，
//       无法回写的项（如缺 value 的 secret）跳过，避免 8000000。
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

async function main() {
    // 1. GET 现有项目配置
    const getRes = await fetch(BASE, { headers: { Authorization: 'Bearer ' + TOKEN } });
    const getJson = await getRes.json();
    if (!getJson.success) {
        console.error('获取项目失败：', JSON.stringify(getJson.errors));
        process.exit(1);
    }
    const cur = (getJson.result && getJson.result.deployment_configs) || {};
    const prodVars = Object.keys((cur.production && cur.production.env_vars) || {});
    const prevVars = Object.keys((cur.preview && cur.preview.env_vars) || {});
    console.log('现有 env_vars（production）：', prodVars.length ? prodVars.join(', ') : '(无)');
    console.log('现有 env_vars（preview）：', prevVars.length ? prevVars.join(', ') : '(无)');

    // 2. 合并环境变量：保留 slot 原有字段，只规范化 env_vars
    const inject = (slot) => {
        const out = Object.assign({}, slot || {});
        const read = (slot && slot.env_vars) || {};
        const envVars = {};
        for (const key of Object.keys(read)) {
            const v = read[key];
            if (typeof v === 'string') {
                envVars[key] = { type: 'plain_text', value: v };
            } else if (v && typeof v === 'object' && v.value !== undefined) {
                envVars[key] = v;
            }
            // 其他（无 value 的 secret 引用等）跳过
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
