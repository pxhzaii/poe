# POE 词缀库（lfzl.html）

流放之路（POE）词缀速查工具。单文件应用，双击即用，零依赖，数据保存在本地浏览器。

> 老版本（Cloudflare KV Worker 同步）已弃用，现改为 **GitHub Gist + AES 加密** 云同步，无需部署任何服务端。

## 功能

- 词缀卡片：名称与数值并列显示，点击任意一个即可复制
- 分类完全自定义：如「负电甲/召唤衣」「法血/戒指」，随意增删
- 本地持久化：数据自动存 localStorage
- 导入导出：JSON 格式，Excel/表格软件友好
- 云端同步：GitHub Gist + AES-256-GCM 加密，密文上云，无密码不可读

## 使用方法

1. 下载本仓库的 `index.html`，双击用浏览器打开即可使用
2. 添加词缀：点击右上角「添加词缀」→ 填分类、名称、数值 → 保存
3. 点击卡片上的名称或数值即可复制到剪贴板

## 云同步（Gist + AES 加密）

多台电脑之间同步词缀库：

1. 点击右上角「☁️ Gist 云同步」打开面板
2. 填写三项配置：
   - **GitHub Token**：需要 `gist` 权限（Settings → Developer settings → Personal access tokens → 生成）
   - **Gist ID**：首次留空，推送时自动创建并回填
   - **加密密码**：自定，用于 AES 加密，拉取/推送都需要
3. 点击「💾 保存配置」
4. 「⬆️ 推送到云端」上传加密数据；换电脑后「⬇️ 从云端拉取」恢复

### 安全说明

- 数据使用 PBKDF2-SHA256（10 万次迭代）从密码派生密钥，AES-256-GCM 加密
- Gist 上只存密文（secret Gist），没有密码无法解密
- Token 只在本地浏览器 localStorage 保存，不经过任何第三方服务器（直接与 GitHub API 通信）

## 数据格式

本地与 Gist 中的词缀数据结构：

```json
[
  { "id": "xxx", "category": "负电甲/召唤衣", "name": "词缀名称", "value": "数值" }
]
```

Gist 文件 `poe-affix-data.enc.json` 内容为加密信封：

```json
{ "v": 1, "salt": "...", "iv": "...", "data": "..." }
```

## 备份建议

云同步之外，建议定期「导出」JSON 文件做离线备份。
