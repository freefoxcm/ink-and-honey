"use strict";

const BOARD = Object.freeze({ width: 900, height: 560, ground: 478 });

const PALETTES = {
  morning: { sky: "#f6e9b9", horizon: "#e5ebc5", far: "#c3d4a9", near: "#a8c397", meadow: "#e4cd84", grass: "#8da575", soil: "#bc9158", deep: "#9a723f" },
  spring: { sky: "#e9eed3", horizon: "#d6e9da", far: "#b0d0ba", near: "#7fae9b", meadow: "#d9d59b", grass: "#799f80", soil: "#a68663", deep: "#796f52" },
  noon: { sky: "#fae8c0", horizon: "#faefcf", far: "#d8d2a1", near: "#bac48c", meadow: "#e7cb7d", grass: "#a3ac70", soil: "#bc8a57", deep: "#997353" },
  wind: { sky: "#e1eddb", horizon: "#e8efda", far: "#b6cebc", near: "#9bb9aa", meadow: "#ccd597", grass: "#7f9f80", soil: "#9a8b63", deep: "#6d785b" },
  apricot: { sky: "#f7dfbf", horizon: "#f6ebc7", far: "#d7c8a8", near: "#bab68a", meadow: "#e4c88a", grass: "#a3a472", soil: "#ba8e69", deep: "#996e55" },
  dusk: { sky: "#dee3e2", horizon: "#efe6d7", far: "#bdc1b9", near: "#a8b2a4", meadow: "#cccf9d", grass: "#879b7c", soil: "#a58d72", deep: "#817661" },
};

const LEVELS = [
  {
    name: "第一道防线", theme: "晴日花田", palette: "morning", time: 6, ink: 520,
    copy: "让墨线两端接到草地，蜜蜂就绕不进来了。",
    hint: "沿虚线画出拱门，两端接到草地。",
    dogs: [{ x: 476, y: 443 }], hives: [{ x: 234, y: 193, count: 6 }],
    boxes: [],
    guide: [[401, 478], [406, 419], [426, 389], [451, 375], [482, 372], [511, 384], [535, 412], [546, 445], [548, 478]],
    gold: 305, silver: 410,
  },
  {
    name: "高台上的汪", theme: "苔草山坡", palette: "spring", time: 6.5, ink: 445,
    copy: "小狗在高台上。把高台当作防线的一部分。",
    hint: "从平台的一侧起笔，绕过头顶后接回平台。",
    dogs: [{ x: 647, y: 335 }], hives: [{ x: 305, y: 326, count: 8 }],
    boxes: [{ x: 531, y: 370, w: 235, h: 28 }, { x: 115, y: 412, w: 150, h: 66 }],
    guide: [[578, 373], [579, 328], [600, 287], [626, 273], [659, 273], [690, 291], [708, 328], [713, 373]],
    gold: 265, silver: 350,
  },
  {
    name: "两面来蜂", theme: "双蜂山谷", palette: "noon", time: 7, ink: 402,
    copy: "两边的蜂巢都会出动。留意防线另一侧的缺口。",
    hint: "从小狗的一边绕到另一边，落笔处也要封住。",
    dogs: [{ x: 450, y: 443 }], hives: [{ x: 168, y: 204, count: 5 }, { x: 745, y: 249, count: 6 }],
    boxes: [{ x: 123, y: 433, w: 123, h: 45 }, { x: 692, y: 416, w: 139, h: 62 }],
    guide: [[381, 478], [382, 427], [399, 390], [427, 375], [457, 374], [485, 386], [506, 413], [518, 446], [519, 478]],
    gold: 273, silver: 340,
  },
  {
    name: "有风的桥", theme: "东风坡", palette: "wind", time: 7.5, ink: 405, wind: 46,
    copy: "风会把蜜蜂吹向两侧。桥下的蜜蜂也能飞上来。",
    hint: "桥是实心的，把线的两端接到桥面上。",
    dogs: [{ x: 470, y: 309 }], hives: [{ x: 265, y: 401, count: 7 }, { x: 673, y: 186, count: 6 }],
    boxes: [{ x: 363, y: 344, w: 213, h: 30 }, { x: 747, y: 425, w: 112, h: 53 }],
    guide: [[401, 347], [404, 301], [425, 263], [449, 246], [484, 245], [510, 261], [531, 297], [538, 347]],
    gold: 267, silver: 338,
  },
  {
    name: "双汪集合", theme: "杏色草原", palette: "apricot", time: 8, ink: 627,
    copy: "这次要保护两只小狗。它们可以共用一条防线。",
    hint: "画一座大一点的拱门，把两只小狗都罩住。",
    dogs: [{ x: 333, y: 443 }, { x: 552, y: 443, brown: true }],
    hives: [{ x: 175, y: 274, count: 7 }, { x: 738, y: 228, count: 7 }],
    boxes: [],
    guide: [[266, 478], [267, 419], [293, 382], [345, 365], [440, 362], [541, 365], [591, 383], [618, 418], [621, 478]],
    gold: 480, silver: 555,
  },
  {
    name: "黄昏大营救", theme: "月升花谷", palette: "dusk", time: 9, ink: 575, wind: 68,
    copy: "三座蜂巢、两只小狗。用一笔和横桥封住所有来路。",
    hint: "把横桥当作防线的底边，两只小狗一起围起来。",
    dogs: [{ x: 347, y: 329, brown: true }, { x: 552, y: 329 }],
    hives: [{ x: 157, y: 232, count: 7 }, { x: 741, y: 193, count: 7 }, { x: 715, y: 422, count: 6 }],
    boxes: [{ x: 247, y: 364, w: 410, h: 31 }, { x: 87, y: 425, w: 130, h: 53 }],
    guide: [[275, 366], [275, 308], [297, 273], [343, 254], [448, 249], [548, 253], [600, 274], [626, 306], [629, 366]],
    gold: 459, silver: 543,
  },
];
