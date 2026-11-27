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
  impactDuration: .27,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function nearestPoint(x, y, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((x - a.x) * dx + (y - a.y) * dy) / length, 0, 1) : 0;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function makeRound(level) {
  return {
    level, phase: "ready", ink: 0, points: [], inkBody: null, bees: [], effects: [],
    time: level.time, elapsed: 0, ticks: 0, stars: 0, touched: -1, bounces: 0,
  };
}

function discardStroke(round) {
  round.points = [];
  round.ink = 0;
}

function crossesTerrain(a, b, box) {
  // Permit a little overlap at an edge so a fingertip can easily seat the shield.
  const inset = 10;
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

function extendStroke(round, point) {
  point = { x: point.x, y: Math.min(point.y, BOARD.ground - RULES.lineRadius) };
  const points = round.points;
  const last = points.at(-1) || point;
  const delta = distance(last, point);
  if (delta < 1 && points.length) return "ignored";

  const available = round.level.ink - round.ink;
  if (available <= 0.01) return "dry";
  const fraction = delta > available ? available / delta : 1;
  const end = { x: last.x + (point.x - last.x) * fraction, y: last.y + (point.y - last.y) * fraction };
  const crossesPuppy = round.level.dogs.some(dog =>
    distance(dog, nearestPoint(dog.x, dog.y, last, end)) < RULES.puppyRadius + RULES.lineRadius
  );
  if (crossesPuppy) {
    discardStroke(round);
    return "puppy";
  }
  if (round.level.boxes.some(box => crossesTerrain(last, end, box))) {
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
  for (const [hiveIndex, hive] of round.level.hives.entries()) {
    for (let index = 0; index < hive.count; index++) {
      const id = round.bees.length;
      const yaw = index * 2.39996 + hiveIndex;
      round.bees.push({
        id, x: hive.x, y: hive.y + 5, vx: Math.cos(yaw) * 34, vy: Math.sin(yaw) * 34,
        delay: 0.16 + index * 0.13 + hiveIndex * 0.08, turn: id % 2 ? 1 : -1,
        wall: 0, normalX: 0, normalY: 0, flash: 0,
      });
    }
  }
  return true;
}

function turnAlongWall(bee, nx, ny) {
  bee.wall = 0.72;
  bee.normalX = nx;
  bee.normalY = ny;
}

function repel(bee, nx, ny, offset) {
  bee.x += nx * (offset + 0.02);
  bee.y += ny * (offset + 0.02);
  const normalSpeed = bee.vx * nx + bee.vy * ny;
  if (normalSpeed >= 0) return;
  bee.vx -= 1.48 * normalSpeed * nx;
  bee.vy -= 1.48 * normalSpeed * ny;
  turnAlongWall(bee, nx, ny);
}

function repelFromBox(bee, box) {
  const contact = boxContact(bee.x, bee.y, RULES.beeRadius, box);
  if (contact) repel(bee, contact.nx, contact.ny, contact.depth);
}

function repelFromInk(round, bee) {
  const body = round.inkBody;
  const points = body.path;
  const radius = RULES.beeRadius + RULES.lineRadius;
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
  const inverseBeeMass = 1 / INK_PHYSICS.beeMass;
  const impulse = -1.42 * speed / (inverseBeeMass + inverseInkMass(body, rx, ry, nx, ny));
  bee.vx += nx * impulse * inverseBeeMass;
  bee.vy += ny * impulse * inverseBeeMass;
  pushInk(body, rx, ry, -nx * impulse, -ny * impulse);
  turnAlongWall(bee, nx, ny);
  if (bee.flash <= 0 && speed < -12) {
    bee.flash = 0.18;
    flexInkAtImpact(body, segment, contact, -nx * impulse, -ny * impulse);
    round.bounces++;
    round.effects.push({ x: contact.x, y: contact.y, nx, ny, age: 0 });
  }
}

function steerBee(round, bee, dt) {
  const dogs = round.level.dogs;
  const target = dogs.reduce((best, dog) => distance(bee, dog) < distance(bee, best) ? dog : best);
  const angle = Math.atan2(target.y - bee.y, target.x - bee.x);
  const wander = 0.29 * Math.sin(round.elapsed * 5.5 + bee.id * 1.58);
  let vx = RULES.speed * Math.cos(angle + wander);
  let vy = RULES.speed * Math.sin(angle + wander);
  if (bee.wall > 0) {
    bee.wall = Math.max(0, bee.wall - dt);
    const turn = bee.turn * RULES.speed * 0.88;
    vx = vx * 0.26 - bee.normalY * turn + 14 * bee.normalX;
    vy = vy * 0.26 + bee.normalX * turn + 14 * bee.normalY;
  }
  const wind = (round.level.wind || 0) * Math.sin(round.elapsed * 2.2);
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
  const r = RULES.beeRadius;
  const passes = 2;
  for (let pass = 0; pass < passes; pass++) {
    if (bee.x < r) repel(bee, 1, 0, r - bee.x);
    if (bee.x > BOARD.width - r) repel(bee, -1, 0, bee.x - BOARD.width + r);
    if (bee.y < r) repel(bee, 0, 1, r - bee.y);
    if (bee.y > BOARD.ground - r) repel(bee, 0, -1, bee.y - BOARD.ground + r);
    for (const box of round.level.boxes) repelFromBox(bee, box);
    repelFromInk(round, bee);
  }
}

function stepRound(round, dt = RULES.step) {
  if (round.phase !== "playing") return;
  round.elapsed += dt;
  round.ticks++;
  round.time = Math.max(0, round.level.time - round.elapsed);
  stepInk(round, dt);
  for (const effect of round.effects) effect.age += dt;
  round.effects = round.effects.filter(effect => effect.age < RULES.impactDuration);
  for (const bee of round.bees) {
    if (bee.delay > round.elapsed) continue;
    moveBee(round, bee, dt);
    const touched = round.level.dogs.findIndex(dog => distance(dog, bee) < RULES.puppyRadius + RULES.beeRadius);
    if (touched >= 0) {
      round.touched = touched;
      round.phase = "loss";
      return;
    }
  }
  if (round.time <= 1e-9) {
    round.time = 0;
    round.phase = "win";
    round.stars = round.ink <= round.level.gold ? 3 : round.ink <= round.level.silver ? 2 : 1;
  }
}

function runEngineChecks() {
  function simulate(level, route, observe) {
    const round = makeRound(level);
    for (const [x, y] of route) extendStroke(round, { x, y });
    launchSwarm(round);
    for (let ticks = 0; ticks < 1200 && round.phase === "playing"; ticks++) {
      stepRound(round);
      observe?.(round);
    }
    return round;
  }
  const peakFlex = LEVELS.map(() => 0);
  const references = LEVELS.map((level, index) => simulate(level, level.guide, round => {
    peakFlex[index] = Math.max(peakFlex[index], round.inkBody.flex);
  }));
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
  return {
    guidedWins: { pass: references.every(round => round.phase === "win" && round.bounces > 0), detail: references.map(round => round.phase + "/" + round.bounces + "/" + round.stars).join(", ") },
    visibleImpact: { pass: peakFlex.every(peak => peak >= 12 && peak <= INK_PHYSICS.flexLimit),
      detail: "Supported shields briefly bend by " + peakFlex.map(peak => Math.round(peak)).join(", ") + " px along the tutorial paths." },
    weakLosses: { pass: weak.every(round => round.phase === "loss"), detail: weak.map(round => round.phase).join(", ") },
    puppyExclusion: { pass: crossing === "puppy" && !invalid.points.length, detail: "A sampled segment crossing a puppy clears the draft stroke." },
    budgetClamp: { pass: budget.ink === budget.level.ink && budget.points.at(-1).x === budget.level.ink + 10, detail: "Fast input is trimmed to the last available unit of ink." },
    tapIsSafe: { pass: !launchSwarm(tiny) && tiny.phase === "ready", detail: "A point or short mark does not start a round." },
    fallsOntoGround: { pass: Math.abs(dropped.inkBody.y - BOARD.ground + RULES.lineRadius) < 1 &&
        Math.abs(dropped.inkBody.vy) < 1 && dropped.inkBody.flex === 0,
      detail: "An airborne stroke falls and comes to rest with no bending when no bees hit it." },
    impactOpensGap: { pass: Math.abs(standing.inkBody.angle) < .02 && Math.abs(tipped.inkBody.angle) > .5 &&
        gap > RULES.beeRadius * 2 && tipped.phase === "loss" && tipped.bounces > 0,
      detail: "Bee impacts tip a wall away from its ceiling, opening a " + Math.round(gap) + " px gap." },
    ringRolls: { pass: rolled.inkBody.x > 448 && Math.abs(rolled.inkBody.angle) > .8 && rolled.bounces > 0,
      detail: "A round stroke translates and rotates along the grass in response to impacts." },
  };
}
