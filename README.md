# 涩谷雨夜漫游 · Shibuya Rain Walk

在浏览器里漫游东京涩谷：八公口的十字路口、能推门进去的便利店、SHIBUYA SKY 屋顶的落日扶梯，三种时段（落日 / 夜景 / 雨夜）。日系动画画风（描边、平涂），Three.js 实时渲染，不用游戏引擎。

整个项目是用 **Claude Code（Claude Opus 5.5）vibecoding** 做出来的：我负责说想要什么感觉、挑毛病，代码全部由 AI 编写，前后改了十七轮。

> ⚠️ 这是一个**半成品**。很多地方还没做完（见文末「已知问题」），欢迎大家拿去继续完善。

A browser walk through Shibuya, Tokyo — the Scramble Crossing, a convenience store you can walk into, and the sunset escalator on the SHIBUYA SKY rooftop, in three times of day. Anime-style rendering with three.js, no game engine. Built entirely by vibecoding with Claude Code (Claude Opus 5.5). Work in progress.

## 运行

需要 [Node.js](https://nodejs.org) 18 或以上，不需要 `npm install`，不需要联网。

```bash
node night/serve.cjs
```

然后用 **Chrome / Edge** 打开 <http://127.0.0.1:8852/night/>。

macOS 也可以直接双击 `打开涩谷.command`。

建议用 Chrome 内核的浏览器，Safari 还没测过（可能出现整块黑或白）。首次加载约 200 MB 模型和数据，需要等一会儿。

## 操作

- 开始界面选时段和出发点：「乘落日扶梯（直达屋顶）」或「从街头出发」
- 鼠标或方向键转视角（鼠标锁不住时按住拖动），滚轮拉远拉近
- **W A S D** 走，按住 **Shift** 跑
- **E** 进门 / 乘扶梯，**C** 乘梯时换镜头，**V** 第一人称
- **T** 换时段（落日 / 夜景 / 雨夜），雨夜时 **J** 下雨 / 雨停
- **1–5** 换地方，**0** 回起点，**M** 静音，**Esc / P** 暂停
- **R** 开始 / 停止录屏（只录画面和场景声音，自动下载）

## 可选：换上 Mixamo 动作

仓库里自带的动作是 Quaternius 的 Universal Animation Library（CC0）。原版主角的走路、跑步、转身、起步、停步、推门用的是 Adobe Mixamo 的动作，按 Mixamo 的条款不能随仓库分发，想要更自然的动作可以自己下载：

1. 登录 [Mixamo](https://www.mixamo.com)，搜索下面的动作，下载时选 **FBX Binary、Without Skin、30 fps**，走路和跑步勾选 **In Place**。
2. 按下表改名，放进 `night/assets/anim/`，刷新页面即可。缺哪个就自动用自带动作代替，不会报错。

| 文件名 | 用途 | 建议搜索 |
|---|---|---|
| `mixamo-walk-male.fbx` | 主角和男路人走路 | Walking |
| `mixamo-walk-female.fbx` | 女路人走路 | Female Walk |
| `mixamo-run-male.fbx` | 主角跑步 | Running |
| `mixamo-turn-left.fbx` / `mixamo-turn-right.fbx` | 原地左转 / 右转 | Left Turn / Right Turn |
| `mixamo-walk-start.fbx` / `mixamo-walk-stop.fbx` | 起步 / 停步 | Start Walking / Stop Walking |
| `mixamo-door-inwards.fbx` | 推门 | Opening Door |

转身、起步、停步、推门四组要全部放齐才会启用。

## 目录

```
night/
  index.html        开始界面和页面入口
  serve.cjs         本地只读服务
  src/              全部场景代码（Three.js）
    main.js         总控：画面、镜头、走路、乘梯、开始界面
    layout.js city.js ground.js street.js landmarks.js   路口、楼、地面、街道、地标（按真实地图）
    farcity.js      远处的东京：4231 栋 30 米以上的高楼、主干道、铁路、绿地、226 万个灯点
    nearsigns.js signs.js screens.js   近处楼的招牌、楼名、路口大屏
    konbini.js packs.js                能走进去的便利店和货架商品
    rain.js ripples.js glassrain.js umbrella.js   雨丝、水纹、玻璃上的雨珠、伞
    skystage.js skygallery.js crosslight.js       SHIBUYA SKY 屋顶、46F 回廊、探照灯
    avatar.js retarget.js moves.js outfit/        主角（VRM）、动作重定向、衣服
    crowd.js townsfolk.js traffic.js              行人和车流
    timeofday.js sky.js audio.js                  时段、天空、声音（全部程序合成）
  data/             从 OpenStreetMap 导出的地图数据
  tools/bake-*.cjs  把 OpenStreetMap 原始数据压成 data/ 里场景用的格式
  assets/           人物模型（VRM）和动作
  docs/research/    做之前查的资料（近处楼灯、SHIBUYA SKY 屋顶和室内）
vendor/             three.js、three-vrm
```

## 素材与许可 / Assets & licenses

- **代码**：MIT，见 `LICENSE`。
- **地图数据**（`night/data/`）：© [OpenStreetMap](https://www.openstreetmap.org/copyright) 贡献者，按 [ODbL](https://opendatacommons.org/licenses/odbl/) 授权。基于这些数据再分发时，请保留来源说明并沿用 ODbL。
- **人物模型**（`night/assets/avatar/`、`night/assets/npc/`）：陆叁昧用 VRoid Studio 制作。按 [VRM 1.0 许可](https://vrm.dev/licenses/1.0/)：可以再分发、可以修改；仅限个人非商业使用；使用时请署名「陆叁昧」。
- **动作**（`night/assets/anim/ual-standard.glb`）：Quaternius「Universal Animation Library」，CC0。
- **three.js**、**three-vrm**：MIT，许可证在 `vendor/` 里。
- 声音全部由代码实时合成，没有使用音频素材。
- 招牌、广告、店名（如便利店「HACHI MART」）大多是编的；地标和楼名用的是真实名称，仅用于还原街景，与相关公司无关。

## 已知问题

- 只在 Chrome 内核浏览器里测过，Safari、Firefox 未验证。
- 全城共用的文字贴图已经放满，便利店的部分标签和海报是空白的。
- 车、树、行人的样式重复较多；行人没有实时影子。
- 46F 回廊的布局是按官网示意图和照片推测的。
- 对电脑性能要求较高，笔记本上可能卡顿。

---

做这个项目时和 AI 说过的关键几句话，整理成了一张图，发在了抖音粉丝群「AI手搓实验室」里。
