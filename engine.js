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
    level, phase: "ready", ink: 0, points: [], bees: [], effects: [],
    time: level.time, elapsed: 0, ticks: 0, stars: 0, touched: -1, bounces: 0,
  };
}

function discardStroke(round) {
  round.points = [];
  round.ink = 0;
}

function extendStroke(round, point) {
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
  const samples = Math.max(1, Math.ceil(distance(last, end) / RULES.sampleSpacing));
  for (let index = 1; index <= samples; index++) {
    points.push({ x: last.x + (end.x - last.x) * index / samples, y: last.y + (end.y - last.y) * index / samples });
  }
  round.ink += delta * fraction;
  return fraction < 1 ? "dry" : "ok";
}

function launchSwarm(round) {
  if (round.phase !== "ready" || round.ink < RULES.minInk) return false;
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

function repel(bee, nx, ny, offset) {
  bee.x += nx * (offset + 0.02);
  bee.y += ny * (offset + 0.02);
  const normalSpeed = bee.vx * nx + bee.vy * ny;
  if (normalSpeed >= 0) return false;
  bee.vx -= 1.48 * normalSpeed * nx;
  bee.vy -= 1.48 * normalSpeed * ny;
  bee.wall = 0.53;
  bee.normalX = nx;
  bee.normalY = ny;
  return true;
}

function repelFromBox(bee, box) {
  const r = RULES.beeRadius;
  const nearX = clamp(bee.x, box.x, box.x + box.w);
  const nearY = clamp(bee.y, box.y, box.y + box.h);
  const dx = bee.x - nearX;
  const dy = bee.y - nearY;
  const gap = Math.hypot(dx, dy);
  if (gap >= r) return;
  if (gap > 0.0001) {
    repel(bee, dx / gap, dy / gap, r - gap);
    return;
  }
  const sides = [
    { distance: bee.x - box.x, nx: -1, ny: 0 },
    { distance: box.x + box.w - bee.x, nx: 1, ny: 0 },
    { distance: bee.y - box.y, nx: 0, ny: -1 },
    { distance: box.y + box.h - bee.y, nx: 0, ny: 1 },
  ];
  const closest = sides.reduce((best, side) => side.distance < best.distance ? side : best);
  repel(bee, closest.nx, closest.ny, r + closest.distance);
}

function repelFromInk(round, bee) {
  const r = RULES.beeRadius + RULES.lineRadius;
  let hit = false;
  for (let index = 1; index < round.points.length; index++) {
    const a = round.points[index - 1];
    const b = round.points[index];
    if (bee.x < Math.min(a.x, b.x) - r || bee.x > Math.max(a.x, b.x) + r ||
        bee.y < Math.min(a.y, b.y) - r || bee.y > Math.max(a.y, b.y) + r) continue;
    const nearest = nearestPoint(bee.x, bee.y, a, b);
    const dx = bee.x - nearest.x;
    const dy = bee.y - nearest.y;
    const gap = Math.hypot(dx, dy);
    if (gap >= r) continue;
    const normalScale = 1 / (gap || Math.hypot(bee.vx, bee.vy) || 1);
    const bounced = repel(bee, (gap ? dx : -bee.vx) * normalScale,
      (gap ? dy : -bee.vy) * normalScale, r - gap);
    hit ||= bounced;
  }
  if (hit && bee.flash <= 0) {
    bee.flash = 0.18;
    round.bounces++;
    round.effects.push({ x: bee.x, y: bee.y, age: 0, id: bee.id });
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
    vx = vx * 0.26 - bee.normalY * turn + 24 * bee.normalX;
    vy = vy * 0.26 + bee.normalX * turn + 24 * bee.normalY;
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
  for (const effect of round.effects) effect.age += dt;
  round.effects = round.effects.filter(effect => effect.age < 0.39);
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
  function simulate(level, route) {
    const round = makeRound(level);
    for (const [x, y] of route) extendStroke(round, { x, y });
    launchSwarm(round);
    for (let ticks = 0; ticks < 1200 && round.phase === "playing"; ticks++) stepRound(round);
    return round;
  }
  const references = LEVELS.map(level => simulate(level, level.guide));
  const weak = LEVELS.map(level => simulate(level, [[BAIT_X, 91], [BAIT_X + 40, 94]]));
  const invalid = makeRound(LEVELS[0]);
  const puppy = invalid.level.dogs[0];
  extendStroke(invalid, { x: puppy.x - 60, y: puppy.y });
  const crossing = extendStroke(invalid, { x: puppy.x + 60, y: puppy.y });
  const budget = makeRound(LEVELS[0]);
  extendStroke(budget, { x: 10, y: 95 });
  extendStroke(budget, { x: 890, y: 95 });
  const tiny = makeRound(LEVELS[0]);
  extendStroke(tiny, { x: 10, y: 95 });
  return {
    guidedWins: { pass: references.every(round => round.phase === "win" && round.bounces > 0), detail: references.map(round => round.phase + "/" + round.bounces + "/" + round.stars).join(", ") },
    weakLosses: { pass: weak.every(round => round.phase === "loss"), detail: weak.map(round => round.phase).join(", ") },
    puppyExclusion: { pass: crossing === "puppy" && !invalid.points.length, detail: "A sampled segment crossing a puppy clears the draft stroke." },
    budgetClamp: { pass: budget.ink === budget.level.ink && budget.points.at(-1).x === budget.level.ink + 10, detail: "Fast input is trimmed to the last available unit of ink." },
    tapIsSafe: { pass: !launchSwarm(tiny) && tiny.phase === "ready", detail: "A point or short mark does not start a round." },
  };
}

const BAIT_X = 18;
