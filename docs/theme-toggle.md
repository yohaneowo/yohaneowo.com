# 深浅色切换的圆形扩散动画

顶栏右上角的切换按钮（`src/components/mode-toggle.tsx`，样式在 `src/app/globals.css` 末尾）：切到深色时，深色画面从按钮画圆扩散到盖满整页；切回浅色时，深色的圆缩回按钮。新出现的太阳或月亮图示同时转入。动画数值取自 [Lucian UX/UI Prompt #219](https://lucianlabs.dev/uxui-prompt/#219)（MIT，档案顶端保留授权注释）：圆 0.7 秒、`cubic-bezier(.65,0,.35,1)`；图示 0.6 秒、`cubic-bezier(.3,1.4,.5,1)` 带一点回弹。

## 怎么做的

原版示范是一张小卡片，浅色、深色各做一份叠在一起，再用圆形遮罩露出深色那份。整个网站不能复制两份，所以改用浏览器的 View Transitions API：

1. `document.startViewTransition()` 先拍一张目前画面的快照（旧主题）。
2. 回调里用 `flushSync(() => setTheme(next))` 切主题。next-themes 是在 effect 里改 `<html>` 的 class，`flushSync` 让它在浏览器拍新画面之前就生效。
3. 浏览器把新旧两张快照叠起来（`::view-transition-old(root)`、`::view-transition-new(root)`），`transition.ready` 之后用 `root.animate(..., { pseudoElement })` 在上层那张做 `clip-path: circle()`：
   - 切到深色：新画面（深色）在上层，圆从 0 扩到盖住最远的角落。
   - 切回浅色：旧画面（深色）在上层（`globals.css` 给它 `z-index: 1`），圆从全满缩回 0。
4. `globals.css` 关掉浏览器默认的淡入淡出（`animation: none`、`mix-blend-mode: normal`），只在 `<html data-theme-reveal>` 期间生效，不影响别的 view transition。
5. 图示的转入动画挂在 `<html data-theme-turn>` 上，这个属性在回调里才设，所以旧画面的快照里图示是静止的。

圆心是按钮中心，键盘操作也一样。浏览器不支援 View Transitions，或系统开了「减少动态效果」，就直接切换，没有圆、图示也不转。

## 曾经的闪屏（2026-10-19）

**症状**：浅转深时，偶尔先闪一下全黑，圆才开始扩散。Edge、Chrome、Safari 都会；同一页第一次切换正常，来回切过之后才会出现，所以看起来「不是每次」。

**原因**：圆的动画用 `fill: "forwards"` 停在最后一格，等 view transition 结束。但动画对象在 transition 结束后不会自己消失。切回浅色时，旧画面的圆缩到 0 并停在那里；下一次浅转深，浏览器建立新的 `::view-transition-old(root)`，这个残留的「缩成 0」就套到它身上，旧画面从一开始就看不见，露出最底下的画布（那时已是深色，所以是一片黑），接着新画面的圆才扩散出来。

**修法**：`cancelRevealAnimations()` 在每次切换结束后，以及开始新的切换前，取消所有 `pseudoElement` 以 `::view-transition` 开头的动画。

**为什么一开始查不到**：

- 测试用的无头 Edge 默认用 CPU 绘图，残留的动画在那种模式下不会显现；用户的浏览器用显卡合成才会。
- 测试脚本每轮切换前都重新整理页面，永远只测到「第一次切换」。

照着「同一页连续切换」加「开显卡」重测，才在本机重现：从第二次浅转深起，开头有十几帧是空白。

**试过但无效、已拿掉的修改**（留着记录，免得以后再试一次）：

| 试过的修改                                                     | 结果                                         |
| -------------------------------------------------------------- | -------------------------------------------- |
| 新画面第一帧就先用 CSS 遮成零半径的圆，不等 `ready`            | 无效，闪的不是新画面                         |
| 动画层最底下垫旧主题的底色                                     | 黑闪变成白闪，证实是旧画面没显示，但没修好   |
| 只改 `<html>` 的 class、不在回调里重画 React；回调先等 50 毫秒 | 都一样闪，跟回调花多久无关                   |
| 浅转深改成旧画面在上层、用遮罩挖一个扩大的圆洞                 | 残留动画让旧画面一开始就缩成 0，圆整个看不见 |
| 不用快照，叠一层纯色圆扩散后再切主题                           | 不会闪，但圆里看不到深色页面，用户不要       |

## 以后改这里要注意

- 在 view transition 的伪元素上跑的动画（`root.animate(..., { pseudoElement: "::view-transition-…" })`），用完一定要 `cancel()`，尤其是 `fill: "forwards"` 的。
- 测这类闪烁要开显卡、逐帧录，并且在同一页连续操作，不要每轮重新整理。做法见记忆里的 browser-checks（Edge 加 `--enable-gpu --use-angle=d3d11 --ignore-gpu-blocklist --enable-gpu-rasterization`，CDP `Page.startScreencast` 录每一帧，算每帧的深色像素比例）。
- CoinHub 的 K 线图颜色是图表自己在主题改变后重画的，切换时图表区可能慢一拍才换色。
