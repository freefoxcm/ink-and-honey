"use strict";

const PORTRAIT_CHAPTERS = (() => {
  const board = PORTRAIT_BOARD;
  // Keep the original heights above each support while narrowing the terrain.
  const x = value => Math.round(board.width / 2 + (value - BOARD.width / 2) * .68);
  const y = value => value + board.ground - BOARD.ground;
  const span = (left, right) => ({ left: Math.max(0, x(left)), right: Math.min(board.width, x(right)) });
  const route = points => points?.map(([px, py]) => [x(px), y(py)]);

  function portrait(level, changes) {
    const { hives, budget: [gold, silver, ink], ...layout } = changes;
    const rescue = level.rescue && {
      ...level.rescue,
      ...(level.rescue.perch && { perch: { ...level.rescue.perch, x: x(level.rescue.perch.x) } }),
      hazard: { ...level.rescue.hazard, ...span(level.rescue.hazard.left, level.rescue.hazard.right), y: y(level.rescue.hazard.y) },
    };
    return {
      ...level, board, rescue, gold, silver, ink,
      dogs: level.dogs.map(dog => ({
        ...dog, x: x(dog.x), y: y(dog.y),
        ...(dog.patrol && { patrol: { ...dog.patrol, to: x(dog.patrol.to) } }),
      })),
      hives: level.hives.map((hive, index) => ({ ...hive, x: hives[index][0], y: hives[index][1] })),
      boxes: level.boxes.map(box => ({
        ...box, x: x(box.x), y: y(box.y), w: x(box.x + box.w) - x(box.x),
        ...(box.travel && { travel: { ...box.travel, dx: (box.travel.dx ?? 0) * .68 } }),
      })),
      pits: level.pits?.map(pit => {
        const { left, right } = span(pit.x, pit.x + pit.width);
        return { ...pit, x: left, width: right - left, bottom: y(pit.bottom) };
      }),
      guide: route(level.guide), alternate: route(level.alternate), ...layout,
    };
  }

  // Place the hives in portrait lanes and tune each route against its new clearances.
  const layouts = {
"first-shelter": { budget: [265, 295, 345], hives: [[150, 365]] },
"narrow-pit": { budget: [315, 350, 410], hives: [[379, 295], [137, 485]] },
"first-patrol": { budget: [330, 365, 430], hives: [[161, 336], [442, 525]] },
    "puppy-pair": {
      budget: [370, 420, 490], hives: [[139, 377], [435, 502]],
      guide: [[182, 722], [184, 669], [209, 632], [248, 619], [309, 619], [360, 641], [383, 675], [383, 722]],
    },
    "grass-challenge": {
      budget: [460, 530, 620], hives: [[92, 300], [472, 537]],
      guide: [[125, 722], [126, 669], [161, 635], [210, 605], [263, 596], [297, 596], [359, 612], [401, 648], [425, 682], [425, 722]],
    },
"lookout": {
      budget: [250, 280, 340], hives: [[144, 310]],
      guide: [[347, 614],[347, 580],[363, 546],[398, 526],[428, 534],[449, 565],[453, 614]],
    },
"thorn-gully": { budget: [505, 590, 735], hives: [[178, 475]] },
"ledge-patrol": {
      budget: [365, 415, 480], hives: [[112, 340], [466, 479]],
      guide: [[229, 595],[231, 547],[252, 508],[287, 486],[350, 488],[389, 511],[409, 541],[420, 595]],
    },
"long-patrol": { budget: [505, 590, 740], hives: [[178, 475]] },
"jungle-challenge": { budget: [505, 615, 800], hives: [[177, 473], [462, 620]] },
    "willow-rescue": { budget: [505, 595, 745], hives: [[184, 479]] },
"sliding-support": { budget: [340, 390, 460], hives: [[138, 347], [422, 513]] },
    "lone-peg": {
      budget: [675, 760, 910], hives: [[175, 393]],
      guide: [[277, 431], [235, 430], [235, 374], [305, 374], [308, 430], [329, 461], [335, 542], [316, 594],
        [273, 597], [246, 555], [232, 466], [267, 432]],
    },
"crossing-bridges": { budget: [475, 540, 630], hives: [[117, 326], [454, 458], [115, 570]] },
"lake-challenge": { budget: [500, 605, 790], hives: [[360, 476], [116, 663]] },
"bridge-rescue": { budget: [430, 490, 575], hives: [[96, 385], [463, 320], [459, 657]] },
"pit-brace": { budget: [385, 440, 525], hives: [[120, 322], [450, 550]] },
"bridge-patrol": {
      budget: [520, 585, 675], hives: [[102, 392], [453, 330], [446, 648]],
      guide: [[183, 574],[183, 527],[205, 487],[248, 469],[311, 470],[350, 489],[371, 529],[372, 574],[392, 574],[396, 590],[402, 640],[418, 679],[439, 679]],
    },
"double-patrol": { budget: [500, 575, 660], hives: [[114, 389], [458, 292], [458, 647]] },
"cliff-challenge": {
      budget: [525, 600, 710], hives: [[100, 389], [444, 300], [469, 645]],
      guide: [[183, 574],[183, 527],[205, 487],[248, 469],[311, 470],[350, 489],[371, 529],[372, 574],[392, 574],[396, 590],[402, 640],[418, 679],[439, 679]],
      alternate: [[176, 574],[176, 514],[218, 475],[263, 461],[324, 468],[352, 496],[372, 533],[379, 574],[397, 574],[402, 618],[415, 660],[434, 679]],
    },
"two-hives": { budget: [265, 295, 350], hives: [[112, 315], [432, 592]] },
"wind-bridge": { budget: [270, 305, 370], hives: [[134, 630], [421, 318]] },
"gully-gust": { budget: [350, 395, 470], hives: [[107, 329], [443, 481]] },
"reversing-wind": { budget: [265, 300, 360], hives: [[105, 339], [443, 537]] },
"snow-challenge": {
      budget: [380, 440, 535], hives: [[103, 427], [454, 322], [107, 658]],
      guide: [[229, 595],[230, 540],[253, 501],[292, 481],[356, 484],[391, 506],[417, 545],[427, 595]],
      alternate: [[225, 595],[228, 529],[259, 492],[312, 470],[369, 483],[405, 513],[426, 563],[427, 595]],
    },
    "ember-bluff": { budget: [520, 610, 760], hives: [[173, 462]] },
    "rising-support": {
      budget: [550, 650, 800], hives: [[202, 453]],
      guide: [[152, 523], [155, 441], [203, 435], [215, 512], [231, 525], [254, 570], [285, 626],
        [318, 635], [337, 604], [338, 561], [404, 564]],
    },
"opening-seam": { budget: [470, 545, 710], hives: [[180, 475]] },
"dusk-rescue": { budget: [525, 620, 790], hives: [[365, 455], [134, 608]] },
"volcano-challenge": { budget: [545, 665, 825], hives: [[175, 467], [443, 605]] },
  };

  return CAMPAIGN_CHAPTERS.map(chapter => ({
    ...chapter, levels: chapter.levels.map(level => portrait(level, layouts[level.id])),
  }));
})();

const PORTRAIT_LEVELS = PORTRAIT_CHAPTERS.flatMap(chapter => chapter.levels);

function runPortraitChecks() {
  const referenceRounds = new Map(PORTRAIT_LEVELS.map(level => [level.id, simulate(level, level.guide)]));
  const alternates = PORTRAIT_LEVELS.filter(level => level.challenge).map(level => simulate(level, level.alternate));
  const failed = rounds => [...rounds].filter(round => round.phase !== "win" || !round.bounces ||
    (round.rescue && !round.rescue.caught)).map(round => round.level.id);
  const failedReferences = failed(referenceRounds.values());
  const failedAlternates = failed(alternates);
  const level = id => referenceRounds.get(id).level;
  const patrol = makeRound(level("first-patrol"));
  const period = patrol.dogs[0].patrol.period;
  patrol.elapsed = period / 4;
  updateScene(patrol);
  const outward = patrol.dogs[0].vx;
  patrol.elapsed = period * .75;
  updateScene(patrol);
  const lake = makeRound(level("lake-challenge"));
  const float = lake.platforms.find(platform => platform.kind === "float");
  const floatStart = float.x;
  lake.elapsed = float.travel.period / 2;
  updateScene(lake);
  const snow = level("snow-challenge");
  const volcano = referenceRounds.get("volcano-challenge");
  const peg = referenceRounds.get("lone-peg");
  return {
    portraitProgressIds: {
      pass: PORTRAIT_LEVELS.length === 30 && PORTRAIT_LEVELS.every((entry, index) =>
        entry.board === PORTRAIT_BOARD && entry.id === CAMPAIGN_LEVELS[index].id &&
        entry.gold < entry.silver && entry.silver < entry.ink),
      detail: "All 30 portrait boards keep their original progress keys and ordered ink budgets.",
    },
    portraitReferences: {
      pass: failedReferences.length === 0, detail: failedReferences.join(", ") || "All 30 reference strokes win.",
    },
    portraitAlternates: {
      pass: alternates.length === 6 && failedAlternates.length === 0,
      detail: failedAlternates.join(", ") || "All six challenge alternatives win.",
    },
    portraitTerrainAndMovement: {
      pass: outward * patrol.dogs[0].vx < 0 && float.x !== floatStart &&
        windAt(snow, .7) * windAt(snow, 2.1) < 0 &&
        volcano.level.rescue.hazard.y > rescueHazardY(volcano) && volcano.rescue.caught &&
        peg.rescue.caught && rescueSupports(peg).length === 1,
      detail: "The patrol turns, the float moves, the wind and lava change, and a single peg holds the bear.",
    },
  };
}
