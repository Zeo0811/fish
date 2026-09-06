# 饵体外观说明

2026-09-06。钨头、无钨头若虫的外形参考 [Orvis Tunghead Pheasant Tail](https://www.orvis.com/product/tunghead-pheasant-tail/144J.html) 和 [Orvis Tungsten Torpedo 绑制资料](https://howtoflyfish.orvis.com/fly-tying-videos/nymph-flies/764-tungsten_torpedo)：以可见钩眼、弯钩、锥形虫体、珠头、绕丝、尾丝区分组成部分。不是任何商品的精确复制，也未转载商品照片或商标。

moss fly 用橄榄绿合成纤维束示意；草饵用草茎、折叠叶片及叶脉示意。原应用未给出具体配方或植物种类，不宣称它们还原了某个标准绑制配方或植物物种。

所有几何按米建模，然后沿用“元件视觉放大”1–4 倍设置。钨珠外观尺寸随既有重量参数变化；钩体、薄纤维与叶片的可读性有视觉近似。饵和纤维顺相对水流偏转，暂停时停止。饵的锚点始终对应原 Node；没有修改质量、碰撞半径、阻力或咬钩算法。

渲染：`src/bait-visuals.js`。回归：`tests/bait-visuals.test.mjs`、`scripts/check-baits.mjs`。独立放大预览仅供检查细节，不是场景中实际尺寸；`scripts/bait-preview-module.mjs` 不会被导入生产页面。
