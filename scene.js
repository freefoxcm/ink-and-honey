"use strict";

function groundFor(level) {
  const ground = [];
  let left = -32;
  for (const pit of level.pits ?? []) {
    const right = pit.x + pit.width;
    ground.push({ x: left, y: BOARD.ground, w: pit.x - left, h: BOARD.height + 32 - BOARD.ground });
    ground.push({ x: pit.x, y: pit.bottom, w: pit.width, h: BOARD.height + 32 - pit.bottom, pitFloor: true });
    left = right;
  }
  ground.push({ x: left, y: BOARD.ground, w: BOARD.width + 32 - left, h: BOARD.height + 32 - BOARD.ground });
  return ground;
}

function shuttleMotion(elapsed, period, phase = 0) {
  const angle = (elapsed / period + phase) * Math.PI * 2;
  return { position: .5 - .5 * Math.cos(angle), speed: Math.PI / period * Math.sin(angle) };
}

function updateScene(round) {
  round.platforms.forEach((platform, index) => {
    const { travel } = platform;
    if (!travel) return;
    const origin = round.level.boxes[index];
    const { position, speed } = shuttleMotion(round.elapsed, travel.period, travel.phase);
    platform.x = origin.x + (travel.dx ?? 0) * position;
    platform.y = origin.y + (travel.dy ?? 0) * position;
    platform.vx = (travel.dx ?? 0) * speed;
    platform.vy = (travel.dy ?? 0) * speed;
  });
  round.dogs.forEach((dog, index) => {
    if (!dog.patrol) return;
    const origin = round.level.dogs[index].x;
    const { position, speed } = shuttleMotion(round.elapsed, dog.patrol.period);
    dog.x = origin + (dog.patrol.to - origin) * position;
    dog.vx = (dog.patrol.to - origin) * speed;
  });
}

function windAt(level, elapsed) {
  if (!level.wind) return 0;
  const { strength, mode } = level.wind;
  if (mode === "steady") return strength;
  if (mode === "gust") return strength * (.22 + .78 * shuttleMotion(elapsed, 3).position);
  return strength * Math.sin(elapsed * 2.2);
}
