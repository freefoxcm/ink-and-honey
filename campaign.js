"use strict";

const CAMPAIGN_CHAPTERS = (() => {
  const originals = new Map([...LEVELS, ...RESCUE_LEVELS].map(level => [level.id, level]));
  const level = (id, changes) => ({ ...originals.get(id), ...changes });
  const materials = (id, kinds) => originals.get(id).boxes.map((box, index) => ({ ...box, kind: kinds[index] }));
  const thorn = originals.get("thorn-gully");
  const meadowPatrol = originals.get("double-patrol");
  const ledgePatrol = originals.get("ledge-patrol");
  const bridgePatrol = originals.get("bridge-patrol");
  const ember = originals.get("ember-bluff");
  const forestWalk = { x: 429, y: 211, brown: true, patrol: { to: 477 } };
  const forestDrop = { ...thorn.rescue, releaseAt: 1.6, perch: { x: 251, material: "wood" } };
  const narrowPegs = thorn.boxes.map(box => box.id === "upper-peg" ? { ...box, w: 117 } :
    box.id === "lower-peg" ? { ...box, x: 581, w: 97 } : box);
  const deepForestGuide = [[266, 284], [266, 206], [350, 195], [377, 278], [379, 289], [427, 313],
    [450, 398], [481, 400], [525, 389], [551, 358], [588, 331], [636, 331]];
  const rockShelves = changes => ember.boxes.map(box => ({ ...box, ...changes[box.id] }));
  const floatMovingBoxes = id => originals.get(id).boxes.map(box => box.travel ? { ...box, kind: "float" } : box);

  const grass = {
    id: "grass", name: "草地", palette: "morning", levels: [
      level("first-shelter", { theme: "晴日花田" }),
      level("narrow-pit", { theme: "浅沟草地" }),
      level("first-patrol", { theme: "脚印花田", time: 11, waveTimes: [0, 5] }),
      level("puppy-pair", {
        theme: "杏色草原", time: 12, waveTimes: [0, 5], ink: 605, gold: 465, silver: 540,
        copy: "两只小熊沿着不同的脚印来回走。让防线罩住它们都走得到的草地。",
        hint: "用一道长拱门盖住两条脚印，左脚和右脚都踩实草地。",
        dogs: [{ x: 382, y: 443, patrol: { to: 430, period: 4.8 } },
          { x: 509, y: 443, brown: true, patrol: { to: 548, period: 5.6 } }], boxes: [],
        guide: [[320, 472], [324, 419], [361, 382], [418, 369], [508, 369], [572, 391], [600, 425], [604, 472]],
      }),
      {
        ...meadowPatrol, id: "grass-challenge", name: "草地大巡逻", theme: "双向花田", time: 14, waveTimes: [0, 6.5],
        copy: "两只小熊走得更远，左边和右边的蜂群先后出发。让同一道防线护住两条路线。",
        hint: "越过中间的土柱，用长拱门罩住两边的脚印。两端都要落地。",
        alternate: [[244, 472], [246, 408], [302, 365], [381, 340], [491, 336], [591, 351], [650, 392], [676, 440], [678, 472]],
      },
    ],
  };

  const jungle = {
    id: "jungle", name: "丛林", palette: "jungle", levels: [
      level("lookout", {
        name: "树杈上的防线", theme: "林中树冠", time: 10, waveTimes: [0],
        copy: "小熊在宽枝条上。把墨线的两端搭稳，挡住左边的蜜蜂。",
        hint: "顺着小熊的头顶画个拱，把两脚都落在树枝上。",
        boxes: materials("lookout", ["branch", "peg"]),
      }),
      level("thorn-gully", { theme: "荆棘林地" }),
      level("ledge-patrol", {
        name: "林间巡逻", theme: "横枝小径", time: 11, waveTimes: [0, 5],
        copy: "小熊沿着宽树枝上的脚印往返。借树枝撑住墨线，罩住整个散步范围。",
        hint: "沿脚印外画个长拱门，两脚落回树枝上。",
        boxes: materials("ledge-patrol", ["branch", "peg"]),
      }),
      level("long-patrol", {
        name: "走到断口", theme: "断枝刺沟", time: 12, waveTimes: [2.35],
        ink: thorn.ink, gold: thorn.gold, silver: thorn.silver,
        copy: "小熊会先沿脚印走到断口，再往下掉。趁它还没出发，把吊床画好。",
        hint: "顺着断口的虚线看落点。用两边的木桩撑住吊床，把左侧蜂巢围住。",
        dogs: [forestWalk], hives: thorn.hives, boxes: thorn.boxes, pits: thorn.pits,
        rescue: forestDrop, guide: thorn.guide,
      }),
      {
        ...thorn, id: "jungle-challenge", name: "丛林大救援", theme: "双巢断枝", time: 14, waveTimes: [2.3, 7], ink: 1080, gold: 685, silver: 905,
        copy: "小熊会走到断口再下落。左边的蜂群先到，右边的蜂群接着来。",
        hint: "让线借住两边的木桩，给断口下方留出接熊的位置，再封住两侧的来路。",
        dogs: [forestWalk], hives: [...thorn.hives, { x: 628, y: 375, count: 8, wave: 1 }],
        boxes: narrowPegs,
        rescue: forestDrop, guide: thorn.guide,
        alternate: deepForestGuide,
      },
    ],
  };

  const lake = {
    id: "lake", name: "湖泊", palette: "lake", levels: [
      level("willow-rescue", { theme: "湖边柳阴" }),
      level("sliding-support", {
        theme: "横移浮木", time: 11, waveTimes: [0, 5], boxes: floatMovingBoxes("sliding-support"),
        copy: "浮木会横向移动。画线时看看虚线行程，把右脚搭在始终有支撑的位置。",
        hint: "左脚落在岸上，右脚画到浮木行程重叠的地方。",
      }),
      level("lone-peg", { theme: "湖中独桩", time: 11 }),
      level("crossing-bridges", { theme: "交错的浮桥", time: 13, boxes: floatMovingBoxes("crossing-bridges") }),
      {
        ...thorn, id: "lake-challenge", name: "浮木上的救援", theme: "湖心栈桥", time: 14, waveTimes: [2.3, 6.5],
        ink: 1080, gold: 690, silver: 900,
        copy: "小熊走到栈桥末端就会落下。用固定木桩和横移浮木接住它，再挡住两波蜜蜂。",
        hint: "让吊床左端在浮木的行程内多搭一截，接住断口正下方的小熊。",
        dogs: [{ x: 471, y: 211, brown: true, patrol: { to: 423 } }],
        hives: [{ ...thorn.hives[0], x: 588 }, { x: 272, y: 405, count: 7, wave: 1 }],
        boxes: narrowPegs.map(box => box.id === "lower-peg" ? {
          ...box, id: "lake-float", kind: "float", x: 228, w: 114, travel: { dx: -19, period: 4.8 },
        } : { ...box, x: BOARD.width - box.x - box.w }),
        pits: [{ x: 153, width: 535, bottom: BOARD.height }],
        rescue: { ...forestDrop, hazard: { kind: "water", left: 153, right: 688, y: 449 }, perch: { x: 649, material: "wood" } },
        guide: [[625, 282], [620, 206], [551, 199], [531, 273], [514, 284], [474, 343],
          [431, 364], [389, 378], [348, 350], [318, 327], [265, 327]],
        alternate: deepForestGuide.map(([x, y]) => [BOARD.width - x, y]),
      },
    ],
  };

  const cliff = {
    id: "cliff", name: "悬崖", palette: "cliff", levels: [
      level("bridge-rescue", { theme: "双层石桥", time: 11, boxes: materials("bridge-rescue", ["ledge", "cliff", "ledge"]) }),
      level("pit-brace", { theme: "岩壁深沟", time: 11, boxes: materials("pit-brace", ["ledge", undefined]) }),
      level("bridge-patrol", { theme: "上下岩沿", time: 12, boxes: materials("bridge-patrol", ["ledge", "cliff", "ledge"]) }),
      {
        ...bridgePatrol, id: "double-patrol", name: "迎面散步", theme: "对向山路", time: 13, waveTimes: [0, 4.5, 8.5],
        copy: "桥上和桥下的小熊朝相反方向走。挡住上方的蜜蜂，再把线沿右侧绕下去。",
        dogs: [{ x: 520, y: 295, patrol: { to: 414, period: 4.6 } },
          { x: 388, y: 443, brown: true, patrol: { to: 506, period: 5.8 } }],
        boxes: materials("bridge-patrol", ["ledge", "cliff", "ledge"]),
      },
      {
        ...bridgePatrol, id: "cliff-challenge", name: "双层崖谷", theme: "大崖夹击", time: 15, waveTimes: [0, 5, 9.5],
        copy: "两只小熊沿着上下两层岩沿巡逻。高处蜂群先来，下方的重蜂会冲向桥底。",
        hint: "先绕过高处的脚印，再沿桥边向下，让线落在低处的窄岩沿上。",
        boxes: materials("bridge-patrol", ["ledge", "cliff", "ledge"]).map((box, i) => i === 2 ? { ...box, w: 66 } : box),
      },
    ],
  };

  const snow = {
    id: "snow", name: "雪山", palette: "snow", levels: [
      level("two-hives", { theme: "雪原双巢" }),
      level("wind-bridge", { theme: "风雪石桥" }),
      level("gully-gust", { theme: "阵风雪沟" }),
      level("reversing-wind", { theme: "回风雪台" }),
      {
        ...ledgePatrol, id: "snow-challenge", name: "回风里的雪桥", theme: "雪山风口", time: 15, waveTimes: [0, 6, 10],
        copy: "风会换向，小熊沿窄台散步。把墨线右端搭在移动雪台上，堵住两边的蜂群。",
        hint: "留够小熊折返的空间，把墨线右脚画在雪台能一直托住的地方。",
        wind: { mode: "reversing", strength: 58 }, ink: 500, gold: 385, silver: 450,
        hives: [{ x: 230, y: 300, count: 7 }, { x: 754, y: 204, count: 6 }, { x: 748, y: 378, count: 4, heavy: true }],
        boxes: [{ x: 382, y: 351, w: 214, h: 33 }, { x: 595, y: 351, w: 138, h: 28, travel: { dx: 15, period: 5.2 } }],
        alternate: [[398, 345], [399, 292], [441, 250], [514, 231], [588, 236], [649, 272], [667, 312], [668, 345]],
      },
    ],
  };

  const volcano = {
    id: "volcano", name: "火山", palette: "volcano", levels: [
      level("ember-bluff", { theme: "赤岩裂谷" }),
      {
        ...ember, id: "rising-support", name: "一上一下", theme: "升降岩沿", time: 12,
        copy: "右侧的岩沿会上下移动。给吊床留够深度接熊，也要给上涨的熔岩留出空间。",
        hint: "左边踩稳凸岩，右边多搭一点到升降岩台上。",
        dogs: [{ x: 510, y: 211 }],
        boxes: rockShelves({ "far-shelf": { x: 561, y: 335, w: 107, travel: { dy: -29, period: 5.8 } },
          "high-shelf": { y: 290, w: 155 } }),
        guide: [[276, 273], [281, 191], [352, 185], [369, 262], [393, 275], [427, 320],
          [472, 376], [521, 385], [563, 357], [590, 313], [647, 314]],
      },
      {
        ...ember, id: "opening-seam", name: "会张开的缝", theme: "滑动岩桥", time: 12,
        copy: "右侧岩台会向外滑动。吊床右端搭得太短，就可能滑进熔岩。",
        hint: "让右脚伸到滑台行程的重叠处，吊床中间抬高一些。",
        dogs: [{ x: 461, y: 205 }],
        boxes: rockShelves({ "far-shelf": { x: 547, y: 320, w: 120, travel: { dx: 36, period: 5 } },
          "high-shelf": { y: 292, w: 133 } }),
        guide: [[276, 271], [276, 201], [348, 197], [371, 260], [390, 276], [421, 313],
          [450, 338], [489, 344], [534, 338], [581, 303], [645, 307]],
      },
      {
        ...ember, id: "dusk-rescue", name: "黄昏大营救", theme: "落日熔谷", time: 13, waveTimes: [1.6, 6.5],
        copy: "熔岩正在上涨，风也会换方向。用较高的岩沿接住小熊，再挡住两侧的蜜蜂。",
        hint: "先罩住右侧的蜂巢，再把吊床向左延伸，搭上左侧岩沿。",
        wind: { mode: "reversing", strength: 46 },
        dogs: [{ x: 448, y: 209 }], hives: [{ x: 594, y: 232, count: 8 }, { x: 290, y: 364, count: 7, wave: 1 }],
        boxes: ember.boxes.map(box => ({ ...box, x: BOARD.width - box.x - box.w })),
        pits: [{ x: 158, width: 540, bottom: BOARD.height }],
        rescue: { ...ember.rescue, hazard: { ...ember.rescue.hazard, left: 158, right: 698 }, perch: { x: 234, material: "stone" } },
        guide: [[256, 296], [329, 294], [356, 339], [397, 367], [440, 359], [475, 316],
          [509, 270], [535, 257], [554, 191], [625, 199], [627, 270]],
      },
      {
        ...ember, id: "volcano-challenge", name: "火山大救援", theme: "升起的熔岩", time: 16, waveTimes: [2.35, 7.2],
        ink: 1120, gold: 690, silver: 850,
        copy: "小熊走到断口才会掉下去。用高岩沿接住它，撑过熔岩上涨和左右两波蜜蜂。",
        hint: "看准断口的位置画吊床，借高岩沿承重，两边尽量挡严实。",
        dogs: [{ x: 431, y: 205, patrol: { to: 483 } }],
        hives: [...ember.hives, { x: 620, y: 355, count: 8, wave: 1 }],
        boxes: rockShelves({ "far-shelf": { x: 574, w: 94 }, "high-shelf": { w: 132 } }),
        rescue: { ...ember.rescue, releaseAt: 1.6, hazard: { ...ember.rescue.hazard, rise: 71 }, perch: { x: 257, material: "stone" } },
        guide: [[270, 270], [270, 198], [347, 190], [369, 261], [392, 273], [423, 318],
          [459, 368], [500, 374], [539, 354], [580, 294], [649, 294]],
        alternate: [[273, 272], [275, 194], [353, 190], [369, 252], [391, 266], [415, 334],
          [440, 366], [473, 382], [520, 383], [551, 345], [589, 296]],
      },
    ],
  };

  return [grass, jungle, lake, cliff, snow, volcano].map((chapter, groupIndex) => ({
    ...chapter,
    levels: chapter.levels.map((entry, index) => ({
      ...entry, palette: chapter.palette, chapterId: chapter.id, groupIndex, chapterLevel: index + 1, challenge: index === 4,
    })),
  }));
})();

const CAMPAIGN_LEVELS = CAMPAIGN_CHAPTERS.flatMap(chapter => chapter.levels);
const JUNGLE_PREVIEW = CAMPAIGN_CHAPTERS.find(chapter => chapter.id === "jungle").levels;
