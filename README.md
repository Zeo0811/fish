# 溪流 · River Studio

可在网页中运行的溪流场景与 Centerpin / Euro nymph 钓组模拟。源自原有 v78 HTML，独立保存为新工程。

2026-09-08 河型更新：增加宽窄断面、收窄急流、偏心深槽、冲刷潭头、潭尾、浅急滩及侧向回流。调研依据、参数意义与近似边界见 [河型说明](docs/channel-research.md)。

## 本机运行

需要 Node.js 22.12 或更高版本。

```sh
npm ci
npm run dev
```

访问终端显示的本地地址。生产模式：

```sh
npm run build
npm start
```

默认访问 `http://localhost:3000`。不要直接双击 `index.html`，模型和模块需要 HTTP 服务。

## Railway 部署

工程根目录已经包含 `Dockerfile`、`railway.json` 和 `package-lock.json`。

1. 把整个工程提交到自己的 GitHub 仓库，必须包含 `public/assets/` 中的模型、HDR、贴图和素材清单。
2. Railway 新建服务，选择该 GitHub 仓库。若工程位于仓库子目录，将 Root Directory 设置为那个子目录。
3. Railway 按 Dockerfile 执行 `npm ci` 和 `npm run build`，使用 `node server.mjs` 启动。
4. 服务读取 Railway 注入的 `PORT`，监听 `0.0.0.0`。容器默认端口为 8080，与现有 `fish.zeooo.cc` 目标端口一致。健康检查 `/healthz` 会检查双版本入口、构建 JS/CSS 和素材文件完整性。
5. 在服务 Networking 中生成域名，打开域名验证页面与模型加载。

也可以在已登录 Railway CLI、已经关联目标项目和服务的工程目录运行 `railway up`。首次关联目标需要选择自己的项目与服务。

此项目不需要数据库、Volume、API Key 或服务端 GPU。3D 渲染发生在访问者的浏览器中；Railway 负责分发页面与资源。首次访问会下载约 18 MB 的场景资源，后续可使用浏览器缓存。

部署参考：[Dockerfile](https://docs.railway.com/builds/dockerfiles)、[健康检查与 PORT](https://docs.railway.com/deployments/healthchecks)。

## 操作

- 底部操作区上方切换 Centerpin / Euro nymph，旁边显示实时漂流状态。
- 底部切换岸边、水下、俯瞰、全景；可重新抛投或暂停。
- 拖动环顾、滚轮缩放。手机可拖动和双指缩放。
- 设置中的“前往河段并抛投”可直接体验八个代表河段；“俯瞰 / 全景”可看宽窄和潭滩序列。Shift + 拖动沿河移动观察，切换视角恢复跟随。
- 右上角“设置”保留水深、流速、线组 DIY、底质与原有参数；“深度仪”显示详细数值。
- 右上角“简易版”切换到同一网站的 `/simple/`，简易版右上角“写实版”返回 `/`。切换会重新加载页面，当前漂流与临时参数不会跨版本保留。
- 设置里的“教学清晰”减弱水体遮挡并打开粒子、触底标记。
- 画质默认“均衡”，电脑可选择“精细”。复杂场景的流畅度取决于访问设备。
- “溪流实况”逐帧显示当前位置实际水深与表层水速（Centerpin 跟随浮漂，Euro 跟随末蝇），与深度仪同源；不是设置中的基准值。暂停时数值随模拟一起停止。
- 水面会随流速连续变化：缓流较平静，激流增加浪脊、石后白沫、下游拖尾与少量飞溅；暂停时停止运动，教学模式会减弱遮挡。
- 四种饵现在有独立细节：钨头/无钨头若虫的钩眼、弯钩、虫体、绕丝和尾丝，moss fly 的细纤维束，以及草饵的草茎、叶片和叶脉。水下观察细节可调整“元件视觉放大”；外观参考与近似说明见 [饵体说明](docs/bait-references.md)。
- 中鱼记录使用鱼获卡片；可展开呈现分析、场景快照和线组数据。中鱼、线组 DIY、漂流结束窗口支持 Escape 关闭与键盘焦点约束。

## 场景与模拟的边界

- 钓组动力学、约束和评分代码保持原样，并记录其 SHA-256；河床、基础流场与岸线按新河型替换，不再声称整个环境物理文件未变。
- 水下散石横向分布随湿河宽展开，生成种子与尺寸规则保持；水下石头仍按碰撞记录的中心与半径绘制。大石空间索引按半径扩展，避免网格过小漏掉边缘。
- 水下大结构用高细分碰撞轮廓与岩石 PBR 材质；岸边仍用扫描模型。小石头低多边形表面和河床网格有有限采样误差，岸边装饰不是新增可钓碰撞物。
- 沙底已替换为湿砂扫描材质，不再使用 brown_mud_02 泥土；底质切换同步改变颜色、法线和粗糙度，分区以独立权重过渡。
- 水面为实时反射、折射与波纹近似；并非离线光线追踪或完整流体求解。
- 激流水浪由局部流速、水深及石体淹没程度驱动，叠加波峰约为厘米至十余厘米级；物理浮力仍以 `y=0` 为平均水面，波峰不直接推动浮漂。本版不是完整流体求解或真实水跃模型。
- 鱼依据实物照片和形态资料重新制作了三套体型、鳍膜、鳞片凹凸、鳃盖、口裂和眼睛，详见 [参考与建模边界](docs/fish-references.md)。仍是参考引导的三维模型，不是扫描。连续摆尾、随流速调整摆动和转向仅在视觉层；鱼位与咬钩概率保留原算法。呈现评分不是现实中鱼概率，鱼重为模型估算。
- 原 v77 / v78 HTML 未被修改。工程运行不依赖其本地绝对路径。

## 工程

```text
src/simulator.js     原有模拟、线组、鱼和操作
src/world.js         3D 场景、扫描素材、光照、水面
src/channel.js       河宽、深槽、断面输水、基础回流与近底剖面
src/channel-surface.js 同源 GPU 流场与波纹旅行时间
src/channel-foam.js   随真实模型流场推进的表面泡沫
src/shell.js         视角切换、加载状态与面板
src/style.css       新界面
src/dialogs.css     统一弹窗、表单与鱼获卡片样式
src/dialogs.js      弹窗焦点与键盘操作
src/catch-view.js   中鱼记录与可展开的数据分析
src/fish-visuals.js 连续变形鱼体、纹理与物种示意图
src/water-effects.js 随流速变化的水面视觉参数
public/assets/      可直接部署的本地素材
public/simple/      简易版与其独立的 Three.js r128 依赖
server.mjs          生产静态服务器与健康检查
Dockerfile          Railway 构建与运行
tests/              求解部分校验、资源与服务器检查
```

`npm run build && npm test` 检查生产构建、物理源代码与素材完整性。`npm run test:browser` 使用独立无头 Chrome 检查场景、交互、资源请求和着色器错误；默认测试开发服务，使用 `TEST_URL` 可指定生产服务。非 macOS 可设置 `CHROME_PATH`。

开发服务运行于 5173 时，`node scripts/check-river-repair.mjs` 逐项检查 CP/Euro 重抛、改水深、DIY、两种 Euro 拓扑、暂停，以及七种底质下所有碰撞物与可见石头的一一对应和大结构实际网格顶高。深度仪现按 Node 实例重新绑定，不再仅用线组重量签名复用旧引用；切回 CP 会恢复浮漂标记。

`node scripts/check-baits.mjs` 检查四种饵在 CP/Euro 中的节点锚定、倍率、暂停、重抛与重量调整，并输出独立放大预览。每次重建线组会释放旧饵网格和材质；柔软饵体按相对水流向下游偏转。

开发服务运行于 5173 时，`node scripts/check-polish.mjs` 检查中鱼卡片、鱼体摆动、缓流/激流对比、弹窗焦点和 320/390 像素手机布局。中鱼截图使用开发专用的合成记录，测试入口在生产构建中移除，不代表自然中鱼结果。

模型、材质和环境来自 [Poly Haven](https://polyhaven.com)，均为 CC0；具体来源与文件校验在 `public/assets/credits.json`。树木经过网格简化，纹理转为 WebP，远景植被由同一模型生成低成本图像。`npm run assets:fetch` 可从公开来源准备资源，不在 Railway 构建时执行。

部署包不需要 `.asset-cache/`、`node_modules/`、测试截图或历史迁移脚本。

## 简易版来源

简易版随工程部署，来源为 [Zeo0811/fish](https://github.com/Zeo0811/fish/tree/2e7e1d66b1016d50ae07ecea165ad633bff38248) 的 `public/index.html`（2026-09-06 获取）。保留原始内联模拟脚本，只添加返回写实版的导航与配套样式、将 Three.js CDN 地址改为包内路径。Three.js r128 的 MIT 许可在 `public/simple/vendor/LICENSE-three.txt`。

部署同一个域名时，`/` 是写实版，`/simple/` 是简易版；无固定线上域名、无 token、无跨域跳转。更新服务器前务必保留 `public/simple/`。
