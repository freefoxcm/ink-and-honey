"use strict";

const RESCUE_PHYSICS = Object.freeze({
  gravity: 590,
  footRadius: 35,
  inverseDogMass: 1.1,
  contactMargin: 0.4,
});

function rescueHazardY(round) {
  const { y, rise = 0 } = round.level.rescue.hazard;
  return y - rise * Math.min(1, round.elapsed / round.level.time);
}

function rescueSpikeTeeth({ kind, left, right, y, height, count }) {
  if (kind !== "spikes") return [];
  const width = (right - left) / count;
  return Array.from({ length: count }, (_, index) => {
    const start = left + index * width;
    return [{ x: start, y: y + height }, { x: start + width * 0.5, y }, { x: start + width, y: y + height }];
  });
}

function touchesRescueHazard(round, dog, radius) {
  const { kind, left, right } = round.level.rescue.hazard;
  const y = rescueHazardY(round);
  if (dog.y - radius > round.board.height) return true;
  if (dog.y + radius < y || dog.x + radius < left || dog.x - radius > right) return false;
  if (kind !== "spikes") return true;

  return round.rescue.teeth.some(([a, tip, b]) => {
    if (dog.x + radius < a.x || dog.x - radius > b.x) return false;
    const inside = dog.y >= tip.y && dog.y <= a.y &&
      Math.abs(dog.x - tip.x) <= (tip.x - a.x) * (dog.y - tip.y) / (a.y - tip.y);
    return inside || distance(dog, nearestPoint(dog.x, dog.y, a, tip)) <= radius ||
      distance(dog, nearestPoint(dog.x, dog.y, tip, b)) <= radius ||
      distance(dog, nearestPoint(dog.x, dog.y, a, b)) <= radius;
  });
}

function rescueInkContact(dog, body) {
  const radius = RESCUE_PHYSICS.footRadius + RULES.lineRadius;
  const points = body.path;
  let hit = null;
  let depth = -RESCUE_PHYSICS.contactMargin;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    if (dog.x < Math.min(a.x, b.x) - radius || dog.x > Math.max(a.x, b.x) + radius) continue;
    const point = nearestPoint(dog.x, dog.y, a, b);
    const gap = distance(dog, point);
    if (gap === 0 || radius - gap <= depth) continue;
    depth = radius - gap;
    hit = { nx: (dog.x - point.x) / gap, ny: (dog.y - point.y) / gap, depth, rx: point.x - body.x, ry: point.y - body.y };
  }
  return hit;
}

function stepRescueDog(round, dt) {
  const { rescue, inkBody: body, dogs: [dog] } = round;
  const { gravity, footRadius, inverseDogMass } = RESCUE_PHYSICS;
  dog.vx *= Math.exp(-(rescue.supported ? 5 : 1.2) * dt);
  dog.vy = Math.min(dog.vy + gravity * dt, 460);
  dog.x += dog.vx * dt;
  dog.y += dog.vy * dt;
  rescue.supported = false;

  for (let pass = 0; pass < 3; pass++) {
    for (const box of round.terrain) {
      const hit = boxContact(dog.x, dog.y, footRadius, box);
      if (!hit) continue;
      const { nx, ny, depth } = hit;
      dog.x += nx * depth;
      dog.y += ny * depth;
      const approach = Math.min(0, (dog.vx - (box.vx ?? 0)) * nx + (dog.vy - (box.vy ?? 0)) * ny);
      dog.vx -= nx * approach;
      dog.vy -= ny * approach;
    }
    const hit = rescueInkContact(dog, body);
    if (!hit) break;
    const { nx, ny, depth, rx, ry } = hit;
    if (depth > 0) {
      dog.x += nx * (depth + 0.02);
      dog.y += ny * (depth + 0.02);
    }
    const approach = dog.vx * nx + dog.vy * ny - inkSpeedAt(body, rx, ry, nx, ny);
    if (approach < 0) {
      const impulse = -approach / (inverseDogMass + inverseInkMass(body, rx, ry, nx, ny));
      dog.vx += nx * impulse * inverseDogMass;
      dog.vy += ny * impulse * inverseDogMass;
      pushInk(body, rx, ry, -nx * impulse, -ny * impulse);
    }
    if (ny < -0.28) {
      rescue.supported = true;
      rescue.caught = true;
    }
  }

  if (touchesRescueHazard(round, dog, footRadius)) {
    round.failure = round.level.rescue.hazard.kind;
    round.phase = "loss";
  }
}

function rescueSupports(round) {
  const body = round.inkBody;
  if (!body) return [];
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  return round.platforms.filter(box => box.id && box.brokenAt === undefined && body.samples.some(sample => {
    const x = body.x + sample.x * cos - sample.y * sin;
    const y = body.y + sample.x * sin + sample.y * cos;
    return boxContact(x, y, RULES.lineRadius + 1, box)?.ny < -0.15;
  })).map(branch => branch.id);
}
