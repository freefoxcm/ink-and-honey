"use strict";

const PORTRAIT_CHAPTERS = (() => {
  const board = PORTRAIT_BOARD;
  // Keep the original heights above each support while narrowing the terrain.
  const x = value => Math.round(board.width / 2 + (value - BOARD.width / 2) * .68);
  const y = value => value + board.ground - BOARD.ground;
  const span = (left, right) => ({ left: Math.max(0, x(left)), right: Math.min(board.width, x(right)) });
  const route = points => points?.map(([px, py]) => [x(px), y(py)]);

  function portrait(level, changes) {
    const { hives, budget: [gold, silver, ink], surfaces = {}, hazard, ...layout } = changes;
    const rescue = level.rescue && {
      ...level.rescue,
      ...(level.rescue.perch && { perch: { ...level.rescue.perch, x: x(level.rescue.perch.x) } }),
      hazard: { ...level.rescue.hazard, ...span(level.rescue.hazard.left, level.rescue.hazard.right),
        y: y(level.rescue.hazard.y), ...hazard },
    };
    return {
      ...level, board, rescue, gold, silver, ink,
      dogs: level.dogs.map(dog => ({
        ...dog, x: x(dog.x), y: y(dog.y),
        ...(dog.patrol && { patrol: { ...dog.patrol, to: x(dog.patrol.to) } }),
      })),
      hives: level.hives.map((hive, index) => {
        const [x, y, options] = hives[index];
        return { ...hive, x, y, ...options };
      }),
      boxes: level.boxes.map((box, index) => ({
        ...box, x: x(box.x), y: y(box.y), w: x(box.x + box.w) - x(box.x),
        ...(box.travel && { travel: { ...box.travel, dx: (box.travel.dx ?? 0) * .68 } }),
        ...surfaces[box.id ?? index],
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
      budget: [495, 540, 655], hives: [[92, 300], [472, 537, { count: 7, special: "charge" }]],
      ruleNote: "冲锋蜂会先蓄力，再直撞墨线。",
      beeLossAdvice: "两端贴地，或借中间的土柱撑稳墨线。",
      guide: [[125, 722], [126, 669], [161, 635], [210, 605], [263, 596], [297, 596], [359, 612], [401, 648], [425, 682], [425, 722]],
      alternate: [[95, 722],[124, 722],[124, 671],[159, 628],[202, 607],[232, 609],[259, 604],
        [283, 604],[326, 576],[369, 592],[408, 632],[429, 681],[429, 722],[451, 722]],
    },
"lookout": {
      budget: [250, 280, 340], hives: [[144, 310]],
      guide: [[347, 614],[347, 580],[363, 546],[398, 526],[428, 534],[449, 565],[453, 614]],
    },
    "thorn-gully": {
      budget: [510, 555, 685], hives: [[178, 475]],
      surfaces: { "upper-peg": { loadLimit: 900 } },
      ruleNote: "细枝压久会断，粗木桩更结实。",
      alternate: [[145, 534],[145, 456],[202, 445],[220, 528],[222, 539],[254, 563],
        [270, 648],[291, 650],[321, 639],[339, 608],[364, 581],[396, 581]],
    },
"ledge-patrol": {
      budget: [365, 415, 480], hives: [[112, 340], [466, 479]],
      guide: [[229, 595],[231, 547],[252, 508],[287, 486],[350, 488],[389, 511],[409, 541],[420, 595]],
    },
"long-patrol": { budget: [505, 590, 740], hives: [[178, 475]] },
    "jungle-challenge": {
      budget: [510, 555, 645], hives: [[177, 473], [462, 620]], waveTimes: [2.3, 7.25],
      surfaces: { "upper-peg": { loadLimit: 900 } },
      ruleNote: "接住走下断口的小熊。细枝压久会断。",
    },
    "willow-rescue": { budget: [505, 595, 745], hives: [[184, 479]] },
"sliding-support": { budget: [340, 390, 460], hives: [[138, 347], [422, 513]] },
    "lone-peg": {
      budget: [675, 760, 910], hives: [[175, 393]],
      guide: [[277, 431], [235, 430], [235, 374], [305, 374], [308, 430], [329, 461], [335, 542], [316, 594],
        [273, 597], [246, 555], [232, 466], [267, 432]],
    },
"crossing-bridges": { budget: [475, 540, 630], hives: [[117, 326], [454, 458], [115, 570]] },
    "lake-challenge": {
      budget: [485, 530, 645], hives: [[360, 476], [116, 663]],
      surfaces: { "lake-float": { x: 140, w: 88, travel: { dx: -48, period: 4.8 } } },
      ruleNote: "浮木会横移，线尾多搭一截。",
      guide: [[389, 532],[386, 456],[339, 449],[325, 523],[314, 534],[287, 574],
        [260, 610],[230, 620],[195, 591],[164, 576],[142, 576]],
    },
"bridge-rescue": { budget: [430, 490, 575], hives: [[96, 385], [463, 320], [459, 657]] },
"pit-brace": { budget: [385, 440, 525], hives: [[120, 322], [450, 550]] },
"bridge-patrol": {
      budget: [520, 585, 675], hives: [[102, 392], [453, 330], [446, 648]],
      guide: [[183, 574],[183, 527],[205, 487],[248, 469],[311, 470],[350, 489],[371, 529],[372, 574],[392, 574],[396, 590],[402, 640],[418, 679],[439, 679]],
    },
"double-patrol": { budget: [500, 575, 660], hives: [[114, 389], [458, 292], [458, 647]] },
    "cliff-challenge": {
      budget: [520, 570, 620], hives: [[100, 389], [444, 300], [475, 654, { special: "scout" }]],
      surfaces: { 2: { x: 400, w: 46 } },
      ruleNote: "钻缝蜂会沿墨线找开口。护住上下两层。",
      beeLossAdvice: "先罩住上方脚印，再沿岩边把墨线搭到下层。",
      guide: [[183, 572],[184, 527],[214, 486],[254, 472],[317, 475],[354, 497],[378, 538],
        [382, 570],[395, 568],[418, 593],[431, 633],[426, 678],[412, 678]],
      alternate: [[179, 574],[181, 516],[215, 480],[258, 462],[317, 468],[354, 490],[378, 532],
        [380, 570],[400, 574],[405, 601],[405, 649],[421, 676],[447, 676]],
    },
"two-hives": { budget: [265, 295, 350], hives: [[112, 315], [432, 592]] },
"wind-bridge": { budget: [270, 305, 370], hives: [[134, 630], [421, 318]] },
"gully-gust": { budget: [350, 395, 470], hives: [[107, 329], [443, 481]] },
    "reversing-wind": {
      budget: [205, 225, 320], hives: [[105, 339], [443, 537]],
      surfaces: { 0: { iceFrom: .52 } },
      ruleNote: "蓝冰会滑，靠住岩沿更稳。",
      alternate: [[227, 618],[229, 552],[248, 519],[282, 516],[303, 538],[308, 555]],
    },
    "snow-challenge": {
      budget: [420, 460, 510], hives: [[103, 427], [454, 322], [107, 658]],
      wind: { mode: "reversing", strength: 58, inkFactor: .8 },
      surfaces: { 0: { x: 187, w: 188 }, 1: { x: 366, w: 105, travel: { dx: 14, period: 5.2 }, iceFrom: 0 } },
      ruleNote: "回风会推墨线，冰台也会移动。",
      guide: [[210, 594],[210, 530],[237, 491],[282, 477],[352, 478],[391, 496],[419, 545],[431, 587],[431, 595]],
      alternate: [[210, 595],[210, 526],[251, 492],[286, 485],[355, 483],[380, 493],[431, 520],[431, 560],[426, 595],[405, 595]],
    },
    "ember-bluff": { budget: [520, 610, 760], hives: [[173, 462]] },
    "rising-support": {
      budget: [550, 650, 800], hives: [[202, 453]],
      guide: [[152, 523], [155, 441], [203, 435], [215, 512], [231, 525], [254, 570], [285, 626],
        [318, 635], [337, 604], [338, 561], [404, 564]],
    },
"opening-seam": { budget: [470, 545, 710], hives: [[180, 475]] },
"dusk-rescue": { budget: [525, 620, 790], hives: [[365, 455], [134, 608]] },
    "volcano-challenge": {
      budget: [510, 555, 600], hives: [[175, 467, { count: 7, special: "charge" }], [443, 605, { count: 7, special: "scout" }]],
      hazard: { rise: 123, markCrest: true },
      ruleNote: "虚线是熔岩最高处。",
      guide: [[151, 524],[152, 448],[201, 440],[216, 511],[233, 525],[261, 568],
        [278, 599],[304, 603],[332, 588],[358, 544],[404, 544]],
    },
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
    ...runPilotChecks(level),
    ...runChapterChallengeChecks(level),
  };
}

function checkStrokeTolerance(level) {
  const shifts = [[-8, 0], [8, 0], [0, -8], [0, 8]];
  return [level.guide, level.alternate].map((route, index) => {
    const wins = stroke => simulate(level, stroke).phase === "win";
    const translated = shifts.filter(([dx, dy]) => wins(route.map(([x, y]) => [x + dx, y + dy]))).length;
    let jittered = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const stroke = route.map(([x, y], vertex) => [
        x + Math.round(Math.sin(seed * 7.31 + vertex * .51) * 8),
        y + Math.round(Math.cos(seed * 4.11 + vertex * .66) * 8),
      ]);
      if (wins(stroke)) jittered++;
    }
    return {
      pass: wins(route) && translated === 4 && jittered >= 9,
      detail: `${level.id} #${index + 1} ${translated}/4 translated, ${jittered}/12 jittered`,
    };
  });
}

function runPilotChecks(level) {
  const probes = [
    ["thorn-gully", "loadLimit", [[173, 521],[173, 446],[203, 423],[200, 485],[214, 457],[225, 530],
      [240, 546],[255, 572],[271, 621],[305, 645],[344, 603],[368, 581],[378, 571]]],
    ["jungle-challenge", "loadLimit", [[150, 534],[163, 500],[163, 440],[202, 440],[202, 480],[202, 448],
      [215, 523],[227, 538],[258, 598],[284, 631],[303, 630],[331, 600],[356, 578],[392, 577]]],
    ["reversing-wind", "iceFrom", [[235, 614],[248, 565],[243, 510],[289, 538],[318, 522],[336, 555],[338, 610]]],
    ["snow-challenge", "inkFactor", [[229, 605],[230, 550],[253, 511],[292, 491],[368, 494],[403, 516],[429, 555],[439, 605]]],
  ];
  const routes = [];
  const failures = [];
  for (const [id, rule, failingStroke] of probes) {
    const scene = level(id);
    routes.push(...checkStrokeTolerance(scene));
    let warned = false;
    const withRule = simulate(scene, failingStroke, round => {
      warned ||= round.fragilePlatforms.some(box => box.brokenAt === undefined && box.overload >= BRANCH_WARNING_TIME);
    });
    const withoutRule = rule === "inkFactor" ? { ...scene, wind: { ...scene.wind, inkFactor: 0 } } :
      { ...scene, boxes: scene.boxes.map(box => ({ ...box, [rule]: undefined })) };
    const branch = withRule.fragilePlatforms[0];
    const detached = rule !== "loadLimit" || (warned && branch.brokenAt !== undefined &&
      !withRule.terrain.includes(branch) && !rescueSupports(withRule).includes(branch.id));
    failures.push({
      pass: withRule.phase === "loss" && withRule.ink < scene.ink && detached && simulate(withoutRule, failingStroke).phase === "win",
      detail: id,
    });
  }
  return {
    pilotStrokeTolerance: { pass: routes.every(test => test.pass), detail: routes.map(test => test.detail).join("; ") },
    pilotMechanicsAffectOutcome: {
      pass: failures.every(test => test.pass),
      detail: failures.map(test => `${test.detail} ${test.pass ? "passed" : "failed"}`).join(", "),
    },
  };
}

function runChapterChallengeChecks(level) {
  const grass = level("grass-challenge");
  const lake = level("lake-challenge");
  const cliff = level("cliff-challenge");
  const volcano = level("volcano-challenge");
  const routes = [grass, lake, cliff, volcano].flatMap(checkStrokeTolerance);
  const withHeavyInstead = (scene, special) => ({
    ...scene, hives: scene.hives.map(hive => hive.special === special ? { ...hive, special: undefined, heavy: true } : hive),
  });
  const grassStroke = [[106, 726],[127, 671],[172, 628],[245, 597],[272, 607],
    [319, 597],[386, 624],[397, 644],[424, 697]];
  let chargeWarned = false;
  let chargeHitInk = false;
  const charged = simulate(grass, grassStroke, round => {
    const bee = round.bees.find(bee => bee.type === "charge");
    chargeWarned ||= bee.charge?.stage === "windup";
    chargeHitInk ||= bee.charge?.stage === "rush" && bee.flash > 0;
  });

  const lakeStroke = [[390, 525],[399, 445],[343, 438],[311, 535],[325, 539],[290, 559],
    [266, 657],[244, 653],[225, 646],[195, 613],[186, 585],[176, 571]];
  const floating = simulate(lake, lakeStroke);
  const stillLake = { ...lake, boxes: lake.boxes.map(box => box.kind === "float" ? { ...box, travel: undefined } : box) };

  const cliffStroke = [[189, 570],[178, 519],[217, 496],[262, 469],[326, 486],[360, 488],[373, 544],
    [377, 580],[402, 576],[416, 595],[428, 624],[418, 677],[406, 676]];
  let scoutFollowedInk = false;
  const scouted = simulate(cliff, cliffStroke, round => {
    scoutFollowedInk ||= round.bees.some(bee => bee.type === "scout" && bee.followInk && bee.wall > 1.4);
  });

  const lavaStroke = [[149, 518],[152, 444],[195, 446],[222, 513],[226, 517],[244, 581],
    [268, 634],[300, 640],[334, 639],[350, 546],[397, 549]];
  const rising = simulate(volcano, lavaStroke);
  const stillLava = { ...volcano, rescue: { ...volcano.rescue, hazard: { ...volcano.rescue.hazard, rise: 0 } } };
  const lossUnderBudget = round => round.phase === "loss" && round.ink < round.level.ink;
  return {
    chapterStrokeTolerance: { pass: routes.every(test => test.pass), detail: routes.map(test => test.detail).join("; ") },
    chargingBeeChangesOutcome: {
      pass: lossUnderBudget(charged) && chargeWarned && chargeHitInk &&
        simulate(withHeavyInstead(grass, "charge"), grassStroke).phase === "win",
      detail: "A charging bee warns, then hits the ink. The same stroke survives a heavy bee.",
    },
    movingFloatChangesOutcome: {
      pass: lossUnderBudget(floating) && floating.failure === "water" && floating.rescue.caught &&
        simulate(stillLake, lakeStroke).phase === "win",
      detail: "The hammock catches the bear before the float slides out. The same stroke holds on a stationary float.",
    },
    scoutingBeeChangesOutcome: {
      pass: lossUnderBudget(scouted) && scoutFollowedInk && scouted.stungBy === "scout" && scouted.touched === 1 &&
        simulate(withHeavyInstead(cliff, "scout"), cliffStroke).phase === "win",
      detail: "A scout follows the ink and reaches the lower bear. The same gap holds against a heavy bee.",
    },
    risingLavaChangesOutcome: {
      pass: lossUnderBudget(rising) && rising.failure === "lava" && rising.rescue.caught && rising.elapsed > volcano.time / 2 &&
        simulate(stillLava, lavaStroke).phase === "win",
      detail: "Rising lava reaches a hammock that was safe with both bee types at the original lava height.",
    },
  };
}
