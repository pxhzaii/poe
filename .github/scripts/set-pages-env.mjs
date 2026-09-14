// 设置 Cloudflare Pages 环境变量 GIST_TOKEN（仅一个）
// 通过环境变量读取：
//   CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN - CF 凭据
//   GIST_TOKEN_VALUE                             - GitHub Token（来自 GitHub secrets）
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const GIST_TOKEN = process.env.GIST_TOKEN_VALUE;
const PROJECT = 'poe-affix';
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}`;

if (!ACCOUNT || !TOKEN || !GIST_TOKEN) {
    console.error('缺少必需的环境变量');
    process.exit(1);
}

async function main() {
    // 用变量级 API 写入（上一轮验证此方式可用）
    const varBody = {
        GIST_TOKEN: { type: 'secret_value', value: GIST_TOKEN }
    };
    const res = await fetch(BASE + '/env/vars', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(varBody)
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) {
        console.error('设置环境变量失败：', JSON.stringify(j.errors || j));
        process.exit(1);
    }
    console.log('done');
}

main().catch(e => { console.error('异常：', e.message); process.exit(1); });
