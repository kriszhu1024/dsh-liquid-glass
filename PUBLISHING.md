# 发布到 GitHub —— 操作说明

这份是给**仓库作者**看的。插件使用者看 [README.md](README.md)。

---

## 一、发布前检查

署名和仓库地址**已经填好**（`kriszhu1024`）：

| 文件 | 现在的内容 |
|---|---|
| [`LICENSE`](LICENSE) | `Copyright (c) 2026 kriszhu1024` |
| [`package.json`](package.json) | `author` / `repository` / `homepage` / `bugs` 全部指向 `kriszhu1024/dsh-liquid-glass` |
| [`README.md`](README.md) | 安装命令写成 `github:kriszhu1024/dsh-liquid-glass` |

确认没有漏网的占位符（没有输出就是干净的）：

```bash
grep -rn "<your" . ; echo "(以上无输出 = 已填完)"
```

想换成别的显示名（真名 / 其它 ID），改上面那三处即可；**仓库名如果不叫 `dsh-liquid-glass`**，记得同步改 `package.json` 里的三个 URL、`cordis.patch.yml` 不用动（它引用的是包名，不是仓库名）。

**可选但强烈建议**：放一张效果截图。新建 `docs/` 目录放 `screenshot.png`，然后把 `README.md` 顶部那段注释里的图片行取消注释：

```markdown
![screenshot](docs/screenshot.png)
```

截图请用深色模式（本插件的深色效果最完整）。

## 二、本地自检

```bash
node --check client.js      # Client 半边语法
node --check index.js       # Host 半边语法
node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8"));console.log("manifest ok")'
```

CSS 是写在 `client.js` 里的模板字符串，语法检查覆盖不到，检查它的花括号是否配平：

```bash
node -e 'const c=require("fs").readFileSync("client.js","utf8").match(/const STYLES = `([\s\S]*?)`;/)[1];
const o=(c.match(/\{/g)||[]).length,x=(c.match(/\}/g)||[]).length;
console.log("css braces",o,x,o===x?"balanced OK":"UNBALANCED")'
```

> ⚠️ `client.js` 里的样式表是模板字符串，**注释和 CSS 里都不能出现反引号 `` ` ``**，否则整个文件语法直接崩。改代码时注意。

最后在本地装一遍验收（让 DSH 里的 Agent 用 `plugin_manager` → `install_bundle`，target 填本目录的绝对路径），确认 `application: "applied"`，页面效果正常，再去推。

## 三、建仓库并推送

先在 GitHub 网页上建一个**空仓库**（不要勾选初始化 README / .gitignore / License），名字建议 `dsh-liquid-glass`。

然后：

```bash
cd /path/to/dsh-liquid-glass

git init -b main
git add -A
git commit -m "feat: liquid-glass surfaces for the DSH Web UI"

# 把 kriszhu1024 换成你的 GitHub 用户名
git remote add origin https://github.com/kriszhu1024/dsh-liquid-glass.git
git push -u origin main
```

如果你装了 `gh` CLI，可以跳过网页建仓库：

```bash
gh repo create dsh-liquid-glass --public --source=. --remote=origin --push
```

## 四、打 tag / 发 Release（可选）

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

在 GitHub 的 Releases 页面基于这个 tag 发一个 Release，把这一版的效果和调参说明贴进去。带 tag 的版本别人还能这样装：

```
github:kriszhu1024/dsh-liquid-glass#v0.1.0
```

## 五、别人怎么装

README 里已经写了三条路径（Agent + `plugin_manager`、clone 后按路径装、`dsh plugin install`）。把 README 最上面那段「安装」直接发给他们就行，一句话版本：

> 在 DSH 里对 Agent 说：用 `plugin_manager` 的 `install_bundle` 安装 `github:kriszhu1024/dsh-liquid-glass`

## 六、以后改代码怎么发新版

1. 改 `client.js`（或其它文件），本地验收（第二步那套检查 + 装一遍看效果）；
2. `package.json` 里 `version` 升一位；
3. 提交、推送、打新 tag：

```bash
git add -A
git commit -m "fix: ..."
git tag -a v0.1.1 -m "v0.1.1"
git push && git push origin v0.1.1
```

别人升级：设置 → 插件里重新装一次，或卸载后装新版。

## 七、关于发 npm（一般不需要）

`package.json` **没有** `private` 字段，所以 `npm publish` 是能推上去的 —— 如果你不打算发 npm，就别执行这个命令，免得占掉包名。真要发的话建议改成带 scope 的名字（例如 `@kriszhu1024/dsh-liquid-glass`）并在 `package.json` 里加 `"publishConfig": { "access": "public" }`。

## 八、别把不该推的东西推上去

`.gitignore` 已经挡掉了 `node_modules/`、`.DS_Store`、`*.log`、`.plugin-manager/`。

**特别注意**：你的 DSH profile 目录（`~/.dsh/profiles/<profile>/`）里有你的账号凭据和会话记录，**绝对不要**复制进仓库。这个仓库只需要上面那 6 个文件。
