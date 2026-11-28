"use strict";

function boardViewport(width, height, board) {
  const scale = Math.min(width / board.width, height / board.height);
  return {
    scale,
    x: (width - board.width * scale) / 2,
    y: (height - board.height * scale) * .7,
  };
}

function makePainter(canvas, createSurface, motion) {
  const ctx = canvas.getContext("2d");
  const backdrop = createSurface();
  const bg = backdrop.getContext("2d");
  let board;
  let previousLevel;
  let previousWidth;
  let previousHeight;
  let camera;
  let scenery;

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

  function cloud(target, x, y, scale) {
    target.save();
    target.translate(x, y);
    target.scale(scale, scale);
    path(target, "M-57 12Q-59 1-44-1Q-43-17-26-18Q-17-37 7-29Q24-27 29-12Q47-15 53-2Q70 1 67 12Q65 18 51 18H-43Q-54 18-57 12Z", "#fff8e2ae");
    path(target, "M-34 11h62m8 0h10", null, "#fffbee7a", 2);
    target.restore();
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

  function tree(target, x, y, scale, color) {
    target.save();
    target.translate(x, y);
    target.scale(scale, scale);
    path(target, "M-3 3Q2-25-1-71H4Q7-30 5 3Z", "#6f8062");
    path(target, "M4-26Q-26-13-43-35Q-53-54-31-63Q-30-90-10-89Q8-113 30-91Q48-88 47-68Q66-45 45-32Q30-19 4-26Z", color);
    path(target, "M5-32Q8-47 4-69M5-48Q17-58 26-59M5-52Q-6-64-17-64", null, "#f1edca43", 2.2);
    target.restore();
  }

  function earth(target, box, palette) {
    const { x, y, w, h } = box;
    target.fillStyle = palette.soil;
    target.fillRect(x, y, w, h);
    target.fillStyle = palette.deep;
    target.fillRect(x + 6, y + h - 6, w - 12, 3);
    target.fillStyle = palette.grass;
    target.fillRect(x, y, w, 9);
    path(target, "M" + (x + 5) + " " + (y + 4) + "h" + (w - 10), null, "#ecedb985", 2);
    const random = randomizer(x * 51 + y);
    for (let i = 0; i < w / 6; i++) {
      const gritX = x + 7 + random() * (w - 14);
      const gritY = y + 12 + random() * Math.max(0, h - 20);
      oval(target, gritX, gritY, 1 + random() * 2.3, 0.8, i % 2 ? "#5e534543" : "#fbdf9f4d", -.24);
    }
  }

  function landscape(target, chapterId, paletteId, width, height, ground) {
    const palette = PALETTES[paletteId];
    const sky = target.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, palette.sky);
    sky.addColorStop(.77, palette.horizon);
    target.fillStyle = sky;
    target.fillRect(0, 0, width, height);
    const scaleX = width / BOARD.width;
    const scaleY = ground / BOARD.ground;
    const size = Math.min(1, scaleX * 1.3);
    const placeOval = (x, y, rx, ry, color, angle) => oval(target, x * scaleX, y * scaleY, rx * size, ry * size, color, angle);
    const placeCloud = (x, y, scale) => cloud(target, x * scaleX, y * scaleY, scale * size);
    const dusk = paletteId === "dusk";
    placeOval(668, 126, 60, 59, dusk ? "#fff1d04c" : "#ffedaf7f");
    placeOval(668, 126, 42, 41, dusk ? "#fcf0cf" : "#ffedb0");
    placeOval(658, 115, 27, 16, "#fff8d553", -.42);
    placeCloud(140, 119, 1.03);
    placeCloud(369, 156, .62);
    placeCloud(806, 144, .59);
    placeCloud(520, 86, .49);
    target.save();
    target.scale(width / BOARD.width, ground / BOARD.ground);
    path(target, "M321 116q7-6 13 1q7-7 13-2m14 12q5-5 10 0q5-5 9-2", null, "#526d625b", 1.5);
    path(target, "M0 275C104 205 178 268 275 255S418 189 531 233S692 218 769 213Q832 209 900 256V478H0Z", palette.far);
    path(target, "M0 314Q130 286 220 324T435 307Q538 265 660 306T900 284V478H0Z", palette.near);
    chapterLandmarks(target, chapterId, palette);
    tree(target, 35, 361, .99, palette.near);
    tree(target, 76, 342, .63, palette.near);
    tree(target, 875, 376, 1.54, palette.near);
    tree(target, 817, 350, .85, palette.near);
    path(target, "M0 376C105 347 190 351 285 373S460 384 537 369S702 345 793 365Q857 376 900 358V488H0Z", palette.meadow);
    path(target, "M0 416Q126 381 250 416T484 424T705 402T900 411M0 455Q30 451 72 453M712 447Q800 430 900 438", null, "#fff3c07a", 2);
    path(target, "M94 390q25-7 60-7m15-1h19m578-4q30 3 62 0", null, "#56695142", 2);
    target.restore();
  }

  function mapLandscape(chapter) {
    const tile = createSurface();
    tile.width = 420;
    tile.height = 330;
    landscape(tile.getContext("2d"), chapter.id, chapter.palette, tile.width, tile.height, tile.height + 15);
    return tile;
  }

  function habitat(round) {
    const { level } = round;
    const palette = PALETTES[level.palette];
    const random = randomizer(31 + (level.chapterLevel ?? LEVELS.indexOf(level)) * 913);
    const { left, top, width, height } = scenery;
    bg.save();
    bg.translate(left, top);
    landscape(bg, level.chapterId, level.palette, width, height, board.ground - top);
    bg.restore();
    bg.save();
    bg.scale(board.width / BOARD.width, board.ground / BOARD.ground);
    for (let i = 0; i < 155; i++) {
      const x = random() * 900;
      const y = 379 + random() * 96;
      const s = .35 + (y - 379) / 175;
      if (i % 5 === 0 && level.chapterId !== "snow" && level.chapterId !== "volcano") {
        flower(x, y, s, i % 3 ? "#fff2cc" : "#f2b074");
      } else {
        path(bg, "M" + x + " " + y + "q-" + (4 * s) + " -" + (5 * s) + " -" + (8 * s) + " -" + (5 * s) +
          "m" + (8 * s) + " " + (5 * s) + "q" + (1 * s) + " -" + (7 * s) + " " + (6 * s) + " -" + (12 * s),
        null, i % 3 ? "#667c5152" : "#f9f4ce78", 1.3);
      }
    }
    bg.restore();
    for (const pit of level.pits ?? []) {
      const shade = bg.createLinearGradient(0, board.ground, 0, pit.bottom);
      shade.addColorStop(0, "#72584038");
      shade.addColorStop(1, "#70533d97");
      bg.fillStyle = shade;
      bg.fillRect(pit.x, board.ground, pit.width, pit.bottom - board.ground);
    }
    const decorativeGround = [
      { x: left, w: -left, y: board.ground, h: top + height - board.ground },
      { x: board.width, w: left + width - board.width, y: board.ground, h: top + height - board.ground },
    ].filter(ground => ground.w > 0);
    for (const ground of [...round.ground, ...decorativeGround]) {
      bg.fillStyle = ground.pitFloor ? palette.deep : palette.soil;
      bg.fillRect(ground.x, ground.y, ground.w, Math.max(ground.h, top + height - ground.y));
      bg.fillStyle = ground.pitFloor ? palette.soil : palette.grass;
      bg.fillRect(ground.x, ground.y, ground.w, ground.pitFloor ? 5 : 9);
      for (let x = ground.x + 14; x < ground.x + ground.w - 10; x += 24) {
        const y = ground.y + 15 + random() * 52;
        oval(bg, x, y, 1.7 + random() * 2.2, 1, "#f6df9b79", -.24);
      }
    }
    rescueScenery(round, palette);
    for (let x = random() * 25; x < board.width; x += 26 + random() * 16) {
      if (x > board.width * .29 && x < board.width * .71) continue;
      if (level.pits?.some(pit => x > pit.x - 8 && x < pit.x + pit.width + 8)) continue;
      if (level.chapterId !== "snow" && level.chapterId !== "volcano") {
        flower(x, board.ground + 4, .54 + random() * .45, random() < .33 ? "#d08259" : "#fff6d7");
      }
    }
    for (let i = 0; i < 19500; i++) {
      const x = left + random() * width;
      const y = top + random() * height;
      bg.fillStyle = i % 3 ? "#fff9e91f" : "#4b453119";
      bg.fillRect(x, y, 1 + random() * 1.3, 1 + random() * .7);
    }
  }

  function chapterLandmarks(target, chapterId, palette) {
    switch (chapterId) {
      case "jungle":
        path(target, "M0 0H900V43Q852 77 803 48Q762 97 708 54Q652 95 585 53Q530 82 470 39Q404 78 334 42Q279 93 209 56Q152 100 101 55Q52 80 0 56Z", "#73966c6b");
        path(target, "M0 0H278Q229 45 171 31Q129 62 78 35Q39 61 0 43ZM655 0H900V39Q853 70 803 38Q743 68 703 34Q677 36 655 0Z", "#52785877");
        path(target, "M54 27Q80 150 12 310H0Q49 181 23 23M850 28Q823 176 895 313H900Q862 172 881 21", "#76966d65");
        break;
      case "lake":
        path(target, "M0 306Q150 282 320 306T626 295T900 292V371Q762 353 644 361T322 353T0 373Z", "#afcfc8");
        path(target, "M24 326Q91 318 141 326M237 333Q318 324 378 331M486 314Q535 307 576 314M690 336Q764 326 815 333", null, "#dcece2", 2);
        break;
      case "cliff":
        path(target, "M0 175L107 142L175 184L189 282L231 312L231 383H0ZM699 382V296L744 250L754 173L849 147L900 160V382Z", "#a697847f");
        path(target, "M0 216L97 201L173 226M18 262L118 246L184 265M758 211L833 190L900 195M727 277L818 232L900 247", null, "#d6c7ae", 3);
        break;
      case "snow":
        path(target, "M0 362L178 134L241 209L349 104L449 232L571 120L714 259L811 174L900 266V386H0Z", "#b8c9d7");
        path(target, "M138 186L178 134L224 188L183 171L158 192ZM308 144L349 104L397 166L358 146L344 160L333 145ZM533 157L571 120L629 177L583 163L564 177ZM785 205L811 174L851 222L817 208L805 220Z", "#f4f7ef");
        for (const [x, y, size] of [[53, 367, 64], [86, 360, 49], [817, 367, 66], [850, 360, 46]]) {
          path(target, `M${x} ${y - size}l${size * .34} ${size * .68}h${-size * .18}l${size * .29} ${size * .32}h${-size * .9}l${size * .29} ${-size * .32}h${-size * .18}Z`, palette.near);
        }
        break;
      case "volcano":
        path(target, "M0 381L159 239L237 151L296 160L411 282L497 345V391Z", "#b38578");
        path(target, "M219 170L237 151L296 160L321 185L277 177L253 167Z", "#95695e");
        path(target, "M252 139Q225 123 247 104Q268 86 254 67Q286 83 277 105Q274 122 295 136Z", "#9b80716b");
        path(target, "M673 367L755 284L829 253L900 285V385Z", "#bf8d78");
        break;
    }
  }

  function riverWater({ left, right, y }) {
    const bottom = scenery.top + scenery.height;
    const water = bg.createLinearGradient(0, y, 0, bottom);
    water.addColorStop(0, "#a6d9c3");
    water.addColorStop(1, "#5da7a8");
    bg.fillStyle = water;
    bg.fillRect(left, y, right - left, bottom - y);
    path(bg, `M${left} ${y}H${right}`, null, "#eff0c7", 3);
    const random = randomizer(86);
    for (let index = 0; index < 25; index++) {
      const x = left + 12 + random() * (right - left - 85);
      const waveY = y + 11 + random() * 95;
      const width = 17 + random() * 45;
      path(bg, `M${x} ${waveY}q${width / 2} -4 ${width} 0m-5 6h-11`, null, "#f0f4cb90", 1.7);
    }
  }

  function drawPlank(target, branch) {
    const { x, y, w, h } = branch;
    const rightBranch = x > board.width / 2 && branch.kind !== "float";
    target.save();
    target.translate(rightBranch ? x + w : x, y);
    if (rightBranch) target.scale(-1, 1);
    path(target, `M0 0H${w - 6}Q${w + 1} 3 ${w} ${h / 2}Q${w} ${h} ${w - 6} ${h}H0Z`, "#a47b54", "#624d3d", 3);
    path(target, `M4 4H${w - 11}M4 ${h - 7}Q${w / 2} ${h - 10} ${w - 16} ${h - 7}`, null, "#e4bd87", 1.8);
    oval(target, w - 4.5, h / 2, 3.5, h / 2 - 3, "#d6ad77");
    target.restore();
  }

  function drawIceSurface(target, box) {
    if (box.iceFrom === undefined) return;
    const left = box.x + box.w * box.iceFrom;
    const right = box.x + box.w;
    const y = box.y;
    path(target, `M${left} ${y + 1}H${right - 3}Q${right} ${y + 1} ${right} ${y + 4}V${y + 8}
      H${left + 3}Q${left} ${y + 7} ${left} ${y + 4}Z`, "#a1d9ec", "#4c819d", 1.4);
    path(target, `M${left + 4} ${y + 2}H${right - 4}M${left + 10} ${y + 5}l6 -2
      M${right - 19} ${y + 6}l8 -3`, null, "#f3fcff", 1.6);
  }

  function drawFragileBranch(branch, elapsed) {
    const age = branch.brokenAt === undefined ? null : elapsed - branch.brokenAt;
    if (age !== null && (motion.matches || age > .42)) return;
    const warning = branch.overload >= BRANCH_WARNING_TIME;
    ctx.save();
    if (age !== null) {
      ctx.translate(0, age * age * 235);
      ctx.globalAlpha = 1 - age / .42;
    } else if (warning && !motion.matches) {
      ctx.translate(Math.sin(elapsed * 58) * 1.5, 0);
    }
    drawPlank(ctx, branch);
    const x = branch.x + branch.w * .46;
    const y = branch.y + 2;
    path(ctx, `M${x} ${y}l3 5-4 3 3 ${warning ? 7 : 3}`,
      null, warning ? "#a3332d" : "#624534", warning ? 2.8 : 2);
    if (warning) {
      path(ctx, `M${x + 3} ${y + 5}l7 -4M${x - 1} ${y + 8}l-6 6`, null, "#ffd47a", 2);
    }
    ctx.restore();
  }

  function drawRock(target, rock) {
    const { x, y, w, h } = rock;
    const isLedge = rock.kind === "ledge";
    target.save();
    target.translate(x, y);
    path(target, `M0 ${h}V7L8 0H${w - 7}l7 7v${h - 14}l-7 7Z`, isLedge ? "#a0826b" : "#8e7567", "#604b44", 3);
    path(target, `M10 4H${w - 10}L${w - 2} 9H3Z`, "#d3ab86");
    path(target, `M3 ${Math.round(h * .44)}h${Math.round(w * .31)}l${Math.round(w * .12)} 7h${Math.round(w * .43)}`, null, "#684f465e", 2);
    if (!isLedge) {
      path(target, `M${w * .64} ${h * .08}L${w * .5} ${h * .24}L${w * .62} ${h * .4}L${w * .54} ${h * .52}` +
        `M${w * .25} ${h * .53}L${w * .33} ${h * .66}L${w * .24} ${h * .79}L${w * .29} ${h * .93}`, null, "#6e564c", 3);
      path(target, `M${w * .08} ${h * .79}L${w * .34} ${h * .72}L${w * .58} ${h * .77}L${w * .82} ${h * .73}`, null, "#b49a7f", 2);
    }
    target.restore();
  }

  function rescueScenery(round, palette) {
    const { level } = round;
    const hazard = level.rescue?.hazard;
    if (hazard?.kind === "water") riverWater(hazard);
    else if (level.chapterId === "lake") {
      for (const pit of level.pits ?? []) riverWater({ left: pit.x, right: pit.x + pit.width, y: pit.bottom - 20 });
    }
    if (hazard?.kind === "spikes") {
      const { left, right, y, height } = hazard;
      bg.fillStyle = "#676551";
      bg.fillRect(left, y + height, right - left, scenery.top + scenery.height - y - height);
      for (const [a, tip, b] of round.rescue.teeth) {
        path(bg, `M${a.x} ${a.y}L${tip.x} ${tip.y}L${b.x} ${b.y}Z`, "#929785", "#414b45", 2);
        path(bg, `M${tip.x} ${tip.y + 7}L${tip.x - 4} ${a.y - 7}`, null, "#e9ecce", 2);
      }
      path(bg, `M${left} ${y + height}H${right}`, null, "#444c47", 4);
    }
    const platforms = round.platforms.filter(box => !box.travel && box.loadLimit === undefined);
    for (const box of platforms.filter(box => !box.kind)) earth(bg, box, palette);
    for (const [index, box] of platforms.filter(box => box.kind === "trunk").entries()) {
      const { x, y, w, h } = box;
      bg.save();
      bg.translate(x, y);
      if (index) {
        bg.translate(w, 0);
        bg.scale(-1, 1);
      }
      path(bg, `M0 ${h}V13Q7 0 24 0H${w - 12}L${w} 14V${h}Z`, "#a47b54", "#624d3d", 3);
      path(bg, `M12 ${h}Q5 235 17 155T18 8M37 ${h}Q27 277 39 185T35 20M61 ${h}Q70 281 59 213T64 51`, null, "#795b44", 2.4);
      path(bg, "M45 175Q56 149 74 145M11 109q13-14 23-13M28 42Q9 28-28 21", null, "#674d39", 4);
      oval(bg, -17, 6, 32, 10, "#779377", .34);
      oval(bg, 14, 6, 25, 10, "#8ba886", -.43);
      oval(bg, 56, 5, 25, 9, "#9fb593", -.28);
      bg.restore();
    }
    for (const branch of platforms.filter(box => ["branch", "peg", "float"].includes(box.kind))) drawPlank(bg, branch);
    for (const peg of platforms.filter(box => box.kind === "pin")) {
      const { x, y, w, h } = peg;
      const center = x + w / 2;
      path(bg, `M${center} -3Q${center - 7} ${y * .45} ${center} ${y + 10}`, null, "#846c54", 3);
      path(bg, `M${x + 5} ${y}H${x + w - 5}Q${x + w} ${y} ${x + w} ${y + h / 2}Q${x + w} ${y + h} ${x + w - 5} ${y + h}H${x + 5}Q${x} ${y + h} ${x} ${y + h / 2}Q${x} ${y} ${x + 5} ${y}Z`, "#af875e", "#624d3d", 3);
      oval(bg, x + w - 7, y + h / 2, 4.8, h / 2 - 3, "#d6ad77");
      path(bg, `M${x + 6} ${y + 5}h${w - 19}m-${w - 20} ${h - 12}q15-4 ${w - 22} -1`, null, "#f2cf92", 2);
    }
    for (const rock of platforms.filter(box => box.kind === "cliff" || box.kind === "ledge")) drawRock(bg, rock);
    for (const box of platforms) drawIceSurface(bg, box);
  }

  function rescueLava(round, age) {
    const { left, right } = round.level.rescue.hazard;
    const y = rescueHazardY(round);
    const bottom = scenery.top + scenery.height;
    const molten = ctx.createLinearGradient(0, y, 0, bottom);
    molten.addColorStop(0, "#ffb740");
    molten.addColorStop(.32, "#e9743c");
    molten.addColorStop(1, "#ac4238");
    ctx.fillStyle = molten;
    ctx.fillRect(left, y, right - left, bottom - y);
    path(ctx, `M${left} ${y + 1}H${right}`, null, "#ffe188", 2);
    const time = motion.matches ? 0 : age;
    const span = right - left - 68;
    for (let index = 0; index < 14; index++) {
      const x = left + 11 + (index * 83 + time * (7 + index % 3)) % span;
      const rippleY = y + 8 + (index * 17) % (board.height - y - 12);
      path(ctx, `M${x} ${rippleY}q17-5 40-1`, null, index % 3 ? "#ffce637f" : "#fff0a35e", 2);
    }
    const { rise = 0, markCrest } = round.level.rescue.hazard;
    const crest = round.level.rescue.hazard.y - rise;
    if (markCrest && y > crest + 3) {
      ctx.save();
      ctx.setLineDash([7, 7]);
      path(ctx, `M${left + 5} ${crest}H${right - 5}`, null, "#863f31d0", 2);
      ctx.restore();
    }
  }

  function rescueBranch(round) {
    const { x: originX, y, patrol } = round.level.dogs[0];
    const { perch, releaseAt } = round.level.rescue;
    const x = releaseAt ? patrol.to : originX;
    const elapsed = Math.max(0, round.elapsed - (releaseAt ?? 0));
    const ready = !round.rescue.released;
    const { x: rootX, material, sling } = perch;
    const isStone = material === "stone";
    const outline = isStone ? "#64534e" : "#684f3d";
    const fill = isStone ? "#a8907c" : "#b08659";
    const grain = isStone ? "#cdb59c" : "#edd09b";
    if (ready && rootX !== undefined) {
      const edge = rootX < x ? -1 : 1;
      path(ctx, `M${x + edge * 40} ${y + 35}Q${x + edge * 105} ${y + 38} ${rootX} ${y + 58}v12Q${x + edge * 108} ${y + 46} ${x + edge * 43} ${y + 45}Z`, fill, outline, 2.7);
    }
    if (ready && sling) {
      const peg = round.platforms[0];
      const pegX = peg.x + peg.w / 2;
      path(ctx, `M${x - 43} ${y + 40}L${pegX} ${peg.y + peg.h}L${x + 43} ${y + 40}`, null, "#8e775a9c", 2.3);
    }
    if (!ready && elapsed >= 0.7) return;
    ctx.save();
    ctx.translate(x, y + 39);
    ctx.globalAlpha = ready ? 1 : 1 - elapsed / 0.7;
    for (const side of releaseAt ? [Math.sign(rootX - x)] : [-1, 1]) {
      ctx.save();
      if (!ready) {
        ctx.translate(side * elapsed * 25, elapsed * elapsed * 410);
        ctx.rotate(side * elapsed);
      }
      ctx.scale(side, 1);
      path(ctx, "M-3 -4Q17 -8 46 -4L51 4Q24 9 3 6L-3 2Z", fill, outline, 3);
      path(ctx, "M10 2Q22 -2 37 0", null, grain, 1.5);
      ctx.restore();
    }
    if (ready) path(ctx, "M3 -5l-5 5 6 2-4 5", null, "#604938", 2.2);
    ctx.restore();
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

  function puffedForehead(age) {
    const [left, middle, right] = [0, .08, .16].map(delay => {
      const progress = motion.matches ? 1 : clamp((age - delay) / .3, 0, 1);
      return progress * (2 - progress);
    });
    return `Q-19 -34 -18 -34 A6.5 ${6.5 * left} 0 0 1 -5 -34` +
      `Q-4 -34 -4 -35 A7 ${7 * middle} 0 0 1 10 -35` +
      `Q11 -34 11 -33 A6 ${6 * right} 0 0 1 23 -33 Q29 -27 32 -18`;
  }

  function drawStingStars(age) {
    const progress = motion.matches ? 1 : clamp(age / .28, 0, 1);
    if (!progress) return;
    for (const [x, y, size, tilt] of [[-43, -47, 10, -.22], [39, -56, 8, .25]]) {
      ctx.save();
      ctx.translate(x + Math.sign(x) * 3 * progress, y - 3 * progress);
      ctx.rotate(tilt);
      ctx.scale(size * progress, size * progress);
      path(ctx, "M0 -1Q.22 -.2 1 0Q.22 .2 0 1Q-.22 .2 -1 0Q-.22 -.2 0 -1Z", "#ffdf8d", "#a67b4f", .14);
      ctx.restore();
    }
  }

  const bearCoats = [
    { fur: "#bc8559", shade: "#a46e4b", light: "#d09a68", cream: "#f2d4a6", blush: "#efb5ab" },
    { fur: "#a06b54", shade: "#865843", light: "#bd8766", cream: "#efc49b", blush: "#dda396" },
  ];
  const bearOutline = "#563a2c";

  function drawHoneyPot() {
    ctx.save();
    path(ctx, "M-12 20Q-15 27-10 32Q0 36 10 32Q15 27 12 20Z", "#6d9088", bearOutline, 2.2);
    path(ctx, "M-13 19Q-13 16 0 15Q13 16 13 19Q12 22 0 22Q-12 22-13 19Z", "#f6b846", bearOutline, 1.8);
    path(ctx, "M5 20q2-2 5-1q1 2 0 5q1 4-2 4q-2-1-1-3q1-2-2-5Z", "#e8a537");
    path(ctx, "M-10 27q4 2 8 2", null, "#b1c8a6", 1.6);
    ctx.restore();
  }

  function drawBearHead(coat, blinkTime, phase, injured, stingAge, turned) {
    const stung = stingAge !== null;
    const { fur, shade, light, cream, blush } = coat;
    const outline = bearOutline;
    if (turned) ctx.scale(.95, 1);
    for (const side of [-1, 1]) {
      const farEar = turned && side === 1;
      ctx.save();
      ctx.translate(side * (farEar ? 22 : 25), farEar ? -32 : -34);
      if (farEar) ctx.scale(.86, .86);
      oval(ctx, 0, 0, 12.6, 13.5, outline);
      oval(ctx, 0, 0, 10, 11, shade);
      oval(ctx, 0, 0, 6.1, 6.6, "#d99981");
      ctx.restore();
    }
    const face = ctx.createLinearGradient(0, stung ? -42 : -37, 0, 19);
    if (stung) {
      face.addColorStop(0, blush);
      face.addColorStop(.08, blush);
      face.addColorStop(.22, light);
    } else {
      face.addColorStop(0, light);
    }
    face.addColorStop(1, fur);
    const forehead = stung ? puffedForehead(stingAge) : "Q-16-35-7-36L-5-39Q-2-41 1-36L6-39L10-35Q27-33 32-18";
    path(ctx, `M-33-10Q-32-25-19-32${forehead}Q40-2 28 9Q19 18 0 18Q-21 18-30 8Q-37 2-33-10Z`, face, outline, 3.1);
    if (stung) drawStingStars(stingAge);
    oval(ctx, turned ? -15 : -21, 0, 5.5, 3.2, "#db8d7580", -.18);
    oval(ctx, turned ? 24 : 21, 0, turned ? 3.5 : 5.5, 3.2, "#db8d7580", .18);
    ctx.save();
    if (turned) {
      ctx.translate(8, 0);
      ctx.scale(.88, 1);
    }
    oval(ctx, 0, 5, 16, 11, cream);
    const blinking = !motion.matches && blinkTime % 4.2 < .13;
    if (injured) {
      path(ctx, "M-20-16l7 3l-7 3m40-6l-7 3l7 3", null, outline, 2.5);
    } else if (phase === "win" || blinking) {
      path(ctx, "M-19-12q4-5 8 0m22 0q4-5 8 0", null, outline, 2.7);
    } else {
      oval(ctx, -15, -12.5, turned ? 3.4 : 2.8, 4.1, outline);
      oval(ctx, 15, -12.5, 2.8, 4.1, outline);
      oval(ctx, -14.4, -13.8, .85, 1, "#fff5dc");
      oval(ctx, 15.6, -13.8, .85, 1, "#fff5dc");
    }
    path(ctx, "M-7-1Q-6-6 0-6Q7-6 7-1Q6 2 1 4H-1Q-6 2-7-1Z", "#473026");
    if (injured) {
      path(ctx, "M-6 11Q0 5 6 11", null, outline, 1.9);
    } else {
      path(ctx, "M0 3v3q-4 6-9 2m9-2q4 6 9 2", null, outline, 1.8);
    }
    path(ctx, "M8 8q4-3 7 0q0 3-2 4q0 6-3 6q-3 0-3-3l1-3q-2-2 0-4Z", "#e8a537");
    path(ctx, "M9 8q1-1 3-1", null, "#fff1a5", 1.3);
    ctx.restore();
  }

  function honeyBear(bear, time, phase, injured, stingAge, movement = null) {
    const coat = bearCoats[bear.brown ? 1 : 0];
    const { fur, shade, light, cream } = coat;
    const falling = movement?.falling ?? false;
    ctx.save();
    ctx.translate(bear.x, bear.y);
    if (!falling) oval(ctx, 0, 33, 34, 5.5, "#4c4e343d");
    ctx.scale(movement?.facing ?? 1, 1);
    if (falling && !motion.matches) {
      ctx.rotate(.1);
      if (bear.patrol) {
        const stretch = .76 + .24 * clamp(bear.vy / 150, 0, 1);
        ctx.translate(0, 30);
        ctx.scale(1, stretch);
        ctx.translate(0, -30);
      }
    }

    path(ctx, "M-25 33Q-31 26-26 15Q-23 5-12 5H13Q24 6 27 16Q32 30 23 33Z", fur, bearOutline, 3);
    oval(ctx, 0, 23, 16, 12, cream);
    for (const side of [-1, 1]) {
      ctx.save();
      if (falling) ctx.translate(3, side === 1 ? -5 : -3);
      ctx.scale(-side, 1);
      path(ctx, "M-29 32q1-10 11-8q8 1 7 10h-14q-4 0-4-2Z", shade, bearOutline, 2.5);
      path(ctx, "M-22 32v-2m5 2v-2", null, "#d6ae876f", 1.5);
      ctx.restore();
    }

    const breathing = motion.matches ? 0 : Math.sin(time * 3.15 + bear.x) * .85;
    ctx.save();
    ctx.translate(0, breathing);
    drawBearHead(coat, time + bear.x * .015, phase, injured, stingAge, Boolean(movement));
    ctx.restore();

    drawHoneyPot();
    path(ctx, "M-17 19q5-2 7 3q2 5-3 6q-5 0-6-4q-1-3 2-5Zm34 0q-5-2-7 3q-2 5 3 6q5 0 6-4q1-3-2-5Z", light, bearOutline, 2);
    ctx.restore();
  }

  function crawlingBear(bear, time, facing, stride) {
    const coat = bearCoats[bear.brown ? 1 : 0];
    const { fur, shade, light } = coat;
    const step = motion.matches ? 0 : Math.sin(stride);
    const heel = motion.matches ? 0 : Math.cos(stride);
    const dip = Math.abs(step) * 2.4;
    const frontX = 9 - step * 7;
    const frontY = 33 - Math.max(0, -heel) * 5;
    const hindX = -26 + step * 6;
    const hindY = 33 - Math.max(0, heel) * 5;
    const farX = -21 - step * 5;
    const farY = 32 - Math.max(0, -heel) * 4;
    ctx.save();
    ctx.translate(bear.x, bear.y);
    ctx.scale(facing, 1);
    oval(ctx, -1, 33, 39, 4.5, "#4c4e343d");

    path(ctx, `M-29 15Q-32 24 ${farX - 7} ${farY - 3}Q${farX - 3} ${farY + 1} ${farX + 6} ${farY}
      Q${farX + 12} ${farY - 1} ${farX + 7} ${farY - 6}L-16 15Z`, shade, bearOutline, 2.3);
    const coatGradient = ctx.createLinearGradient(0, -12, 0, 33);
    coatGradient.addColorStop(0, light);
    coatGradient.addColorStop(1, fur);
    path(ctx, `M-39 11Q-39-6-22-10Q-6-13 13-2Q25 4 20 15
      Q19 21 ${frontX + 5} ${frontY - 8}
      Q${frontX + 14} ${frontY - 5} ${frontX + 12} ${frontY - 2}
      Q${frontX + 10} ${frontY + 1} ${frontX + 2} ${frontY}
      Q${frontX - 6} ${frontY} ${frontX - 8} 25
      Q-10 30 ${hindX + 7} 25
      Q${hindX + 14} ${hindY - 3} ${hindX + 9} ${hindY - 1}
      Q${hindX + 3} ${hindY + 1} ${hindX - 5} ${hindY - 1}
      Q${hindX - 12} ${hindY - 2}-36 23Q-39 19-39 11Z`, coatGradient, bearOutline, 2.8);
    path(ctx, "M-33 9Q-30-2-18-5", null, "#f2d4a675", 2);
    path(ctx, `M-26 13Q${hindX + 1} 17 ${hindX + 7} 25M-1 14Q1 20 ${frontX - 8} 25`, null, shade, 1.5);
    path(ctx, `M${hindX + 3} ${hindY - 2}v-2m4 1v-2M${frontX + 4} ${frontY - 2}v-2m4 1v-2`, null, "#d6ae876f", 1.4);

    ctx.save();
    ctx.translate(34, 9 + dip * .65);
    ctx.rotate(-.16);
    ctx.scale(.65, .65);
    drawHoneyPot();
    ctx.restore();

    ctx.save();
    ctx.translate(0, dip * .65);
    path(ctx, "M12 17Q20 18 24 23Q27 26 30 24Q34 23 34 27Q34 30 30 31Q22 31 17 27Q13 25 12 17Z", fur, bearOutline, 1.9);
    ctx.restore();
    ctx.save();
    ctx.translate(16 + step * 2.5, 10 + dip);
    ctx.rotate(.06);
    ctx.scale(.83, .83);
    drawBearHead(coat, time + bear.x * .015, "playing", false, null, true);
    ctx.restore();
    ctx.restore();
  }

  function beeSprite(bee, time, scale = 1) {
    ctx.save();
    ctx.translate(bee.x, bee.y);
    const charging = bee.type === "charge";
    const scout = bee.type === "scout";
    if (bee.charge) {
      ctx.save();
      ctx.rotate(bee.charge.angle);
      if (bee.charge.stage === "windup") {
        path(ctx, "M17-6l6 6-6 6M25-6l6 6-6 6", null, "#963d24", 3);
      } else if (!motion.matches) {
        path(ctx, "M-34-5h15m-10 6h10m-14 6h16", null, "#b35931a8", 2);
      }
      ctx.restore();
    }
    ctx.scale(Math.sign(bee.vx) || 1, 1);
    ctx.rotate(clamp(bee.vy / 210, -.5, .5));
    const size = scale * (charging ? 1.4 : bee.heavy ? 1.29 : scout ? .76 : 1);
    ctx.scale(size, size);
    const wing = motion.matches ? 1 : Math.sin(time * 59 + bee.id * 2) * .46 + 1;
    oval(ctx, -3, -6, 5.1, 6.5 * wing, scout ? "#d7f3e8ed" : "#fff8dcda", -.46);
    oval(ctx, 2, -7, 4.5, 5.7 * wing, scout ? "#e5fffaed" : "#fff8dcee", .39);
    path(ctx, "M-8 0l-4 3l4 2", "#5e4230", "#5e4230", 1);
    const bodyColor = charging ? "#e68144" : bee.heavy ? "#e99c45" : scout ? "#f6da78" : "#ffc85b";
    path(ctx, "M-9 2C-9-6 8-7 10 0C12 9-8 11-9 2Z", bodyColor, "#624335", 1.75);
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

  function movementGuides(round) {
    ctx.save();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = "#3e6956aa";
    ctx.setLineDash([5, 7]);
    for (const bear of round.level.dogs) {
      if (!bear.patrol) continue;
      const start = Math.min(bear.x, bear.patrol.to);
      const end = Math.max(bear.x, bear.patrol.to);
      const radius = RULES.puppyRadius + RULES.lineRadius;
      ctx.beginPath();
      ctx.roundRect(start - radius, bear.y - radius, end - start + 2 * radius, 2 * radius, radius);
      ctx.stroke();
      for (let x = start; x <= end; x += 23) {
        const y = bear.y + 24 + (Math.round((x - start) / 23) % 2 ? -5 : 0);
        oval(ctx, x, y, 4.5, 3.3, "#43654c9e", -.24);
        for (const [dx, dy] of [[.5, -5], [3.2, -5.3], [5, -4], [6.3, -1.6], [6, 1]]) {
          oval(ctx, x + dx, y + dy, 1.05, 1.2, "#43654c9e");
        }
      }
    }
    ctx.strokeStyle = "#596351b8";
    ctx.setLineDash([7, 6]);
    for (const box of round.level.boxes) {
      if (!box.travel) continue;
      const { dx = 0, dy = 0 } = box.travel;
      ctx.strokeRect(Math.min(box.x, box.x + dx), Math.min(box.y, box.y + dy),
        box.w + Math.abs(dx), box.h + Math.abs(dy));
    }
    ctx.restore();
  }

  function dropGuide(round) {
    if (!round.level.rescue?.releaseAt || round.rescue.released) return;
    const { y, patrol } = round.level.dogs[0];
    const x = patrol.to;
    inkPath([{ x, y: y + 42 }, { x, y: y + 91 }], "#744d39b0", 3, true);
    path(ctx, `M${x - 6} ${y + 84}l6 9 6-9`, null, "#744d39b0", 3);
    oval(ctx, x, y + 36, 8, 5, "#ffda80");
    oval(ctx, x, y + 36, 3.5, 2.5, "#806047");
  }

  function movingPlatforms(round) {
    const palette = PALETTES[round.level.palette];
    for (const box of round.platforms) {
      if (box.loadLimit !== undefined) {
        drawFragileBranch(box, round.elapsed);
        continue;
      }
      if (!box.travel) continue;
      if (box.kind === "float") {
        drawPlank(ctx, box);
        drawIceSurface(ctx, box);
        continue;
      }
      if (box.kind === "ledge") {
        drawRock(ctx, box);
        drawIceSurface(ctx, box);
        continue;
      }
      ctx.save();
      ctx.translate(box.x, box.y);
      ctx.fillStyle = palette.soil;
      ctx.fillRect(0, 0, box.w, box.h);
      ctx.fillStyle = "#547662";
      ctx.fillRect(0, 0, box.w, 6);
      ctx.fillStyle = palette.deep;
      ctx.fillRect(0, box.h - 4, box.w, 4);
      oval(ctx, 7, box.h / 2 + 1, 2.2, 2.2, "#f4d294");
      oval(ctx, box.w - 7, box.h / 2 + 1, 2.2, 2.2, "#f4d294");
      ctx.restore();
      drawIceSurface(ctx, box);
    }
  }

  function paint(round, view) {
    if (round.level !== previousLevel || canvas.width !== previousWidth || canvas.height !== previousHeight) {
      board = round.board;
      camera = boardViewport(canvas.width, canvas.height, board);
      scenery = {
        left: -camera.x / camera.scale,
        top: -camera.y / camera.scale,
        width: canvas.width / camera.scale,
        height: canvas.height / camera.scale,
      };
      backdrop.width = Math.min(3072, Math.ceil(scenery.width));
      backdrop.height = Math.min(3072, Math.ceil(scenery.height));
      const scaleX = backdrop.width / scenery.width;
      const scaleY = backdrop.height / scenery.height;
      bg.setTransform(scaleX, 0, 0, scaleY, -scenery.left * scaleX, -scenery.top * scaleY);
      habitat(round);
      previousLevel = round.level;
      previousWidth = canvas.width;
      previousHeight = canvas.height;
    }
    ctx.setTransform(camera.scale, 0, 0, camera.scale, camera.x, camera.y);
    ctx.drawImage(backdrop, scenery.left, scenery.top, scenery.width, scenery.height);

    const time = view.age;
    const moving = round.phase === "playing";
    if (round.level.chapterId === "snow") {
      const drift = motion.matches ? 0 : time;
      for (let index = 0; index < 18; index++) {
        const x = (index * 127 + Math.sin(drift + index) * 5 + board.width) % board.width;
        const y = (index * 83 + drift * (5 + index % 3)) % (board.ground - 48);
        oval(ctx, x, y, 1.3 + index % 3 * .4, 1.3 + index % 3 * .4, "#fffef5b3");
      }
    }
    if (round.phase === "ready") movementGuides(round);
    movingPlatforms(round);
    const ready = round.phase === "ready";
    const waveWarning = moving && round.waves.find(wave =>
      wave.at - round.elapsed <= RULES.hiveWarning && round.elapsed - wave.at < .35);
    for (const [index, hive] of round.level.hives.entries()) {
      if (waveWarning && waveWarning.launches.some(launch => launch.hiveIndex === index)) {
        oval(ctx, hive.x, hive.y - 5, 53, 50, "#ffbe6079");
        oval(ctx, hive.x, hive.y - 5, 46, 44, "#ffe49d93");
      }
      drawHive(hive, time, moving);
      if (!ready) continue;
      const angle = motion.matches ? index * 2 : time * 1.13 + index * 2.4;
      beeSprite({ x: hive.x + Math.cos(angle) * 55, y: hive.y + 8 + Math.sin(angle) * 24,
        vx: -Math.sin(angle), vy: 0, id: index, type: hive.special }, time, .87);
    }
    if (round.level.wind && !motion.matches) {
      const strength = windAt(round.level, round.elapsed);
      const direction = strength < 0 ? -1 : 1;
      ctx.globalAlpha = .31;
      for (let i = 0; i < 4; i++) {
        const offset = ((time * (25 + i * 8) + i * 230) % 1000) - 45;
        const x = direction > 0 ? offset : board.width - offset;
        const y = 110 + i * 89;
        path(ctx, "M" + x + " " + y + "q24-6 57 0m-8 7h17", null, "#fff8dd", 2);
      }
      ctx.globalAlpha = 1;
    }
    if (round.level.rescue) rescueBranch(round);
    dropGuide(round);
    for (const [index, bear] of round.dogs.entries()) {
      const released = index === 0 && round.rescue?.released;
      const crawling = bear.patrol && !released;
      const falling = released && !round.rescue.supported && bear.vy >= 0;
      if (moving && (crawling || falling || Math.abs(bear.vx) > 10)) {
        const origin = round.level.dogs[index];
        const facing = Math.sign(bear.vx) || (origin.patrol?.to < origin.x ? -1 : 1);
        if (crawling) {
          crawlingBear(bear, time, facing, (bear.x - origin.x) * facing * .2);
        } else {
          honeyBear(bear, time, round.phase, false, null, { facing, falling });
        }
        continue;
      }
      const stung = round.touched === index;
      const injured = stung || Boolean(round.rescue && round.phase === "loss" && round.failure !== "bees");
      honeyBear(bear, time, round.phase, injured, stung ? view.stingAge ?? 0 : null);
    }
    const ink = round.inkBody?.path ?? round.points;
    inkPath(ink, "#283b32", RULES.lineRadius * 2);
    if (ink.length) {
      ctx.save();
      ctx.translate(0, -1.7);
      inkPath(ink, "#64786a", 2.6);
      ctx.restore();
      if (view.drawing) {
        const p = round.points.at(-1);
        oval(ctx, p.x, p.y, 7.2, 7.2, "#23362d");
        oval(ctx, p.x - 1.7, p.y - 1.6, 2.2, 2.2, "#dbe4c9");
      }
    }
    if (round.level.rescue?.hazard.kind === "lava") rescueLava(round, time);
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

  return { paint, mapLandscape };
}
