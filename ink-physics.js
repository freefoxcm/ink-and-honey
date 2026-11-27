"use strict";

const INK_PHYSICS = Object.freeze({
  gravity: 410,
  density: .009,
  beeMass: 1.05,
  friction: .34,
  contactMargin: .4,
  penetrationSlop: .12,
  sampleSpacing: 6,
  flexReach: 92,
  flexLimit: 18,
  flexStiffness: 190,
  flexDamping: 11,
  flexImpulse: 5.4,
  maxFlexSpeed: 460,
});

function simplifyInk(points, start = 0, end = points.length - 1, result = [points[0]]) {
  let split = -1;
  let farthest = 1.2;
  for (let index = start + 1; index < end; index++) {
    const p = points[index];
    const error = distance(p, nearestPoint(p.x, p.y, points[start], points[end]));
    if (error > farthest) {
      farthest = error;
      split = index;
    }
  }
  if (split < 0) {
    result.push(points[end]);
  } else {
    simplifyInk(points, start, split, result);
    simplifyInk(points, split, end, result);
  }
  return result;
}

function createInkBody(points) {
  const simplified = simplifyInk(points);
  const path = simplified.length === 2 && distance(simplified[0], simplified[1]) < 1 ? points : simplified;
  let length = 0;
  let centerX = 0;
  let centerY = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const span = distance(a, b);
    centerX += (a.x + b.x) * .5 * span;
    centerY += (a.y + b.y) * .5 * span;
    length += span;
  }

  const x = centerX / length;
  const y = centerY / length;
  const shape = path.map(p => ({ x: p.x - x, y: p.y - y }));
  const samples = [{ ...shape[0], along: 0, dx: 0, dy: 0, vx: 0, vy: 0 }];
  let inertia = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const span = distance(a, b);
    const midpointX = (a.x + b.x) * .5 - x;
    const midpointY = (a.y + b.y) * .5 - y;
    const segmentInertia = midpointX ** 2 + midpointY ** 2 + span ** 2 / 12 + RULES.lineRadius ** 2 / 2;
    inertia += segmentInertia * span * INK_PHYSICS.density;
  }
  let radius = 0;
  let along = 0;
  for (let index = 1; index < shape.length; index++) {
    const a = shape[index - 1];
    const b = shape[index];
    const span = distance(a, b);
    radius = Math.max(radius, Math.hypot(a.x, a.y), Math.hypot(b.x, b.y));
    const count = Math.ceil(span / INK_PHYSICS.sampleSpacing);
    for (let step = 1; step <= count; step++) {
      const fraction = step / count;
      samples.push({
        x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction,
        along: along + span * fraction, dx: 0, dy: 0, vx: 0, vy: 0,
      });
    }
    along += span;
  }

  return {
    x, y, angle: 0, vx: 0, vy: 0, spin: 0,
    inverseMass: 1 / (length * INK_PHYSICS.density),
    inverseInertia: 1 / inertia,
    maxSpin: Math.min(5, 780 / radius),
    samples, path: samples.map(point => ({ x: x + point.x, y: y + point.y })), flex: 0,
  };
}

function boxContact(x, y, radius, box) {
  const right = box.x + box.w;
  const bottom = box.y + box.h;
  if (x < box.x - radius || x > right + radius || y < box.y - radius || y > bottom + radius) return null;
  const dx = x - clamp(x, box.x, right);
  const dy = y - clamp(y, box.y, bottom);
  const gap = Math.hypot(dx, dy);
  if (gap > radius) return null;
  if (gap > 0) return { nx: dx / gap, ny: dy / gap, depth: radius - gap };

  const left = x - box.x;
  const up = y - box.y;
  const nearest = Math.min(left, right - x, up, bottom - y);
  const depth = radius + nearest;
  if (nearest === up) return { nx: 0, ny: -1, depth };
  if (nearest === bottom - y) return { nx: 0, ny: 1, depth };
  return { nx: nearest === left ? -1 : 1, ny: 0, depth };
}

function inkContacts(body, level) {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const radius = RULES.lineRadius;
  const margin = INK_PHYSICS.contactMargin;
  const contacts = [];
  for (const sample of body.samples) {
    const rx = sample.x * cos - sample.y * sin;
    const ry = sample.x * sin + sample.y * cos;
    const x = body.x + rx;
    const y = body.y + ry;
    function add(nx, ny, depth) {
      if (depth < -margin) return;
      contacts.push({ nx, ny, depth, rx: rx - radius * nx, ry: ry - radius * ny, normalImpulse: 0, tangentImpulse: 0 });
    }
    add(0, -1, y + radius - BOARD.ground);
    add(0, 1, radius - y);
    add(1, 0, radius - x);
    add(-1, 0, x + radius - BOARD.width);
    for (const box of level.boxes) {
      const contact = boxContact(x, y, radius + margin, box);
      if (contact) add(contact.nx, contact.ny, contact.depth - margin);
    }
    for (const dog of level.dogs) {
      const dx = x - dog.x;
      const dy = y - dog.y;
      const clearance = RULES.puppyRadius + radius;
      if (Math.abs(dx) > clearance + margin || Math.abs(dy) > clearance + margin) continue;
      const separation = Math.hypot(dx, dy);
      if (separation > 0) add(dx / separation, dy / separation, clearance - separation);
    }
  }
  return contacts;
}

function inverseInkMass(body, rx, ry, dx, dy) {
  const lever = rx * dy - ry * dx;
  return body.inverseMass + lever ** 2 * body.inverseInertia;
}

function pushInk(body, rx, ry, impulseX, impulseY) {
  body.vx += impulseX * body.inverseMass;
  body.vy += impulseY * body.inverseMass;
  body.spin += (rx * impulseY - ry * impulseX) * body.inverseInertia;
}

function inkSpeedAt(body, rx, ry, dx, dy) {
  return (body.vx - body.spin * ry) * dx + (body.vy + body.spin * rx) * dy;
}

function flexInkAtImpact(body, segment, point, impulseX, impulseY) {
  const start = body.path[segment - 1];
  const span = distance(start, body.path[segment]);
  const fraction = span ? clamp(distance(start, point) / span, 0, 1) : 0;
  const before = body.samples[segment - 1].along;
  const along = before + (body.samples[segment].along - before) * fraction;
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const localX = (impulseX * cos + impulseY * sin) * INK_PHYSICS.flexImpulse;
  const localY = (-impulseX * sin + impulseY * cos) * INK_PHYSICS.flexImpulse;
  for (const sample of body.samples) {
    const proximity = 1 - Math.abs(sample.along - along) / INK_PHYSICS.flexReach;
    if (proximity <= 0) continue;
    const weight = proximity ** 2;
    sample.vx += localX * weight;
    sample.vy += localY * weight;
    const speed = Math.hypot(sample.vx, sample.vy);
    if (speed > INK_PHYSICS.maxFlexSpeed) {
      sample.vx *= INK_PHYSICS.maxFlexSpeed / speed;
      sample.vy *= INK_PHYSICS.maxFlexSpeed / speed;
    }
  }
}

function inkFlexClearance(level, x, y) {
  // Supported points stay seated. Nearby terrain also limits the bend before it can clip into it.
  let clearance = Math.min(BOARD.ground - y, y, x, BOARD.width - x);
  for (const box of level.boxes) {
    clearance = Math.min(clearance, Math.hypot(
      x - clamp(x, box.x, box.x + box.w), y - clamp(y, box.y, box.y + box.h)));
  }
  for (const dog of level.dogs) {
    clearance = Math.min(clearance, Math.hypot(x - dog.x, y - dog.y) - RULES.puppyRadius);
  }
  return clamp(clearance - RULES.lineRadius, 0, INK_PHYSICS.flexLimit);
}

function resolveInkTerrain(body, level) {
  for (let iteration = 0; iteration < 6; iteration++) {
    let deepest = null;
    for (const contact of inkContacts(body, level)) {
      if (contact.depth > (deepest?.depth ?? INK_PHYSICS.penetrationSlop)) deepest = contact;
    }
    if (!deepest) break;
    const { nx, ny, rx, ry, depth } = deepest;
    // Correct overlap without adding velocity or energy to the shield.
    const correction = .65 * (depth - INK_PHYSICS.penetrationSlop) / inverseInkMass(body, rx, ry, nx, ny);
    body.x += nx * correction * body.inverseMass;
    body.y += ny * correction * body.inverseMass;
    body.angle += (rx * ny - ry * nx) * correction * body.inverseInertia;
  }

  const contacts = inkContacts(body, level);
  for (const contact of contacts) {
    const { nx, ny, rx, ry } = contact;
    const speed = inkSpeedAt(body, rx, ry, nx, ny);
    contact.rebound = Math.max(0, -speed - 55) * .18;
  }
  for (let iteration = 0; iteration < 7; iteration++) {
    for (const contact of contacts) {
      const { nx, ny, rx, ry } = contact;
      const oldNormal = contact.normalImpulse;
      const normalSpeed = inkSpeedAt(body, rx, ry, nx, ny);
      contact.normalImpulse = Math.max(0, oldNormal + (contact.rebound - normalSpeed) / inverseInkMass(body, rx, ry, nx, ny));
      const normal = contact.normalImpulse - oldNormal;
      pushInk(body, rx, ry, normal * nx, normal * ny);

      const oldTangent = contact.tangentImpulse;
      const tangentSpeed = inkSpeedAt(body, rx, ry, -ny, nx);
      const limit = INK_PHYSICS.friction * contact.normalImpulse;
      contact.tangentImpulse = clamp(oldTangent - tangentSpeed / inverseInkMass(body, rx, ry, -ny, nx), -limit, limit);
      const tangent = contact.tangentImpulse - oldTangent;
      pushInk(body, rx, ry, -tangent * ny, tangent * nx);
    }
  }
}

function stepInk(round, dt) {
  const body = round.inkBody;
  const drag = Math.exp(-.25 * dt);
  body.vx = clamp(body.vx * drag, -440, 440);
  body.vy = clamp(body.vy * drag + INK_PHYSICS.gravity * dt, -440, 440);
  body.spin = clamp(body.spin * drag, -body.maxSpin, body.maxSpin);
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.angle += body.spin * dt;
  resolveInkTerrain(body, round.level);

  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const damping = Math.exp(-INK_PHYSICS.flexDamping * dt);
  body.flex = 0;
  for (let index = 0; index < body.samples.length; index++) {
    const sample = body.samples[index];
    sample.vx = (sample.vx - INK_PHYSICS.flexStiffness * sample.dx * dt) * damping;
    sample.vy = (sample.vy - INK_PHYSICS.flexStiffness * sample.dy * dt) * damping;
    sample.dx += sample.vx * dt;
    sample.dy += sample.vy * dt;
    const x = body.x + sample.x * cos - sample.y * sin;
    const y = body.y + sample.x * sin + sample.y * cos;
    const amplitude = Math.hypot(sample.dx, sample.dy);
    const bend = amplitude > .015 ? Math.min(amplitude, inkFlexClearance(round.level, x, y)) : 0;
    const fraction = bend ? bend / amplitude : 0;
    body.path[index].x = x + (sample.dx * cos - sample.dy * sin) * fraction;
    body.path[index].y = y + (sample.dx * sin + sample.dy * cos) * fraction;
    body.flex = Math.max(body.flex, bend);
  }
}
