"use strict";

const BOARD = Object.freeze({ width: 900, height: 560, ground: 478 });

const PALETTES = {
  morning: { sky: "#f6e9b9", horizon: "#e5ebc5", far: "#c3d4a9", near: "#a8c397", meadow: "#e4cd84", grass: "#8da575", soil: "#bc9158", deep: "#9a723f" },
  spring: { sky: "#e9eed3", horizon: "#d6e9da", far: "#b0d0ba", near: "#7fae9b", meadow: "#d9d59b", grass: "#799f80", soil: "#a68663", deep: "#796f52" },
  noon: { sky: "#fae8c0", horizon: "#faefcf", far: "#d8d2a1", near: "#bac48c", meadow: "#e7cb7d", grass: "#a3ac70", soil: "#bc8a57", deep: "#997353" },
  wind: { sky: "#e1eddb", horizon: "#e8efda", far: "#b6cebc", near: "#9bb9aa", meadow: "#ccd597", grass: "#7f9f80", soil: "#9a8b63", deep: "#6d785b" },
  apricot: { sky: "#f7dfbf", horizon: "#f6ebc7", far: "#d7c8a8", near: "#bab68a", meadow: "#e4c88a", grass: "#a3a472", soil: "#ba8e69", deep: "#996e55" },
  dusk: { sky: "#dee3e2", horizon: "#efe6d7", far: "#bdc1b9", near: "#a8b2a4", meadow: "#cccf9d", grass: "#879b7c", soil: "#a58d72", deep: "#817661" },
  canyon: { sky: "#f3d7b4", horizon: "#f3e4c3", far: "#d6bbb0", near: "#bdab8e", meadow: "#e2c18c", grass: "#9a9a70", soil: "#ae805c", deep: "#845f4b" },
};

const LEGACY_LEVELS = [
  {
    id: "first-shelter", name: "第一道防线", theme: "晴日花田", palette: "morning", ink: 340,
    copy: "松手后墨线会落下。让拱门两脚踩稳草地，才能挡住蜂群。",
    hint: "让两端都踩到草地，拱门就不容易被撞翻。",
    dogs: [{ x: 476, y: 443 }], hives: [{ x: 234, y: 193, count: 6 }],
    boxes: [],
    guide: [[401, 478], [406, 419], [426, 389], [451, 375], [482, 372], [511, 384], [535, 412], [546, 445], [548, 478]],
    gold: 265, silver: 300,
  },
  {
    id: "lookout", name: "高台上的汪", theme: "苔草山坡", palette: "spring", ink: 305,
    copy: "高台右侧留给防线的位置很窄，画太宽容易滑出去。",
    hint: "右脚离台边远一点，让它被推滑时还有落脚处。",
    dogs: [{ x: 647, y: 335 }], hives: [{ x: 305, y: 326, count: 8 }],
    boxes: [{ x: 531, y: 370, w: 205, h: 28 }, { x: 115, y: 412, w: 150, h: 66 }],
    guide: [[578, 364], [579, 328], [600, 287], [626, 273], [659, 273], [690, 296], [699, 333], [701, 364]],
    gold: 245, silver: 275,
  },
  {
    id: "two-hives", name: "两面来蜂", theme: "双蜂山谷", palette: "noon", ink: 315,
    copy: "两边的蜂巢都会出动。留意防线另一侧的缺口。",
    hint: "从小狗的一边绕到另一边，落笔处也要封住。",
    dogs: [{ x: 450, y: 443 }], hives: [{ x: 168, y: 204, count: 5 }, { x: 745, y: 387, count: 6 }],
    boxes: [{ x: 123, y: 433, w: 123, h: 45 }, { x: 387, y: 425, w: 43, h: 53 }, { x: 692, y: 416, w: 139, h: 62 }],
    guide: [[381, 478], [382, 427], [399, 390], [427, 375], [457, 374], [485, 386], [506, 413], [518, 446], [519, 478]],
    gold: 265, silver: 298,
  },
  {
    id: "wind-bridge", name: "有风的桥", theme: "东风坡", palette: "wind", ink: 320, wind: { mode: "steady", strength: -46 },
    copy: "强风把蜜蜂向左吹。桥下的蜜蜂也能飞上来。",
    hint: "右脚搭在桥面挡块的外侧，把桥下的来路一起封住。",
    dogs: [{ x: 470, y: 309 }], hives: [{ x: 265, y: 401, count: 7, wave: 1 }, { x: 673, y: 186, count: 6, wave: 0 }],
    boxes: [{ x: 363, y: 344, w: 213, h: 30 }, { x: 502, y: 301, w: 31, h: 43 }, { x: 747, y: 425, w: 112, h: 53 }],
    guide: [[401, 347], [404, 301], [425, 263], [449, 246], [484, 245], [510, 261], [531, 297], [538, 347]],
    gold: 265, silver: 300,
  },
  {
    id: "puppy-pair", name: "双汪集合", theme: "杏色草原", palette: "apricot", ink: 595,
    copy: "一只小狗在地上，另一只在高台。用高台和柱子封住防线的右侧。",
    hint: "左侧贴着草地落脚，绕过两只小狗后，把右脚接到有柱子的位置。",
    dogs: [{ x: 333, y: 443 }, { x: 552, y: 357, brown: true }],
    hives: [{ x: 175, y: 274, count: 7 }, { x: 738, y: 228, count: 7 }],
    boxes: [{ x: 492, y: 392, w: 162, h: 26 }, { x: 596, y: 418, w: 44, h: 60 }],
    guide: [[267, 472], [267, 423], [290, 385], [347, 371], [408, 366], [460, 318], [510, 289], [562, 290], [600, 314], [618, 353], [620, 386]],
    gold: 495, silver: 551,
  },
  {
    id: "dusk-rescue", name: "黄昏大营救", theme: "月升花谷", palette: "dusk", ink: 580, wind: { mode: "reversing", strength: 68 },
    copy: "三座蜂巢、两只小狗。用一笔和横桥封住所有来路。",
    hint: "把横桥当作防线的底边，两只小狗一起围起来。",
    dogs: [{ x: 347, y: 329, brown: true }, { x: 548, y: 314 }],
    hives: [{ x: 157, y: 232, count: 7 }, { x: 741, y: 193, count: 7, heavy: true }, { x: 715, y: 422, count: 6, heavy: true }],
    boxes: [{ x: 247, y: 364, w: 410, h: 31 }, { x: 504, y: 349, w: 101, h: 15 }, { x: 583, y: 307, w: 28, h: 42 }, { x: 87, y: 425, w: 130, h: 53 }],
    guide: [[275, 358], [276, 304], [300, 266], [349, 248], [450, 239], [552, 240], [604, 266], [630, 307], [633, 358]],
    gold: 490, silver: 548,
  },
  {
    id: "bridge-rescue", name: "上下夹击", theme: "落日石桥", palette: "canyon", ink: 525,
    copy: "两只小狗分别在桥上和桥下。让防线靠稳桥边，用一笔封住两个入口。",
    hint: "先护住桥上的小狗，再沿桥的右缘往下画，把线落在右下的矮台上。",
    dogs: [{ x: 453, y: 295 }, { x: 471, y: 443, brown: true }],
    hives: [{ x: 248, y: 213, count: 7 }, { x: 730, y: 186, count: 7, wave: 0 }, { x: 724, y: 382, count: 7, heavy: true }],
    boxes: [
      { x: 332, y: 330, w: 247, h: 29 },
      { x: 332, y: 359, w: 39, h: 119 },
      { x: 588, y: 434, w: 72, h: 44 },
    ],
    guide: [[363, 324], [368, 284], [389, 252], [430, 233], [477, 233], [516, 251], [543, 287], [553, 324], [579, 324], [586, 332], [590, 367], [599, 405], [624, 428], [650, 428]],
    gold: 450, silver: 505,
    alternate: [[364, 324], [367, 277], [395, 244], [443, 226], [493, 233], [528, 258], [549, 290], [556, 324], [578, 324], [586, 332], [591, 370], [602, 404], [626, 428], [645, 428]],
  },
];

const LEVEL_GROUPS = [
  {
    id: "terrain", name: "地形支撑", levels: [
      LEGACY_LEVELS[0],
      LEGACY_LEVELS[1],
      {
        id: "narrow-pit", name: "跨过窄坑", theme: "浅沟花田", palette: "apricot", ink: 400,
        copy: "右边少了一块草地。让防线跨过浅坑，两脚都落在实地上。",
        hint: "从小狗左边绕过头顶，第二只脚落在坑的右岸。",
        pits: [{ x: 482, width: 82, bottom: 535 }],
        dogs: [{ x: 451, y: 443 }], hives: [{ x: 222, y: 206, count: 7 }, { x: 709, y: 223, count: 4 }],
        boxes: [{ x: 485, y: 414, w: 40, h: 39 }],
        guide: [[371, 472], [376, 415], [400, 387], [441, 370], [503, 373], [548, 392], [579, 423], [590, 472]],
        gold: 330, silver: 369,
      },
      LEGACY_LEVELS[4],
      LEGACY_LEVELS[6],
    ],
  },
  {
    id: "wind", name: "风与蜂群", levels: [
      {
        ...LEGACY_LEVELS[2],
        wind: { mode: "steady", strength: 24 },
        copy: "轻风把蜜蜂向右吹。留意两侧蜂巢和墨线两端的缺口。",
        hint: "左脚靠着草地凸台外侧落下，别把线塞进凸台。",
      },
      LEGACY_LEVELS[3],
      {
        id: "gully-gust", name: "沟里的蜂群", theme: "阵风浅谷", palette: "wind", ink: 420,
        copy: "有一座蜂巢藏在沟里。阵风来了，小心蜜蜂从防线底下钻进来。",
        hint: "防线左脚落在草地上，右脚伸进沟里，接到沟底。",
        wind: { mode: "gust", strength: -60 },
        pits: [{ x: 499, width: 233, bottom: 546 }],
        dogs: [{ x: 460, y: 443 }], hives: [{ x: 259, y: 190, count: 6 }, { x: 659, y: 502, count: 8 }],
        boxes: [],
        guide: [[376, 472], [379, 418], [409, 386], [460, 372], [505, 390], [539, 430], [541, 486], [545, 540]],
        gold: 345, silver: 389,
      },
      {
        id: "reversing-wind", name: "风向掉头", theme: "回风草坡", palette: "noon", ink: 320,
        copy: "风会来回换向。小狗在窄台上，靠稳两端才能顶住两侧的蜂群。",
        hint: "让两脚都踩上窄台，给小狗的两侧留出空间。",
        wind: { mode: "reversing", strength: 58 },
        dogs: [{ x: 464, y: 341 }], hives: [{ x: 189, y: 300, count: 7 }, { x: 714, y: 241, count: 7 }],
        boxes: [{ x: 363, y: 376, w: 206, h: 40 }, { x: 495, y: 320, w: 32, h: 56 }, { x: 722, y: 421, w: 105, h: 57 }],
        guide: [[394, 370], [400, 316], [425, 290], [465, 273], [512, 285], [538, 317], [540, 370]],
        gold: 265, silver: 298,
      },
      {
        ...LEGACY_LEVELS[5],
        alternate: [[291, 358], [291, 291], [330, 252], [405, 232], [523, 232], [585, 245], [625, 274], [638, 320], [640, 358]],
      },
    ],
  },
  {
    id: "patrol", name: "巡逻小狗", levels: [
      {
        id: "first-patrol", name: "散步的小狗", theme: "脚印花田", palette: "morning", ink: 430,
        copy: "这只小狗会沿脚印往返。把它走得到的地方都罩住。",
        hint: "从脚印左边起笔，绕过整条路线，再在右边接地。",
        dogs: [{ x: 416, y: 443, patrol: { to: 501, period: 4.8 } }],
        pits: [{ x: 538, width: 43, bottom: 535 }],
        hives: [{ x: 229, y: 189, count: 4 }, { x: 727, y: 315, count: 3 }], boxes: [],
        guide: [[351, 472], [353, 416], [385, 384], [427, 371], [485, 371], [550, 389], [582, 422], [601, 472]],
        gold: 355, silver: 399,
      },
      {
        id: "ledge-patrol", name: "高台散步", theme: "苔草长台", palette: "spring", ink: 440,
        copy: "小狗会在高台两端折返，蜜蜂会追着它飞。",
        hint: "沿脚印外画个长拱门，两脚落回高台。",
        dogs: [{ x: 455, y: 316, patrol: { to: 580, period: 4.6 } }],
        hives: [{ x: 227, y: 309, count: 7 }, { x: 755, y: 203, count: 4 }],
        boxes: [{ x: 382, y: 351, w: 348, h: 33 }, { x: 612, y: 303, w: 32, h: 48 }],
        guide: [[401, 345], [403, 299], [434, 258], [481, 242], [560, 243], [618, 262], [650, 303], [655, 345]],
        gold: 365, silver: 410,
      },
      {
        id: "long-patrol", name: "一路护送", theme: "长草原", palette: "apricot", ink: 685,
        copy: "脚印拉得很长，墨水有限。把屋顶画低一些，给两端省点墨水。",
        hint: "让两端越过坑口落到外岸，屋顶画低一点省墨。",
        dogs: [{ x: 304, y: 443, patrol: { to: 590, period: 5.6 } }],
        pits: [{ x: 237, width: 34, bottom: 535 }, { x: 627, width: 39, bottom: 538 }],
        hives: [{ x: 183, y: 272, count: 7 }, { x: 731, y: 222, count: 7 }], boxes: [],
        guide: [[213, 472], [235, 408], [284, 377], [340, 364], [557, 364], [620, 380], [669, 413], [705, 472]],
        gold: 575, silver: 635,
      },
      {
        id: "double-patrol", name: "迎面散步", theme: "杏花平原", palette: "noon", ink: 640,
        copy: "两只小狗从两头同时出发。别忘了它们折返时也会走到外侧。",
        hint: "从最左脚印画到最右脚印，用一条长拱门一起保护。",
        dogs: [{ x: 305, y: 443, patrol: { to: 382, period: 4.7 } }, { x: 608, y: 443, brown: true, patrol: { to: 508, period: 5.4 } }],
        hives: [{ x: 178, y: 211, count: 8 }, { x: 733, y: 283, count: 8 }],
        boxes: [{ x: 439, y: 360, w: 30, h: 118 }],
        guide: [[248, 472], [253, 423], [289, 385], [362, 355], [439, 346], [490, 346], [581, 362], [643, 398], [669, 435], [671, 472]],
        gold: 535, silver: 598,
      },
      {
        id: "bridge-patrol", name: "上下巡逻", theme: "暮色石桥", palette: "dusk", ink: 630,
        copy: "桥上和桥下都有小狗在走。既要罩住头顶，也要堵住桥下的入口。",
        hint: "先罩住桥上的脚印，再沿右边绕下去，接到右侧矮台。",
        dogs: [{ x: 396, y: 295, patrol: { to: 536, period: 4.6 } }, { x: 514, y: 443, brown: true, patrol: { to: 369, period: 5.8 } }],
        hives: [{ x: 196, y: 214, count: 7 }, { x: 736, y: 190, count: 7, heavy: true }, { x: 765, y: 391, count: 8, heavy: true }],
        boxes: [{ x: 278, y: 330, w: 351, h: 28 }, { x: 278, y: 358, w: 43, h: 120 }, { x: 642, y: 435, w: 74, h: 43 }],
        guide: [[331, 324], [335, 282], [364, 242], [417, 226], [509, 226], [551, 246], [581, 282], [588, 324], [630, 324], [636, 340], [644, 390], [667, 429], [698, 429]],
        alternate: [[344, 324], [344, 269], [379, 235], [442, 220], [507, 223], [562, 251], [584, 287], [594, 324], [629, 324], [637, 337], [648, 401], [673, 429], [702, 429]],
        gold: 535, silver: 603,
      },
    ],
  },
  {
    id: "platforms", name: "活动平台", levels: [
      {
        id: "sliding-support", name: "滑动的落脚处", theme: "滑台溪沟", palette: "spring", ink: 425,
        copy: "右边的矮台会横向移动。右脚要落在它始终能托住的位置。",
        hint: "左脚踩实草地，右脚落到滑台靠中间的位置。",
        pits: [{ x: 521, width: 210, bottom: 546 }],
        dogs: [{ x: 484, y: 443 }], hives: [{ x: 244, y: 222, count: 6 }, { x: 751, y: 230, count: 7 }],
        boxes: [{ x: 548, y: 503, w: 122, h: 22, travel: { dx: 60, period: 5.4 } }],
        guide: [[394, 472], [400, 418], [429, 379], [486, 366], [543, 382], [587, 422], [620, 469], [632, 497]],
        gold: 355, silver: 399,
      },
      {
        id: "rising-support", name: "一上一下", theme: "升降山坡", palette: "wind", ink: 455,
        copy: "右侧平台会升降。给拱门留一点高度，让它被托起时还有空间。",
        hint: "左脚踩固定台，右脚搭到升降台上，屋顶画得高一些。",
        dogs: [{ x: 468, y: 355 }], hives: [{ x: 221, y: 215, count: 7 }, { x: 750, y: 418, count: 7 }],
        boxes: [
          { x: 333, y: 390, w: 175, h: 34 },
          { x: 504, y: 420, w: 77, h: 58 },
          { x: 584, y: 390, w: 106, h: 24, travel: { dy: 48, period: 5.8 } },
        ],
        guide: [[372, 384], [376, 324], [410, 279], [468, 261], [529, 268], [582, 300], [613, 341], [620, 384]],
        gold: 380, silver: 430,
      },
      {
        id: "pit-brace", name: "宽坑借力", theme: "深沟花谷", palette: "canyon", ink: 455,
        copy: "坑里的滑台会顶到墨线。把脚落到坑底，让防线有稳固的支撑。",
        hint: "右脚沿着坑的左壁往下画，避开滑台，接到坑底。",
        pits: [{ x: 472, width: 280, bottom: 549 }],
        dogs: [{ x: 433, y: 443 }], hives: [{ x: 214, y: 208, count: 6 }, { x: 692, y: 492, count: 8 }],
        boxes: [{ x: 469, y: 429, w: 31, h: 30 }, { x: 570, y: 517, w: 103, h: 21, travel: { dx: -55, period: 4.8 } }],
        guide: [[355, 472], [357, 415], [392, 377], [439, 359], [498, 371], [523, 420], [521, 482], [522, 543]],
        gold: 375, silver: 420,
      },
      {
        id: "opening-seam", name: "会张开的缝", theme: "开合石桥", palette: "noon", ink: 580,
        copy: "两块台面会分开。下面的蜜蜂正等着从缝里飞上来。",
        hint: "画完拱门后，让右脚向左折回，盖住两块台面之间的缝。",
        dogs: [{ x: 449, y: 327 }], hives: [{ x: 223, y: 213, count: 6 }, { x: 615, y: 420, count: 9 }, { x: 749, y: 198, count: 4, wave: 0 }],
        boxes: [
          { x: 328, y: 362, w: 160, h: 32 },
          { x: 534, y: 362, w: 175, h: 26, travel: { dx: 47, period: 14 / 3 } },
        ],
        guide: [[378, 356], [384, 298], [424, 259], [479, 243], [538, 248], [580, 280], [604, 318], [609, 356], [547, 356], [474, 356]],
        gold: 480, silver: 538,
      },
      {
        id: "crossing-bridges", name: "交错浮桥", theme: "落日双沟", palette: "canyon", ink: 605,
        copy: "两座平台一升一滑。让防线跨在沟的两侧，护住中间的两只小狗。",
        hint: "左脚搭在升降台右侧，跨过两只小狗，右脚搭上滑台靠中间的位置。",
        pits: [{ x: 137, width: 170, bottom: 549 }, { x: 497, width: 267, bottom: 549 }],
        dogs: [{ x: 340, y: 443 }, { x: 459, y: 443, brown: true }],
        hives: [{ x: 754, y: 196, count: 8 }, { x: 713, y: 447, count: 7, heavy: true }, { x: 151, y: 238, count: 8, heavy: true }],
        boxes: [
          { x: 493, y: 380, w: 36, h: 35 },
          { x: 168, y: 505, w: 124, h: 23, travel: { dy: -40, period: 5.8 } },
          { x: 555, y: 499, w: 145, h: 24, travel: { dx: 54, period: 4.4, phase: .36 } },
        ],
        guide: [[251, 499], [250, 446], [276, 400], [319, 365], [405, 349], [494, 357], [553, 388], [608, 441], [630, 493]],
        alternate: [[236, 499], [244, 432], [287, 377], [353, 362], [449, 362], [537, 383], [599, 430], [624, 493]],
        gold: 515, silver: 575,
      },
    ],
  },
];

const BATTLE_PACE = [
  { time: 10, regular: [0], challenge: [0, 4] },
  { time: 12, regular: [0, 5], challenge: [0, 4, 8] },
  { time: 14, regular: [0, 6], challenge: [0, 5, 10] },
  { time: 16, regular: [0, 7], challenge: [0, 6, 11] },
];

const LEVELS = LEVEL_GROUPS.flatMap((group, groupIndex) => group.levels.map((level, index) => {
  const challenge = index === group.levels.length - 1;
  const pace = BATTLE_PACE[groupIndex];
  return { ...level, groupIndex, challenge, time: pace.time, waveTimes: challenge ? pace.challenge : pace.regular };
}));
