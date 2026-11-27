"use strict";

function makePainter(canvas) {
  const ctx = canvas.getContext("2d");
  const backdrop = document.createElement("canvas");
  backdrop.width = BOARD.width;
  backdrop.height = BOARD.height;
  const bg = backdrop.getContext("2d");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let previousLevel;

  function path(target, d, fill, stroke, width = 1) {
    const shape = new Path2D(d);
    if (fill) {
      target.fillStyle = fill;
      target.fill(shape);
    }
    if (stroke) {
      target.strokeStyle = stroke;
      target.lineWidth = width;
      target.lineCap = "round";
      target.lineJoin = "round";
      target.stroke(shape);
    }
  }

  function oval(target, x, y, rx, ry, color, angle = 0) {
    target.beginPath();
    target.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    target.fillStyle = color;
    target.fill();
  }

  function randomizer(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function cloud(x, y, scale) {
    bg.save();
    bg.translate(x, y);
    bg.scale(scale, scale);
    path(bg, "M-57 12Q-59 1-44-1Q-43-17-26-18Q-17-37 7-29Q24-27 29-12Q47-15 53-2Q70 1 67 12Q65 18 51 18H-43Q-54 18-57 12Z", "#fff8e2ae");
    path(bg, "M-34 11h62m8 0h10", null, "#fffbee7a", 2);
    bg.restore();
  }

  function flower(x, y, scale, color) {
    bg.save();
    bg.translate(x, y);
    bg.scale(scale, scale);
    path(bg, "M0 1Q5-9 0-25M1-5Q-8-14-11-10Q-9-4 1-5M2-12Q8-21 12-17Q12-12 2-12", "#657f53", "#657f53", 1.4);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 0.4;
      oval(bg, Math.cos(a) * 4.5, -24 + Math.sin(a) * 4.5, 3.5, 2.7, color, a);
    }
    oval(bg, 0, -24, 2.5, 2.5, "#c98634");
    bg.restore();
  }

  function tree(x, y, scale, color) {
    bg.save();
    bg.translate(x, y);
    bg.scale(scale, scale);
    path(bg, "M-3 3Q2-25-1-71H4Q7-30 5 3Z", "#6f8062");
    path(bg, "M4-26Q-26-13-43-35Q-53-54-31-63Q-30-90-10-89Q8-113 30-91Q48-88 47-68Q66-45 45-32Q30-19 4-26Z", color);
    path(bg, "M5-32Q8-47 4-69M5-48Q17-58 26-59M5-52Q-6-64-17-64", null, "#f1edca43", 2.2);
    bg.restore();
  }

  function earth(target, box, palette) {
    const { x, y, w, h } = box;
    const radius = Math.min(10, h / 5);
    path(target, "M" + x + " " + (y + 6) + "Q" + x + " " + y + " " + (x + radius) + " " + y +
      "H" + (x + w - radius) + "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + 6) +
      "V" + (y + h - radius) + "q0 " + radius + " -" + radius + " " + radius + "H" + (x + radius) +
      "q-" + radius + " 0 -" + radius + " -" + radius + "Z", palette.soil);
    target.fillStyle = palette.deep;
    target.fillRect(x + 6, y + h - 6, w - 12, 3);
    target.fillStyle = palette.grass;
    target.fillRect(x + 4, y + 3, w - 8, 8);
    path(target, "M" + (x + 5) + " " + (y + 4) + "h" + (w - 10), null, "#ecedb985", 2);
    const random = randomizer(x * 51 + y);
    for (let i = 0; i < w / 6; i++) {
      const gritX = x + 7 + random() * (w - 14);
      const gritY = y + 12 + random() * Math.max(0, h - 20);
      oval(target, gritX, gritY, 1 + random() * 2.3, 0.8, i % 2 ? "#5e534543" : "#fbdf9f4d", -.24);
    }
  }

  function habitat(level) {
    const palette = PALETTES[level.palette];
    const random = randomizer(31 + LEVELS.indexOf(level) * 913);
    const sky = bg.createLinearGradient(0, 0, 0, BOARD.ground);
    sky.addColorStop(0, palette.sky);
    sky.addColorStop(.77, palette.horizon);
    bg.fillStyle = sky;
    bg.fillRect(0, 0, BOARD.width, BOARD.height);
    const dusk = level.palette === "dusk";
    oval(bg, 668, 126, 60, 59, dusk ? "#fff1d04c" : "#ffedaf7f");
    oval(bg, 668, 126, 42, 41, dusk ? "#fcf0cf" : "#ffedb0");
    oval(bg, 658, 115, 27, 16, "#fff8d553", -.42);
    cloud(140, 119, 1.03);
    cloud(369, 156, .62);
    cloud(806, 144, .59);
    cloud(520, 86, .49);
    path(bg, "M321 116q7-6 13 1q7-7 13-2m14 12q5-5 10 0q5-5 9-2", null, "#526d625b", 1.5);
    path(bg, "M0 275C104 205 178 268 275 255S418 189 531 233S692 218 769 213Q832 209 900 256V478H0Z", palette.far);
    path(bg, "M0 314Q130 286 220 324T435 307Q538 265 660 306T900 284V478H0Z", palette.near);
    tree(35, 361, .99, palette.near);
    tree(76, 342, .63, palette.near);
    tree(875, 376, 1.54, palette.near);
    tree(817, 350, .85, palette.near);
    path(bg, "M0 376C105 347 190 351 285 373S460 384 537 369S702 345 793 365Q857 376 900 358V488H0Z", palette.meadow);
    path(bg, "M0 416Q126 381 250 416T484 424T705 402T900 411M0 455Q30 451 72 453M712 447Q800 430 900 438", null, "#fff3c07a", 2);
    path(bg, "M94 390q25-7 60-7m15-1h19m578-4q30 3 62 0", null, "#56695142", 2);
    for (let i = 0; i < 155; i++) {
      const x = random() * 900;
      const y = 379 + random() * 96;
      const s = .35 + (y - 379) / 175;
      if (i % 5 === 0) {
        flower(x, y, s, i % 3 ? "#fff2cc" : "#f2b074");
      } else {
        path(bg, "M" + x + " " + y + "q-" + (4 * s) + " -" + (5 * s) + " -" + (8 * s) + " -" + (5 * s) +
          "m" + (8 * s) + " " + (5 * s) + "q" + (1 * s) + " -" + (7 * s) + " " + (6 * s) + " -" + (12 * s),
        null, i % 3 ? "#667c5152" : "#f9f4ce78", 1.3);
      }
    }
    for (const box of level.boxes) earth(bg, box, palette);
    earth(bg, { x: -14, y: BOARD.ground, w: 928, h: 110 }, palette);
    path(bg, "M0 527q60-13 127-4t168-1m52 1q53 4 123-3t176 5m30-1q100 5 224-9 M0 549 Q111 527 232 545 T500 547 T900 545", null, "#694e3b34", 2);
    for (let i = 0; i < 23; i++) {
      const x = i * 41 + random() * 30;
      if (x > 260 && x < 640) continue;
      flower(x, 482, .54 + random() * .45, i % 3 === 0 ? "#d08259" : "#fff6d7");
    }
    for (let i = 0; i < 19500; i++) {
      const x = random() * 900;
      const y = random() * 560;
      bg.fillStyle = i % 3 ? "#fff9e91f" : "#4b453119";
      bg.fillRect(x, y, 1 + random() * 1.3, 1 + random() * .7);
    }
  }

  function drawHive(hive, time, active) {
    ctx.save();
    ctx.translate(hive.x, hive.y);
    const tilt = motion.matches ? 0 : Math.sin(time * (active ? 9 : 2) + hive.x) * (active ? 0.045 : 0.017);
    ctx.rotate(tilt);
    path(ctx, "M-5-45V-31M-27-46Q-13-53 6-48H28", null, "#654936", 4.5);
    path(ctx, "M6-49q12-13 25-7q-5 14-22 11m-17-5q-15 1-23-11q15-5 25 9", "#7c9566", "#627b53", 1.5);
    path(ctx, "M-11-35Q0-40 12-35Q21-31 20-26Q32-23 29-12Q43-5 39 6Q44 17 31 22Q23 34 0 34Q-24 34-32 23Q-44 17-39 6Q-41-6-29-12Q-30-23-20-26Q-19-32-11-35Z",
      "#754e31", "#69452e", 3.2);
    const honey = ctx.createLinearGradient(-24, -26, 30, 33);
    honey.addColorStop(0, "#fee196");
    honey.addColorStop(.47, "#edb254");
    honey.addColorStop(1, "#c98134");
    path(ctx, "M-13-32Q0-39 13-32Q19-29 17-26Q33-21 26-12Q41-5 36 5Q43 17 28 20Q24 31 0 31Q-23 31-29 20Q-43 17-36 5Q-40-5-26-12Q-32-21-17-26Q-18-29-13-32Z", honey);
    path(ctx, "M-17-26Q0-23 17-26M-26-12Q0-7 26-12M-36 5Q0 11 36 5M-29 20Q0 25 28 20", null, "#a66a35", 2);
    path(ctx, "M-21-19L-12-17M-28-4L-15-1M-30 11L-16 14", null, "#fff0b273", 2.5);
    oval(ctx, 4, 8, 11.2, 9.5, "#9e612b");
    oval(ctx, 4, 9, 8.6, 7.4, active ? "#553522" : "#69432c");
    ctx.restore();
  }

  function puppy(dog, time, phase, injured) {
    const brown = dog.brown;
    const fur = brown ? "#d89062" : "#edbc6d";
    const ear = brown ? "#884e47" : "#a86646";
    const cream = brown ? "#f6dbc2" : "#fff0cd";
    const outline = "#5e4537";
    ctx.save();
    ctx.translate(dog.x, dog.y);
    oval(ctx, 0, 32, 40, 6.5, "#4c4e343d");
    const wag = motion.matches ? 0 : Math.sin(time * (phase === "win" ? 16 : 6)) * 4;
    ctx.save();
    ctx.translate(18, 24);
    ctx.rotate(wag / 19);
    path(ctx, "M8-4Q16 2 22-9Q24-17 20-19Q36-24 38-12Q41 2 29 11Q18 19 8 11Z", fur, outline, 3.2);
    path(ctx, "M25-20Q34-22 37-14Q29-9 22-12Q23-15 20-19Z", cream);
    ctx.restore();
    path(ctx, "M-22 32Q-32 27-26 14Q-21 6 0 7Q20 4 29 17Q35 30 24 33H-22Z", fur, outline, 3);
    path(ctx, "M-18 31Q-20 18-13 14L11 14Q15 20 17 31Z", cream);
    path(ctx, "M-23 34q-6-5 1-9q7-3 11 4m23 2q-1-6 6-6q8 0 8 6q-3 4-11 3", cream, outline, 2.5);
    path(ctx, "M-22 12Q-9 23 19 12L8 31Q3 34-1 29Z", brown ? "#6a9281" : "#bc6551", outline, 2);
    oval(ctx, 2, 23, 3.3, 3.3, "#f9d48d");
    const breathing = motion.matches ? 0 : Math.sin(time * 3.15 + dog.x) * 1.15;
    ctx.translate(0, breathing);
    path(ctx, "M-29-8Q-34-28-23-38Q-13-44-5-34Q3-37 13-34Q31-41 35-26Q39-15 25-8Z", fur, outline, 3);
    path(ctx, "M-23-34Q-35-31-39-15Q-44 4-32 4Q-23 1-21-12Q-17-21-12-27Z", ear, outline, 3);
    path(ctx, "M23-34Q34-33 40-20Q47-6 37 1Q29 4 25-9Q21-21 15-27Z", ear, outline, 3);
    path(ctx, "M-26-11Q-28-26-14-32Q1-39 17-31Q29-25 30-11Q37 3 25 11Q15 18 0 17Q-19 18-28 11Q-40 4-26-11Z", fur, outline, 3.1);
    path(ctx, "M-31 1Q-27-9-18-8Q-11-7-8-2Q-6-9 0-9Q6-9 9-2Q12-8 20-8Q29-7 32 2Q30 15 10 16Q-5 19-22 14Q-31 11-31 1Z", cream);
    oval(ctx, -20, 0, 6.2, 3.5, "#db826f82", -.12);
    oval(ctx, 21, 0, 6.2, 3.5, "#db826f82", .12);
    const blinking = !motion.matches && (time + dog.x * .015) % 4.2 < .13;
    if (injured) {
      path(ctx, "M-19-17l7 3l-6 3m38-6l-7 3l6 3", null, outline, 2.5);
    } else if (phase === "win" || blinking) {
      path(ctx, "M-20-12q4-5 8 0m25 0q4-5 8 0", null, outline, 2.7);
    } else {
      oval(ctx, -15.5, -13.5, 2.8, 4.1, outline);
      oval(ctx, 16, -13.5, 2.8, 4.1, outline);
      oval(ctx, -15, -15, .85, 1, "#fff5dc");
      oval(ctx, 16.5, -15, .85, 1, "#fff5dc");
    }
    path(ctx, "M-6-5Q0-9 6-5Q9-2 2 2Q0 3-2 2Q-8-1-6-5Z", "#48362e");
    if (injured) {
      path(ctx, "M-7 10Q0 3 7 10", null, outline, 1.75);
    } else {
      path(ctx, "M0 2v2q-4 6-9 1m9-1q4 6 9 1", null, outline, 1.65);
      path(ctx, "M-4 8q4 2 8 0q-1 7-4 7q-3 0-4-7Z", "#da806f", outline, 1.1);
    }
    ctx.restore();
  }

  function beeSprite(bee, time, scale = 1) {
    ctx.save();
    ctx.translate(bee.x, bee.y);
    ctx.scale(Math.sign(bee.vx) || 1, 1);
    ctx.rotate(clamp(bee.vy / 210, -.5, .5));
    ctx.scale(scale, scale);
    const wing = motion.matches ? 1 : Math.sin(time * 59 + bee.id * 2) * .46 + 1;
    oval(ctx, -3, -6, 5.1, 6.5 * wing, "#fff8dcda", -.46);
    oval(ctx, 2, -7, 4.5, 5.7 * wing, "#fff8dcee", .39);
    path(ctx, "M-8 0l-4 3l4 2", "#5e4230", "#5e4230", 1);
    path(ctx, "M-9 2C-9-6 8-7 10 0C12 9-8 11-9 2Z", "#ffc85b", "#624335", 1.75);
    path(ctx, "M-5-3Q-7 1-5 6m5-10q-2 5 0 11", null, "#78533b", 2.1);
    oval(ctx, 6, 0, 1.45, 1.6, "#4b3627");
    ctx.restore();
  }

  function inkPath(points, color, width, dashed = false) {
    if (!points.length) return;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([7, 10]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    if (points.length === 1) ctx.lineTo(points[0].x + .01, points[0].y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function particles(effects) {
    for (const effect of effects) {
      for (let index = 0; index < 4; index++) {
        const a = effect.id + index * 1.57;
        const r = 8 + effect.age * 52;
        const size = Math.max(.4, 2.3 - effect.age * 5);
        ctx.globalAlpha = Math.max(0, 1 - effect.age / .39);
        oval(ctx, effect.x + Math.cos(a) * r, effect.y + Math.sin(a) * r, size, size, "#fff1a7");
      }
    }
    ctx.globalAlpha = 1;
  }

  function paint(round, view) {
    if (round.level !== previousLevel) {
      habitat(round.level);
      previousLevel = round.level;
    }
    ctx.setTransform(canvas.width / BOARD.width, 0, 0, canvas.height / BOARD.height, 0, 0);
    ctx.drawImage(backdrop, 0, 0);

    const time = view.age;
    const moving = round.phase === "playing";
    for (const [index, hive] of round.level.hives.entries()) {
      drawHive(hive, time, moving);
      if (round.phase !== "ready") continue;
      const angle = motion.matches ? index * 2 : time * 1.13 + index * 2.4;
      beeSprite({ x: hive.x + Math.cos(angle) * 55, y: hive.y + 8 + Math.sin(angle) * 24, vx: -Math.sin(angle), vy: 0, id: index }, time, .87);
    }
    if (round.level.wind && !motion.matches) {
      ctx.globalAlpha = .31;
      for (let i = 0; i < 4; i++) {
        const x = ((time * (25 + i * 8) + i * 230) % 1000) - 45;
        const y = 110 + i * 89;
        path(ctx, "M" + x + " " + y + "q24-6 57 0m-8 7h17", null, "#fff8dd", 2);
      }
      ctx.globalAlpha = 1;
    }
    if (view.hint && !round.points.length && round.phase === "ready") {
      const points = round.level.guide.map(([x, y]) => ({ x, y }));
      inkPath(points, "#576b579b", 6, true);
      for (const p of [points[0], points.at(-1)]) {
        oval(ctx, p.x, p.y, 7.7, 7.7, "#fff3cf");
        oval(ctx, p.x, p.y, 3.2, 3.2, "#687e58");
      }
    }
    for (const [index, dog] of round.level.dogs.entries()) {
      puppy(dog, time, round.phase, round.touched === index);
    }
    inkPath(round.points, "#283b32", RULES.lineRadius * 2);
    if (round.points.length) {
      ctx.save();
      ctx.translate(0, -1.7);
      inkPath(round.points, "#64786a", 2.6);
      ctx.restore();
      if (view.drawing) {
        const p = round.points.at(-1);
        oval(ctx, p.x, p.y, 7.2, 7.2, "#23362d");
        oval(ctx, p.x - 1.7, p.y - 1.6, 2.2, 2.2, "#dbe4c9");
      }
    }
    for (const bee of round.bees) {
      if (round.elapsed >= bee.delay) beeSprite(bee, time);
    }
    if (!motion.matches) particles(round.effects);
    if (view.cursor && round.phase === "ready") {
      const p = view.cursor;
      oval(ctx, p.x, p.y, 10, 10, "#fff6d9");
      oval(ctx, p.x, p.y, 6.8, 6.8, "#2c4136");
      oval(ctx, p.x, p.y, 3.4, 3.4, "#fff6d9");
    }
  }

  return paint;
}
