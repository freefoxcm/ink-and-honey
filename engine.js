"use strict";

const RULES = Object.freeze({
  step: 1 / 120,
  puppyRadius: 30,
  lineRadius: 6,
  beeRadius: 8,
  minInk: 22,
  sampleSpacing: 8,
  speed: 103,
  maxSpeed: 153,
  heavyBeeMass: 1.55,
  hiveWarning: .7,
});

const CHARGE = Object.freeze({ range: 185, windup: .52, speed: 225, duration: .48, recovery: 2.25 });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function nearestPoint(x, y, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((x - a.x) * dx + (y - a.y) * dy) / length, 0, 1) : 0;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function makeWaves(level) {
  const times = level.waveTimes ?? [0];
  const waves = times.map(at => ({ at, launches: [] }));
  level.hives.forEach((hive, hiveIndex) => {
    const index = hive.wave ?? Math.min(hiveIndex, waves.length - 1);
    waves[index].launches.push({ hiveIndex, count: hive.count, heavy: Boolean(hive.heavy && !hive.special), special: hive.special });
  });
  return waves;
}

function makeRound(level) {
  const board = level.board ?? BOARD;
  const ground = groundFor(level, board);
  const platforms = level.boxes.map(box => ({ ...box, vx: 0, vy: 0 }));
  const dogs = level.dogs.map(dog => ({ ...dog, vx: 0, vy: 0 }));
  const round = {
    level, board, phase: "ready", ink: 0, points: [], inkBody: null, bees: [], effects: [],
    ground, platforms, terrain: [...ground, ...platforms], dogs, waves: makeWaves(level),
    fragilePlatforms: platforms.filter(box => box.loadLimit !== undefined),
    time: level.time, elapsed: 0, ticks: 0, stars: 0, touched: -1, bounces: 0,
    rescue: level.rescue ? { released: false, caught: false, supported: false, teeth: rescueSpikeTeeth(level.rescue.hazard) } : null,
    failure: null,
  };
  updateScene(round);
  return round;
}

function discardStroke(round) {
  round.points = [];
  round.ink = 0;
}

function crossesBox(a, b, box, inset = 0) {
  let entry = 0;
  let exit = 1;
  for (const [start, end, min, max] of [
    [a.x, b.x, box.x + inset, box.x + box.w - inset],
    [a.y, b.y, box.y + inset, box.y + box.h - inset],
  ]) {
    const delta = end - start;
    if (min >= max || (!delta && (start <= min || start >= max))) return false;
    if (!delta) continue;
    const first = (min - start) / delta;
    const last = (max - start) / delta;
    entry = Math.max(entry, Math.min(first, last));
    exit = Math.min(exit, Math.max(first, last));
  }
  return entry <= exit;
}

function crossesPatrol(a, b, dog, radius) {
  const target = dog.patrol.to;
  const start = Math.min(dog.x, target);
  const end = Math.max(dog.x, target);
  return crossesBox(a, b, { x: start, y: dog.y - radius, w: end - start, h: radius * 2 }) ||
    distance({ x: target, y: dog.y }, nearestPoint(target, dog.y, a, b)) < radius;
}

function extendStroke(round, point) {
  const floor = round.ground.find(box => point.x >= box.x && point.x < box.x + box.w);
  point = { x: point.x, y: Math.min(point.y, (floor?.y ?? round.board.ground) - RULES.lineRadius) };
  const points = round.points;
  const last = points.at(-1) || point;
  const delta = distance(last, point);
  if (delta < 1 && points.length) return "ignored";

  const available = round.level.ink - round.ink;
  if (available <= 0.01) return "dry";
  const fraction = delta > available ? available / delta : 1;
  const end = { x: last.x + (point.x - last.x) * fraction, y: last.y + (point.y - last.y) * fraction };
  const radius = (round.rescue ? RESCUE_PHYSICS.footRadius : RULES.puppyRadius) + RULES.lineRadius;
  const crossesPuppy = round.dogs.some(dog => distance(dog, nearestPoint(dog.x, dog.y, last, end)) < radius);
  if (crossesPuppy) {
    discardStroke(round);
    return "puppy";
  }
  if (round.level.dogs.some(dog => dog.patrol && crossesPatrol(last, end, dog, radius))) {
    discardStroke(round);
    return "patrol";
  }
  // Leave a little room to seat the line at a ledge with a fingertip.
  if (round.terrain.some(box => crossesBox(last, end, box, 10))) {
    discardStroke(round);
    return "terrain";
  }
  const samples = Math.max(1, Math.ceil(distance(last, end) / RULES.sampleSpacing));
  for (let index = 1; index <= samples; index++) {
    points.push({ x: last.x + (end.x - last.x) * index / samples, y: last.y + (end.y - last.y) * index / samples });
  }
  round.ink += delta * fraction;
  return fraction < 1 ? "dry" : "ok";
}

function launchSwarm(round) {
  if (round.phase !== "ready" || round.ink < RULES.minInk) return false;
  round.inkBody = createInkBody(round.points);
  round.phase = "playing";
  if (round.rescue && !round.level.rescue.releaseAt) round.rescue.released = true;
  for (const wave of round.waves) {
    for (const { hiveIndex, count, heavy, special } of wave.launches) {
      const hive = round.level.hives[hiveIndex];
      for (let index = 0; index < count + Number(Boolean(heavy || special)); index++) {
        const id = round.bees.length;
        const yaw = index * 2.39996 + hiveIndex;
        const type = index === 0 ? special : undefined;
        const isHeavy = index === 0 && heavy;
        round.bees.push({
          id, x: hive.x, y: hive.y + 5, vx: Math.cos(yaw) * 34, vy: Math.sin(yaw) * 34,
          delay: wave.at + index * .14, heavy: isHeavy, type, turn: id % 2 ? 1 : -1,
          radius: type === "scout" ? 5 : RULES.beeRadius + (isHeavy || type === "charge" ? 2 : 0),
          wall: 0, normalX: 0, normalY: 0, flash: 0,
        });
      }
    }
  }
  return true;
}

function turnAlongWall(bee, nx, ny, followInk = false) {
  bee.wall = followInk ? 1.4 : .72;
  bee.followInk = followInk;
  bee.normalX = nx;
  bee.normalY = ny;
}

function repel(bee, nx, ny, offset, vx = 0, vy = 0) {
  bee.x += nx * (offset + 0.02);
  bee.y += ny * (offset + 0.02);
  const normalSpeed = (bee.vx - vx) * nx + (bee.vy - vy) * ny;
  if (normalSpeed >= 0) return;
  bee.vx -= 1.48 * normalSpeed * nx;
  bee.vy -= 1.48 * normalSpeed * ny;
  turnAlongWall(bee, nx, ny);
}

function repelFromBox(bee, box) {
  const contact = boxContact(bee.x, bee.y, bee.radius, box);
  if (contact) repel(bee, contact.nx, contact.ny, contact.depth, box.vx, box.vy);
}

function repelFromInk(round, bee) {
  const body = round.inkBody;
  const points = body.path;
  const radius = bee.radius + RULES.lineRadius;
  let separation = radius;
  let contact = null;
  let segment = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    if (bee.x < Math.min(a.x, b.x) - radius || bee.x > Math.max(a.x, b.x) + radius ||
        bee.y < Math.min(a.y, b.y) - radius || bee.y > Math.max(a.y, b.y) + radius) continue;
    const p = nearestPoint(bee.x, bee.y, a, b);
    const gap = distance(bee, p);
    if (gap < separation) {
      separation = gap;
      contact = p;
      segment = index;
    }
  }
  if (!contact) return;
  const approach = Math.hypot(bee.vx, bee.vy);
  const nx = separation ? (bee.x - contact.x) / separation : approach ? -bee.vx / approach : 1;
  const ny = separation ? (bee.y - contact.y) / separation : approach ? -bee.vy / approach : 0;
  bee.x += nx * (radius - separation + .02);
  bee.y += ny * (radius - separation + .02);

  const rx = contact.x + nx * RULES.lineRadius - body.x;
  const ry = contact.y + ny * RULES.lineRadius - body.y;
  const speed = bee.vx * nx + bee.vy * ny - inkSpeedAt(body, rx, ry, nx, ny);
  if (speed >= 0) return;
  const mass = bee.type === "scout" ? .48 : bee.heavy || bee.type === "charge" ? RULES.heavyBeeMass : INK_PHYSICS.beeMass;
  const inverseBeeMass = 1 / mass;
  const impulse = -1.42 * speed / (inverseBeeMass + inverseInkMass(body, rx, ry, nx, ny));
  bee.vx += nx * impulse * inverseBeeMass;
  bee.vy += ny * impulse * inverseBeeMass;
  pushInk(body, rx, ry, -nx * impulse, -ny * impulse);
  turnAlongWall(bee, nx, ny, true);
  if (bee.type === "scout") {
    const towardStart = distance(contact, points[0]) < distance(contact, points.at(-1));
    const a = points[segment - 1];
    const b = points[segment];
    const alongWall = -(b.x - a.x) * ny + (b.y - a.y) * nx;
    bee.turn = (Math.sign(alongWall) || 1) * (towardStart ? -1 : 1);
    bee.wall = 1.9;
  }
  if (bee.flash <= 0 && speed < -12) {
    bee.flash = 0.18;
    round.bounces++;
    round.effects.push({ x: bee.x, y: bee.y, age: 0, id: bee.id });
  }
}

function steerChargingBee(round, bee, dt, target, angle) {
  const now = round.elapsed;
  if (bee.charge?.stage === "rush") {
    if (now < bee.charge.until && bee.wall === 0) return true;
    bee.charge = null;
    bee.chargeReadyAt = now + CHARGE.recovery;
  }
  if (!bee.charge && bee.wall === 0 && (bee.chargeReadyAt ?? 0) <= now && distance(bee, target) <= CHARGE.range) {
    bee.charge = { stage: "windup", until: now + CHARGE.windup, angle };
  }
  if (!bee.charge) return false;
  if (now < bee.charge.until) {
    const brake = Math.exp(-14 * dt);
    bee.vx *= brake;
    bee.vy *= brake;
    return true;
  }
  const aim = bee.charge.angle;
  bee.charge = { stage: "rush", until: now + CHARGE.duration, angle: aim };
  bee.vx = Math.cos(aim) * CHARGE.speed + windAt(round.level, now);
  bee.vy = Math.sin(aim) * CHARGE.speed;
  return true;
}

function steerBee(round, bee, dt) {
  const dogs = round.dogs;
  const target = dogs.reduce((best, dog) => distance(bee, dog) < distance(bee, best) ? dog : best);
  const angle = Math.atan2(target.y - bee.y, target.x - bee.x);
  if (bee.type === "charge" && steerChargingBee(round, bee, dt, target, angle)) return;
  const wander = 0.29 * Math.sin(round.elapsed * 5.5 + bee.id * 1.58);
  let vx = RULES.speed * Math.cos(angle + wander);
  let vy = RULES.speed * Math.sin(angle + wander);
  if (bee.wall > 0) {
    bee.wall = Math.max(0, bee.wall - dt);
    const turn = bee.turn * RULES.speed * 0.88;
    const pull = bee.followInk ? (bee.type === "scout" ? 4 : -9) : 14;
    vx = vx * 0.26 - bee.normalY * turn + pull * bee.normalX;
    vy = vy * 0.26 + bee.normalX * turn + pull * bee.normalY;
  }
  const wind = windAt(round.level, round.elapsed);
  bee.vx += (vx + wind - bee.vx) * 4.8 * dt;
  bee.vy += (vy - bee.vy) * 4.8 * dt;
  const speed = Math.hypot(bee.vx, bee.vy);
  if (speed > RULES.maxSpeed) {
    bee.vx *= RULES.maxSpeed / speed;
    bee.vy *= RULES.maxSpeed / speed;
  }
}

function moveBee(round, bee, dt) {
  steerBee(round, bee, dt);
  bee.x += bee.vx * dt;
  bee.y += bee.vy * dt;
  bee.flash = Math.max(0, bee.flash - dt);
  const r = bee.radius;
  const passes = 2;
  for (let pass = 0; pass < passes; pass++) {
    if (bee.x < r) repel(bee, 1, 0, r - bee.x);
    if (bee.x > round.board.width - r) repel(bee, -1, 0, bee.x - round.board.width + r);
    if (bee.y < r) repel(bee, 0, 1, r - bee.y);
    for (const box of round.terrain) repelFromBox(bee, box);
    repelFromInk(round, bee);
  }
}

function stepRound(round, dt = RULES.step) {
  if (round.phase !== "playing") return;
  round.elapsed += dt;
  round.ticks++;
  round.time = Math.max(0, round.level.time - round.elapsed);
  updateScene(round);
  stepInk(round, dt);
  if (round.rescue?.released) stepRescueDog(round, dt);
  if (round.phase === "loss") return;
  for (const effect of round.effects) effect.age += dt;
  round.effects = round.effects.filter(effect => effect.age < 0.39);
  for (const bee of round.bees) {
    if (bee.delay > round.elapsed) continue;
    moveBee(round, bee, dt);
    const touched = round.dogs.findIndex(dog => distance(dog, bee) < RULES.puppyRadius + bee.radius);
    if (touched >= 0) {
      round.touched = touched;
      round.stungBy = bee.type;
      round.failure = "bees";
      round.phase = "loss";
      return;
    }
  }
  if (round.time <= 1e-9) {
    round.time = 0;
    if (round.rescue && !round.rescue.caught) {
      round.failure = "missed";
      round.phase = "loss";
      return;
    }
    round.phase = "win";
    round.stars = round.ink <= round.level.gold ? 3 : round.ink <= round.level.silver ? 2 : 1;
  }
}

function simulate(level, route, onStep) {
  const round = makeRound(level);
  for (const [x, y] of route) {
    const event = extendStroke(round, { x, y });
    if (event === "puppy" || event === "patrol" || event === "terrain") return round;
  }
  launchSwarm(round);
  const limit = Math.ceil(level.time / RULES.step) + 1;
  for (let ticks = 0; ticks < limit && round.phase === "playing"; ticks++) {
    stepRound(round);
    onStep?.(round);
  }
  return round;
}

function runEngineChecks() {
  const references = LEVELS.map(level => simulate(level, level.guide));
  const alternateWins = LEVELS.filter(level => level.challenge).map(level => simulate(level, level.alternate));
  const rectangleWins = LEVELS.map(level => {
    const left = Math.min(...level.dogs.map(dog => Math.min(dog.x, dog.patrol?.to ?? dog.x))) - 48;
    const right = Math.max(...level.dogs.map(dog => Math.max(dog.x, dog.patrol?.to ?? dog.x))) + 48;
    const top = Math.min(...level.dogs.map(dog => dog.y)) - 52;
    const bottom = Math.max(...level.dogs.map(dog => dog.y)) + 35 - RULES.lineRadius;
    return simulate(level, [[left, bottom], [left, top], [right, top], [right, bottom]]);
  }).filter(round => round.phase === "win");
  const weak = LEVELS.map(level => simulate(level, [[18, 91], [58, 94]]));
  const invalid = makeRound(LEVELS[0]);
  const puppy = invalid.level.dogs[0];
  extendStroke(invalid, { x: puppy.x - 60, y: puppy.y });
  const crossing = extendStroke(invalid, { x: puppy.x + 60, y: puppy.y });
  const budget = makeRound(LEVELS[0]);
  extendStroke(budget, { x: 10, y: 95 });
  extendStroke(budget, { x: 890, y: 95 });
  const tiny = makeRound(LEVELS[0]);
  extendStroke(tiny, { x: 10, y: 95 });
  const dropped = simulate({ ...LEVELS[0], hives: [] }, [[143, 100], [234, 100]]);
  const gapLevel = {
    ...LEVELS[0], time: 9, dogs: [{ x: 652, y: 332 }], hives: [{ x: 248, y: 308, count: 10 }],
    boxes: [{ x: 205, y: 230, w: 635, h: 27 }, { x: 566, y: 367, w: 166, h: 27 }],
  };
  const upright = [[475, 263], [475, 472]];
  const standing = simulate({ ...gapLevel, hives: [] }, upright);
  const tipped = simulate(gapLevel, upright);
  const gap = tipped.inkBody.path[0].y - RULES.lineRadius - (gapLevel.boxes[0].y + gapLevel.boxes[0].h);
  const ring = Array.from({ length: 41 }, (_, index) => {
    const angle = index * Math.PI / 20;
    return [398 + 44 * Math.cos(angle), 428 + 44 * Math.sin(angle)];
  });
  const rolled = simulate({
    ...LEVELS[0], time: 8, dogs: [{ x: 570, y: 443 }], hives: [{ x: 244, y: 414, count: 8 }],
  }, ring);
  const pit = { x: 400, width: 120, bottom: 546 };
  const pitScene = { ...LEVELS[0], dogs: [], hives: [], pits: [pit] };
  const fallen = simulate(pitScene, [[435, 380], [483, 380]]);
  function pitEntrance(opening) {
    return simulate({
      ...pitScene, dogs: [{ x: 460, y: 511 }], hives: [{ x: 460, y: 375, count: 6 }],
      boxes: [
        { x: 380, y: 460, w: 80 - opening / 2, h: 24 },
        { x: 460 + opening / 2, y: 460, w: 80 - opening / 2, h: 24 },
      ],
    }, [[20, 155], [65, 155]]);
  }
  const patrolLevel = LEVELS.find(level => level.id === "first-patrol");
  const patrol = makeRound(patrolLevel);
  extendStroke(patrol, { x: 519, y: 384 });
  const crossesRoute = extendStroke(patrol, { x: 519, y: 461 });
  patrol.elapsed = patrolLevel.dogs[0].patrol.period / 2;
  updateScene(patrol);
  // An upward-moving shelf must lift resting ink even in the absence of bees.
  const lift = {
    ...LEVELS[0], time: 2.75, dogs: [], hives: [],
    boxes: [{ x: 400, y: 350, w: 150, h: 20, travel: { dy: -55, period: 5.5 } }],
  };
  const lifted = simulate(lift, [[429, 344], [509, 344]]);
  const [waterRescue, spikeRescue, lavaRescue, lonePeg] = RESCUE_LEVELS;
  const rescueGuide = waterRescue.guide;
  const rescueSingleBranch = [
    rescueGuide,
    rescueGuide.map(([x, y]) => [x + 6, y + 5]).reverse(),
    rescueGuide.map(([x, y]) => [x - 5, y - 6]),
  ].map(route => simulate(waterRescue, route));
  const rescueTwoBranches = simulate(waterRescue, [
    [267, 293], [280, 218], [360, 205], [407, 287], [428, 296], [464, 346], [517, 348], [547, 321], [590, 262], [653, 262],
  ]);
  const rescueExposed = simulate(waterRescue, [[274, 296], [653, 262]]);
  const rescueDeep = simulate(waterRescue, [
    ...rescueGuide.slice(0, 5), [450, 301], [463, 377], [486, 465], [528, 466],
  ]);
  const rescueUnsupported = simulate(waterRescue, [[450, 328], [487, 361], [535, 338]]);
  const newRescueWins = [spikeRescue, lavaRescue].map(level => [level.guide,
    level.guide.map(([x, y]) => [x + 4, y + 3]).reverse()].map(route => simulate(level, route)));
  const spikeFall = simulate(spikeRescue, [[450, 331], [484, 368], [521, 332]]);
  const [leftBase, firstTip] = spikeFall.rescue.teeth[0];
  const tipHeight = firstTip.y - RESCUE_PHYSICS.footRadius;
  const actualSpikeContact = touchesRescueHazard(spikeFall, { x: firstTip.x, y: tipHeight }, RESCUE_PHYSICS.footRadius) &&
    !touchesRescueHazard(spikeFall, { x: leftBase.x, y: tipHeight }, RESCUE_PHYSICS.footRadius);
  const risingLava = simulate(lavaRescue, [...lavaRescue.guide.slice(0, 5),
    [426, 314], [451, 370], [454, 471], [531, 471], [552, 386], [548, 336], [570, 296], [642, 295]]);
  const lonePegWins = [
    lonePeg.guide,
    lonePeg.guide.map(([x, y]) => [x + 4, y + 4]).reverse(),
    [[413, 205], [395, 170], [395, 124], [509, 124], [516, 165], [534, 210], [535, 302], [511, 348],
      [451, 351], [413, 296], [404, 231], [422, 207], [468, 192], [527, 205]],
  ].map(route => simulate(lonePeg, route));
  const slippedOffPeg = simulate(lonePeg, [[470, 133], [532, 136], [599, 190], [633, 285], [572, 361], [478, 370], [437, 316]]);
  const campaignWins = CAMPAIGN_LEVELS.map(level => simulate(level, level.guide));
  const challengeAlternateWins = CAMPAIGN_LEVELS.filter(level => level.challenge).map(level => simulate(level, level.alternate));
  const jungleFinal = JUNGLE_PREVIEW.at(-1);
  const shiftedJungleWins = [
    simulate(jungleFinal, jungleFinal.guide.map(([x, y]) => [x + 5, y - 4])),
    simulate(jungleFinal, jungleFinal.alternate.map(([x, y]) => [x + 4, y + 3]).reverse()),
  ];
  const forestDrop = JUNGLE_PREVIEW[3];
  let sawPatrol = false;
  let fellFromMarker = false;
  let dropTime = null;
  const dropWin = simulate(forestDrop, forestDrop.guide, round => {
    const [dog] = round.dogs;
    if (!round.rescue.released && dog.x > forestDrop.dogs[0].x && dog.x < dog.patrol.to && dog.y === forestDrop.dogs[0].y) sawPatrol = true;
    if (round.rescue.released && dropTime === null) {
      dropTime = round.elapsed;
      fellFromMarker = Math.abs(dog.x - dog.patrol.to) < .1 && Math.abs(dog.vx) < .1;
    }
  });
  const forestMiss = simulate(jungleFinal, [[432, 323], [477, 355], [532, 324]]);
  const reusedIds = new Set(CAMPAIGN_LEVELS.filter(level => !level.challenge).map(level => level.id));
  const waveTimings = references.every(round => round.waves.every(({ at, launches }) =>
    launches.length > 0 && round.bees.some(bee => bee.delay === at) &&
    launches.filter(launch => launch.heavy).length === Number(round.level.challenge && at !== 0) &&
    round.bees.filter(bee => bee.heavy && bee.delay === at).length === launches.filter(launch => launch.heavy).length));
  return {
    guidedWins: { pass: references.length === 20 && references.every(round => round.phase === "win" &&
        round.bounces > 0 && round.ticks === Math.round(round.level.time / RULES.step)),
      detail: references.map(round => round.phase + "/" + round.bounces + "/" + round.stars).join(", ") },
    challengeAlternatives: { pass: alternateWins.length === 4 && alternateWins.every(round => round.phase === "win"),
      detail: "Each challenge has a second route that survives the entire attack." },
    rectangleLimits: { pass: rectangleWins.length <= 6 && rectangleWins.every(round => !round.level.challenge),
      detail: "The standard rectangle wins " + rectangleWins.length + " levels and cannot clear a challenge." },
    waveTimings: { pass: waveTimings,
      detail: "Every scheduled wave has a timed release, with a heavy bee in each later challenge wave." },
    weakLosses: { pass: weak.every(round => round.phase === "loss"), detail: weak.map(round => round.phase).join(", ") },
    puppyExclusion: { pass: crossing === "puppy" && !invalid.points.length, detail: "A sampled segment crossing a puppy clears the draft stroke." },
    budgetClamp: { pass: budget.ink === budget.level.ink && budget.points.at(-1).x === budget.level.ink + 10, detail: "Fast input is trimmed to the last available unit of ink." },
    tapIsSafe: { pass: !launchSwarm(tiny) && tiny.phase === "ready", detail: "A point or short mark does not start a round." },
    fallsOntoGround: { pass: Math.abs(dropped.inkBody.y - BOARD.ground + RULES.lineRadius) < 1 &&
        Math.abs(dropped.inkBody.vy) < 1, detail: "An airborne stroke falls and comes to rest on the grass." },
    impactOpensGap: { pass: Math.abs(standing.inkBody.angle) < .02 && Math.abs(tipped.inkBody.angle) > .5 &&
        gap > RULES.beeRadius * 2 && tipped.phase === "loss" && tipped.bounces > 0,
      detail: "Bee impacts tip a wall away from its ceiling, opening a " + Math.round(gap) + " px gap." },
    ringRolls: { pass: rolled.inkBody.x > 448 && Math.abs(rolled.inkBody.angle) > .8 && rolled.bounces > 0,
      detail: "A round stroke translates and rotates along the grass in response to impacts." },
    inkFallsIntoPit: { pass: Math.abs(fallen.inkBody.y - pit.bottom + RULES.lineRadius) < 1,
      detail: "Unsupported ink passes the rim and rests on the visible pit floor." },
    gapsControlBeePassage: { pass: pitEntrance(8).phase === "win" && pitEntrance(36).phase === "loss",
      detail: "Bees reach a puppy through a wide gap and are blocked by a narrow gap." },
    patrolPathIsProtected: { pass: crossesRoute === "patrol" && patrol.dogs[0].x === patrolLevel.dogs[0].patrol.to,
      detail: "The shown patrol blocks drawing through future positions and the dog reaches the shown endpoint." },
    platformLiftsInk: { pass: Math.abs(lifted.inkBody.y - (lifted.platforms[0].y - RULES.lineRadius)) < 2 &&
        lifted.inkBody.y < 300, detail: "The moving collision surface lifts the stroke to its visible position." },
    rescueSingleBranch: { pass: rescueSingleBranch.every(round => round.phase === "win" && round.rescue.caught &&
        round.bounces > 0 && rescueSupports(round).join() === "left"),
      detail: "The same shape wins with one branch when shifted or drawn in reverse." },
    rescueTwoBranches: { pass: rescueTwoBranches.phase === "win" && rescueTwoBranches.rescue.caught &&
        rescueSupports(rescueTwoBranches).length === 2,
      detail: "A different shape can rest on both branches and win." },
    rescueFallsWithoutSupport: { pass: rescueUnsupported.phase === "loss" && rescueUnsupported.failure === "water" &&
        rescueUnsupported.ticks > 0 && rescueSupports(rescueUnsupported).length === 0,
      detail: "An unsupported stroke starts the round and falls into the river without snapping." },
    rescueLowCradle: { pass: rescueDeep.phase === "loss" && rescueDeep.rescue.caught && rescueDeep.failure === "water",
      detail: "A branch can hold the stroke while the cradle dips too close to the water." },
    rescueExposedToBees: { pass: rescueExposed.phase === "loss" && rescueExposed.rescue.caught && rescueExposed.failure === "bees",
      detail: "A straight stroke can hold the pup but still leave an opening for bees." },
    rescuePegAndCliffWins: { pass: newRescueWins.flat().every(round => round.phase === "win" && round.rescue.caught &&
        round.bounces > 0 && rescueSupports(round).length > 0),
      detail: "The peg and cliff routes survive even with offset strokes drawn in the other direction." },
    rescueSpikesMatchTeeth: { pass: spikeFall.phase === "loss" && spikeFall.failure === "spikes" && actualSpikeContact,
      detail: "A pup can touch a spike tip, while the air at the same height between tips stays clear." },
    rescueRisingLava: { pass: risingLava.phase === "loss" && risingLava.failure === "lava" && risingLava.rescue.caught &&
        risingLava.elapsed > 5 && rescueSupports(risingLava).length > 0 && rescueHazardY(risingLava) < lavaRescue.rescue.hazard.y,
      detail: "Rising lava eventually reaches a caught pup even while the ink remains supported." },
    rescueLonePeg: { pass: lonePeg.boxes.length === 1 && lonePegWins.every(round => round.phase === "win" &&
        round.rescue.caught && round.bounces > 0 && rescueSupports(round).join() === lonePeg.boxes[0].id),
      detail: "Different hooks can catch and guard the pup on the only peg, even when drawn in reverse." },
    rescueLonePegSlips: { pass: slippedOffPeg.phase === "loss" && slippedOffPeg.failure === "water" &&
        slippedOffPeg.rescue.caught && Math.abs(slippedOffPeg.inkBody.angle) > .5 && rescueSupports(slippedOffPeg).length === 0,
      detail: "An off-center stroke catches the pup briefly but rotates and slips off the peg." },
    campaignStructure: { pass: CAMPAIGN_CHAPTERS.map(chapter => chapter.id).join() === "grass,jungle,lake,cliff,snow,volcano" &&
        CAMPAIGN_CHAPTERS.every(chapter => chapter.levels.length === 5 && chapter.levels.every((level, index) => level.challenge === (index === 4))) &&
        new Set(CAMPAIGN_LEVELS.map(level => level.id)).size === 30 && [...LEVELS, ...RESCUE_LEVELS].every(level => reusedIds.has(level.id)),
      detail: "Six chapters reuse all 24 saved level IDs and each adds a new final challenge." },
    campaignReferences: { pass: campaignWins.length === 30 && campaignWins.every(round => round.phase === "win" && round.bounces > 0),
      detail: campaignWins.filter(round => round.phase !== "win").map(round => round.level.id + ": " + round.phase).join(", ") || "All 30 reference strokes win." },
    campaignChallengeAlternates: { pass: challengeAlternateWins.length === 6 && challengeAlternateWins.every(round => round.phase === "win"),
      detail: challengeAlternateWins.filter(round => round.phase !== "win").map(round => round.level.id).join(", ") || "Each chapter challenge has a second winning shape." },
    jungleChallengeTolerance: { pass: shiftedJungleWins.every(round => round.phase === "win") && forestMiss.phase === "loss" && forestMiss.failure === "spikes",
      detail: "Both shifted shapes win, while a stroke that cannot find a support falls into the spikes." },
    patrolIntoDrop: { pass: sawPatrol && fellFromMarker && Math.abs(dropTime - forestDrop.rescue.releaseAt) <= RULES.step &&
        dropWin.phase === "win" && dropWin.rescue.caught,
      detail: "The bear walks at a fixed height, releases at the marked edge, and can be caught by ink." },
  };
}
