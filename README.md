# dsh-liquid-glass

给 **DeepSeek Harness (DSH) Web UI** 的「液态玻璃」表面改造插件 —— 非官方，纯前端主题，**不修改 DSH 安装包**。

Apple-style liquid-glass surfaces for the DeepSeek Harness Web UI. A tiny Cordis client plugin: translucent window chrome, a frosted composer with a lit edge, and a specular window rim. macOS only. No changes to the DSH app bundle.

<!-- TODO: 放一张效果截图（见 PUBLISHING.md）
![screenshot](docs/screenshot.png)
-->

---

## 效果

| 表面 | 行为 |
|---|---|
| 中栏 / 右栏 / 侧边栏 | 与侧边栏同一套材质配方叠加，整窗透出 macOS 原生毛玻璃 |
| 对话输入框 | 接近实底 + `backdrop-filter` 磨砂垫层 + 顶部玻璃高光边 |
| 自己的消息气泡 | iMessage 式：**带尾巴**、轻投影、连续消息紧贴 |
| 窗口内沿 | 顶部一条亮线、底部一条淡暗线（"上亮下影"的玻璃边） |
| 设置面板 / 弹窗 / 代码预览卡 / 通用输入框 | **保持实底**（见「设计取舍」） |
| 圆角 | 可调倍率 + `superellipse` 连续圆角 |
| 控制面板 | 侧边栏底部「◐ 玻璃参数」，**12 个控件**实时调参 |

出厂默认是作者用控制面板调出来的一组：**几乎不带页面底色，直接吃系统毛玻璃**，配一支磨砂输入框和一条明亮的窗口内沿。想要一点底色回来，把「侧边栏浓度」拉到 30–60%、「对话区浓度」拉到 50% 左右即可（两者的耦合关系见「调参」）。

## 环境要求

- **macOS**：所有规则都限定在 `html[data-platform='darwin']`。装到 Windows / Linux 上不会报错，但**不会有任何视觉变化**。
- **DSH 桌面版或 Web 版**，profile 里要包含 `@deepseek-ai/dsh-web-app`（Web UI）与 `@deepseek-ai/dsh-client-ui-theme`（主题服务）。
- 验证环境：DSH `0.2.0-rc.2`（desktop profile，macOS arm64）。

## 安装

装在 DSH 的 **profile** 里，对该 profile 的**所有会话**生效，重启后依然在。

### 方式一：交给 DSH 里的 Agent（推荐）

在 DSH 里对 Agent 说：

> 用 `plugin_manager` 的 `install_bundle` 安装 `github:kriszhu1024/dsh-liquid-glass`

或用完整地址：

> 安装 `https://github.com/kriszhu1024/dsh-liquid-glass`

Agent 会调用 `plugin_manager`（`action: install_bundle`）。这一步会写 profile，所以它需要 `danger-full-access` 权限或你的批准。返回结果里 `application: "applied"` 就说明已经生效，**不需要重启**。

### 方式二：clone 到本地，按路径安装

```bash
git clone https://github.com/kriszhu1024/dsh-liquid-glass.git
```

然后让 Agent 用该目录的**绝对路径**安装：

> 用 `plugin_manager` 的 `install_bundle` 安装 `/绝对路径/dsh-liquid-glass`

本地路径装出来的是 `link:` 依赖 —— 之后你改这个目录里的 `client.js`，刷新页面就生效，不用重装。

### 方式三：`dsh` CLI（如果你机器上有）

```bash
dsh plugin install github:kriszhu1024/dsh-liquid-glass
```

命令动词以 `dsh plugin --help` 为准；插件管理能力与 `plugin_manager` 工具共用同一套实现。

### 安装之后

刷新页面（macOS 上通常是 `Cmd + R`）。如果没变化，退出并重开 DSH。

## 卸载 / 回滚

**设置 → 插件（Plugins）**里禁用或卸载 `dsh-liquid-glass` 即可。

- 颜色是叠层式的 token 覆盖，插件一撤就**精确还原**，不留痕迹；
- 不需要手动改任何配置文件。

## 调参

点侧边栏底部的「◐ 玻璃参数」（侧边栏收成 56px 窄轨时只剩图标），右下角会弹出控制面板：

| 滑轨 | 范围 | 出厂 | 作用 |
|---|---|---|---|
| 对话区浓度 | 0–100% | 6% | 中栏 / 右栏的材质浓度。**它是对「侧边栏材质」的倍率** —— 侧边栏浓度为 0 时，它调到多少都不出效果 |
| 侧边栏浓度 | 0–200% | 0% | 侧边栏材质不透明度。它同时是对话区配方的底料 |
| 输入框浓度 | 30–98% | 72% | 输入框底色不透明度 |
| 输入框模糊 | 0–60px | 37px | 输入框那层 `backdrop-filter` 垫层 |
| 卡片边缘高光 | 0–200% | 70% | 输入框顶部亮线 + 发丝 + 微光 |
| 窗口内沿高光 | 0–200% | 175% | 整窗顶部亮线 + 底部暗线 |
| 圆角大小 | 0.6–1.8× | 1.10× | 圆角倍率（基准 14 / 18 / 24 / 32 px） |
| 设置面板灰度 | 0–100% | 0% | 设置面板从官方色渐变到最深 |
| 我的气泡颜色 | 取色器 | `#007aff` | 自己发的消息气泡（同时作用于目标卡、追问卡气泡）；**文字颜色按对比度自动选黑或白** |
| 气泡尾巴 | 开关 | 开 | iMessage 式尾巴；关掉则气泡回到纯圆角（下面两项不受影响） |
| 气泡圆角 | 0.6–1.8× | 1.00× | 气泡圆角倍率（基准 `--dsw-radius-xl`） |
| 连续消息间距 | 0–12px | 2px | 连续同侧消息之间的间距（官方默认 6px） |

- 拖动**实时生效**，不用刷新；面板关掉不影响效果。
- 参数存在**本机浏览器**里（localStorage），不会跟着账号或机器走。
- 「重置」把所有值还原成上表的出厂值。
- 想改**出厂值本身**：改 [`client.js`](client.js) 里的 `DEFAULTS`（新安装与「重置」都用它）。

## 工作原理

DSH 的 macOS 窗口本身就是原生毛玻璃：主进程用 `vibrancy: 'sidebar'` + `visualEffectState: 'active'` + `backgroundColor: '#00000000'` 创建窗口。挡住它的是页面把表面画成了不透明色。所以这个插件只做两件事：

1. **token 层** —— 通过官方留给三方主题的 `ctx.theme.overrideTokens(source, { light, dark })` 接口，把 `--dsw-alias-bg-base`、`--dsw-specific-sidebar-fill` 等别名 token 换成半透明值。别名 token 必须走这条路：它们由 ui-layout 以内联样式写在 `body` 上，样式表压不过内联样式。
2. **CSS 层** —— 注入一张插件自有的样式表，做纯 CSS 做不到的事：子树级的变量覆盖（设置面板）、输入框的模糊垫层与玻璃高光、窗口内沿高光。滑轨能即时生效，是因为可调量都以 `--lg-*` 自定义属性写在 `body` 上，拖动即改变量，并用 `requestAnimationFrame` 把重绘压到每帧一次。

它**不碰** `app.asar`、不改 Electron 主进程、不改 DSH 的源码，因此不影响代码签名与自动更新。

## 设计取舍

**为什么弹窗、代码预览卡、通用输入框一律是实底？** 因为在没有模糊层的半透明表面上，背后的对话正文会**直接透上来看得清**（这是实际踩过的坑）。所以本插件的原则是：

- **有正文、要读的地方 → 实底**（设置、Modal、hover 预览、`Input` 输入框）；
- **纯背景 / 有模糊垫层的地方 → 玻璃**（列表面、侧边栏、composer）。

`--dsw-alias-bg-layer-1` 与 `-2` 因此保持官方不透明值 —— 它们被大量内容型表面共用一个 token，一动就是一片。

**气泡尾巴是照着 iMessage 量的，不是估的。** 从一张真实 iMessage 截图上逐行扫描轮廓后确认了两件反直觉的事：

1. **气泡四角保持完整圆角，尾巴是纯附加的** —— iMessage 不压平尾巴一侧的角。把角落压平再贴一个楔形，是一眼就能看出"不对劲"的常见错误做法。
2. **尾巴掖在气泡右下角**下方，从圆角弧在底边的起点开始，向下悬垂约 0.34×圆角半径，水平方向**完全不外伸**（所以不会撑出横向滚动条）。

实现上 `border-radius` 画不出它（把小方块磨圆还是方块），`mask` 挖缺口也只能得到矩形，最终用**一个 `clip-path` 楔形**：28×10 的伪元素放在 `right:0 / bottom:-10px`，路径坐标由实测轮廓按圆角比例缩放而来。

**没有抄"收到的灰气泡"。** iMessage 左侧的浅灰气泡建立在"每条都是短消息"的前提上，而 DSH 的助手内容是长文 + 工具调用卡 + 代码/diff，套上气泡会同时毁掉可读性和信息层级。这是与 iMessage 最大的、有意的分歧。

## 已知限制

- **拿不到 macOS 26 的原生 Liquid Glass 材质**：Electron 的 `vibrancy` 只暴露 `NSVisualEffectMaterial` 那一组固定名字（`sidebar` / `under-window` / `hud` …），插件无法更换窗口材质。这里做到的是"用系统毛玻璃 + 页面级模拟"，不是系统材质本体。
- **`backdrop-filter` 模糊不了原生 vibrancy**：Chromium 只能采样页面像素。所以"模糊桌面壁纸"由系统提供，"模糊页面内容"才由本插件的 CSS 提供。
- **依赖若干官方命名约定**（已在注释中标注）：`--dsw-*` token 名、`data-composer-card` 属性、`sidebar.settings` 槽位名、类名后缀 `_centerCol` / `_rightbarCol` / `_frame`、`body[data-ds-dark-theme]`。DSH 大版本升级后若某一块突然失效，大概率是这里变了。
- **profile 级生效**：影响该 profile 的所有会话（这是 DSH 插件体系的固有语义）。

## 目录结构

```
.
├── package.json        # bundle + dsh.client 声明
├── cordis.patch.yml    # Loader 插入行
├── index.js            # Host 半边（空实现，UI 全在 Client 半边）
├── client.js           # 全部效果：token 覆盖 + 样式表
├── LICENSE
└── README.md
```

## 许可与免责

MIT，见 [LICENSE](LICENSE)。

本项目是非官方第三方插件，与 DeepSeek 官方无关，也未获得其背书。插件直接作用于你的 DSH profile，请自行评估风险；卸载即可完全还原。
