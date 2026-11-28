"use strict";

(() => {
  const byId = id => document.getElementById(id);
  const field = byId("field");
  const { paint, mapLandscape } = makePainter(field, () => document.createElement("canvas"),
    matchMedia("(prefers-reduced-motion: reduce)"));
  const audio = makeAudio();
  const saveKey = "ink-and-honey-progress-v2";
  const oldSaveKey = "ink-and-honey-progress-v1";
  const stingMessage = "哎呀，小熊被蛰到了！";
  const beeBadges = {
    heavy: { label: "重蜂", mark: "⬢" },
    charge: { label: "冲锋蜂", mark: "冲锋" },
    scout: { label: "钻缝蜂", mark: "钻缝" },
  };
  const stingRevealSeconds = 1.05;
  const previewSaveKey = "ink-and-honey-jungle-preview-v1";
  const lockIcon = '<svg class="node-lock" viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="5" width="7" height="6" rx="1" fill="currentColor"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const challengeIcon = '<svg class="node-flag" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 17V3m0 1c3-3 7 3 11 0v8c-4 3-8-3-11 0" fill="#ffdb83" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const backgroundControls = [byId("round-bar"), field];
  const ui = {
    result: byId("result"), resultCard: byId("result-card"), next: byId("result-next"), retry: byId("result-retry"),
    timer: byId("timer-label"), ink: byId("ink-label"), fill: byId("ink-fill"),
    meter: byId("ink-meter"), notice: byId("notice"),
    announce: byId("announcement"), help: byId("round-help"), rule: byId("round-rule"),
    wind: byId("wind-indicator"), windArrow: byId("wind-arrow"),
    waves: byId("waves"),
  };
  const best = readProgress(saveKey);
  const previewBest = readProgress(previewSaveKey);
  const screens = { home: byId("home-screen"), map: byId("map-screen"), game: byId("game-screen") };
  const mapArt = ["meadow-canopy", "lake-canyon", "snow-caldera"];
  let screen = "home";
  let levelIndex = 0;
  let frameId = 0;
  let nextLevel = -1;
  let round;
  let pointer = null;
  let noticeTimer;
  let previousInk;
  let previousTime;
  let previousWind;
  let waveNodes = [];
  let activeWave = -1;
  let sound = false;
  let lag = 0;
  let time = 0;
  let lastFrame = performance.now();
  const view = { age: 0, drawing: false, cursor: null, stingAge: null };

  function setScreen(next) {
    if (screen === "game" && next !== "game") {
      resetPointer();
      cancelAnimationFrame(frameId);
      closeResult();
    }
    screen = next;
    for (const [key, element] of Object.entries(screens)) element.hidden = key !== screen;
  }

  function paintMapTrail() {
    if (screen !== "map") return;
    const chapters = [...byId("map-route").querySelectorAll(".map-chapter")];
    for (const [chapterIndex, chapter] of chapters.entries()) {
      const bounds = chapter.getBoundingClientRect();
      const points = [...chapter.querySelectorAll(".node")].map(node => {
        const rect = node.getBoundingClientRect();
        return [rect.x - bounds.x + rect.width / 2, rect.y - bounds.y + rect.height / 2];
      });
      if (chapterIndex > 0) points.unshift([bounds.width / 2, 0]);
      if (chapterIndex < chapters.length - 1) points.push([bounds.width / 2, bounds.height]);
      const trail = chapter.querySelector(".map-trail");
      const scale = Math.min(devicePixelRatio || 1, 2);
      trail.width = Math.max(1, Math.round(bounds.width * scale));
      trail.height = Math.max(1, Math.round(bounds.height * scale));
      const context = trail.getContext("2d");
      context.scale(trail.width / bounds.width, trail.height / bounds.height);
      context.beginPath();
      context.moveTo(...points[0]);
      for (let index = 1; index < points.length; index++) {
        const [x, y] = points[index];
        const [previousX, previousY] = points[index - 1];
        const middleY = (y + previousY) / 2;
        context.bezierCurveTo(previousX, middleY, x, middleY, x, y);
      }
      context.lineCap = "round";
      context.lineWidth = 21;
      context.strokeStyle = "#59473179";
      context.stroke();
      context.lineWidth = 17;
      context.strokeStyle = "#eddbab";
      context.stroke();
    }
  }

  function starRow(count) {
    const row = document.createElement("span");
    row.className = "star-row";
    row.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 3; index++) {
      const star = document.createElement("img");
      star.src = index < count ? "./assets/map-star-earned.webp" : "./assets/map-star-empty.webp";
      star.alt = "";
      star.width = 72;
      star.height = 72;
      row.append(star);
    }
    return row;
  }

  function showMap() {
    setScreen("map");
    const unplayed = PORTRAIT_LEVELS.findIndex(level => !best[level.id]);
    const recommended = unplayed < 0 ? PORTRAIT_LEVELS.length - 1 : unplayed;
    const total = PORTRAIT_LEVELS.length;
    byId("overall").textContent = (unplayed < 0 ? total : PORTRAIT_LEVELS.filter(level => best[level.id]).length) + "/" + total + " 关";
    const fragment = document.createDocumentFragment();
    let activeNode;
    let index = 0;
    let region;
    for (const [chapterIndex, chapter] of PORTRAIT_CHAPTERS.entries()) {
      if (chapterIndex % 2 === 0) {
        region = document.createElement("div");
        region.className = "map-region";
        const artwork = document.createElement("img");
        artwork.className = "map-illustration";
        artwork.alt = "";
        artwork.hidden = true;
        artwork.addEventListener("load", () => {
          artwork.hidden = false;
          artwork.parentElement.classList.add("painted");
        }, { once: true });
        artwork.src = "./assets/map-" + mapArt[chapterIndex / 2] + ".webp";
        region.append(artwork);
        fragment.append(region);
      }
      const terrain = document.createElement("section");
      terrain.className = "map-chapter";
      terrain.dataset.chapter = chapter.id;
      const scenery = mapLandscape(chapter);
      scenery.className = "map-landscape";
      scenery.setAttribute("aria-hidden", "true");
      const trail = document.createElement("canvas");
      trail.className = "map-trail";
      trail.setAttribute("aria-hidden", "true");
      const title = document.createElement("h3");
      title.className = "chapter-label";
      title.textContent = chapter.name;
      const path = document.createElement("ol");
      path.className = "map-nodes";
      path.start = index + 1;
      for (const level of chapter.levels) {
        const position = index++;
        const item = document.createElement("li");
        item.className = "map-node";
        const button = document.createElement("button");
        button.type = "button";
        button.className = level.challenge ? "node challenge" : "node";
        button.dataset.levelId = level.id;
        button.disabled = position > recommended;
        const status = button.disabled ? "未解锁" : best[level.id] ? "已获得 " + best[level.id] + " 颗星" : "尚未通过";
        button.setAttribute("aria-label", chapter.name + "第 " + level.chapterLevel + " 关，" + level.name +
          (level.challenge ? "，挑战关，" : "，") + status);
        const number = document.createElement("span");
        number.className = "node-number";
        number.textContent = String(position + 1);
        button.append(number);
        if (level.challenge) button.insertAdjacentHTML("beforeend", challengeIcon);
        if (button.disabled) button.insertAdjacentHTML("beforeend", lockIcon);
        else if (best[level.id]) button.append(starRow(best[level.id]));
        if (position === recommended) {
          button.setAttribute("aria-current", "step");
          activeNode = button;
        }
        button.addEventListener("click", () => selectLevel(position));
        item.append(button);
        path.append(item);
      }
      terrain.append(scenery, trail, title, path);
      region.append(terrain);
    }
    byId("map-route").replaceChildren(fragment);
    paintMapTrail();
    const scroller = byId("map-scroll");
    const top = activeNode.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTop = top - (scroller.clientHeight - activeNode.offsetHeight) * .43;
    activeNode.focus({ preventScroll: true });
  }
  function readProgress(key) {
    const score = value => Number.isInteger(value) ? clamp(value, 0, 3) : 0;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return Object.fromEntries(Object.entries(data).map(([id, value]) => [id, score(value)]));
      }
    } catch {
      // Recover legacy progress when the current record is unreadable.
    }
    if (key === saveKey) {
      try {
        const old = JSON.parse(localStorage.getItem(oldSaveKey));
        if (Array.isArray(old)) return Object.fromEntries(LEGACY_LEVELS.map((level, index) => [level.id, score(old[index])]));
      } catch {
        // Storage can be disabled when a local file is opened.
      }
    }
    return {};
  }

  function saveProgress() {
    try {
      localStorage.setItem(saveKey, JSON.stringify(best));
    } catch {
      // Keep playing with the in-memory progress when storage is unavailable.
    }
  }

  function unlocked(index) {
    return index >= 0 && index < PORTRAIT_LEVELS.length && PORTRAIT_LEVELS.slice(0, index).every(level => best[level.id] > 0);
  }

  function selectLevel(index) {
    if (!unlocked(index)) return;
    const entering = screen !== "game";
    setScreen("game");
    levelIndex = index;
    newRound(true);
    if (entering) {
      lastFrame = performance.now();
      frameId = requestAnimationFrame(loop);
    }
  }

  function resetPointer() {
    const captured = pointer;
    pointer = null;
    if (captured !== null && field.hasPointerCapture(captured)) field.releasePointerCapture(captured);
    view.drawing = false;
  }
  function closeResult() {
    ui.result.hidden = true;
    backgroundControls.forEach(element => { element.inert = false; });
  }

  function newRound(focus) {
    resetPointer();
    view.cursor = null;
    view.stingAge = null;
    lag = 0;
    round = makeRound(PORTRAIT_LEVELS[levelIndex]);
    showWaves();
    closeResult();
    ui.notice.hidden = true;
    clearTimeout(noticeTimer);
    const chapter = PORTRAIT_CHAPTERS[round.level.groupIndex];
    byId("round-number").textContent = chapter.name + " · 第 " + round.level.chapterLevel + " 关";
    byId("round-title").textContent = round.level.name;
    ui.wind.hidden = !round.level.wind;
    previousWind = undefined;
    const instruction = round.level.rescue?.releaseAt ? "在脚印尽头的下方画好吊床，松手让小熊出发。" :
      round.rescue ? "借地形撑住墨线，再把线画到小熊下方。" : "按住拖动来画线，松手后蜂群就会出发。";
    ui.rule.textContent = round.level.ruleNote ?? "";
    ui.rule.hidden = !round.level.ruleNote;
    ui.help.textContent = instruction + (round.level.ruleNote ?? "");
    updateHud();
    resizeCanvas();
    paint(round, view);
    if (focus) field.focus({ preventScroll: true });
  }

  function showWaves() {
    activeWave = -1;
    waveNodes = round.waves.map((wave, index) => {
      const node = document.createElement("li");
      const number = document.createElement("strong");
      number.textContent = "第 " + (index + 1) + " 波";
      const locations = new Set(wave.launches.map(({ hiveIndex }) => {
        const { x, y } = round.level.hives[hiveIndex];
        const side = x < round.board.width * .4 ? "左" : x > round.board.width * .6 ? "右" : "";
        return side + (y < round.board.height * .57 ? "上" : "下");
      }));
      const directions = locations.size > 1 ? "多向" : [...locations][0];
      const arrows = { 左上: "↖", 上: "↑", 右上: "↗", 左下: "↙", 下: "↓", 右下: "↘", 多向: "✦" };
      const types = [...new Set(wave.launches.map(launch => launch.special ?? (launch.heavy ? "heavy" : null)).filter(Boolean))];
      const bee = document.createElement("img");
      bee.className = "wave-icon";
      bee.alt = "";
      bee.hidden = true;
      bee.addEventListener("load", () => { bee.hidden = false; }, { once: true });
      bee.src = "./assets/ui-icon-bee.webp";
      const timing = document.createElement("span");
      timing.className = "wave-time";
      timing.textContent = wave.at + " 秒";
      const arrow = document.createElement("span");
      arrow.className = "wave-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = arrows[directions];
      node.append(bee, number, timing, arrow);
      const label = ["第 " + (index + 1) + " 波", wave.at + " 秒", directions,
        ...types.map(type => beeBadges[type].label)].join(" · ");
      node.setAttribute("aria-label", label);
      node.title = label;
      for (const type of types) {
        const badge = document.createElement("span");
        badge.className = "wave-type";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = beeBadges[type].mark;
        node.append(badge);
      }
      return node;
    });
    ui.waves.replaceChildren(...waveNodes);
  }

  function updateHud() {
    const waveIndex = round.phase === "ready" ? -1 : round.waves.findLastIndex(wave => round.elapsed >= wave.at);
    if (waveIndex !== activeWave) {
      waveNodes[activeWave]?.removeAttribute("aria-current");
      waveNodes[waveIndex]?.setAttribute("aria-current", "step");
      activeWave = waveIndex;
    }
    const percent = Math.round(100 * (1 - round.ink / round.level.ink));
    if (percent !== previousInk) {
      ui.ink.textContent = percent + "%";
      ui.fill.style.transform = "scaleX(" + percent / 100 + ")";
      ui.meter.setAttribute("aria-valuenow", percent);
      ui.meter.classList.toggle("low", percent < 24);
      previousInk = percent;
    }
    const remaining = (Math.ceil(Math.max(0, round.time - 1e-9) * 10) / 10).toFixed(1);
    if (remaining !== previousTime) {
      ui.timer.textContent = remaining;
      ui.timer.parentElement.classList.toggle("urgent", round.time < 2);
      previousTime = remaining;
    }
    if (round.level.wind) {
      const velocity = windAt(round.level, round.elapsed);
      const reversing = round.phase === "ready" && round.level.wind.mode === "reversing";
      const direction = reversing ? "↔" : velocity > 4 ? "→" : velocity < -4 ? "←" : "·";
      if (direction !== previousWind) {
        ui.windArrow.textContent = direction;
        const label = reversing ? "本关风向会反转" :
          direction === "→" ? "风向右吹" : direction === "←" ? "风向左吹" : "风暂时减弱";
        const forecast = label + (round.level.wind.inkFactor ? "，风也会推墨线" : "");
        ui.wind.setAttribute("aria-label", forecast);
        ui.wind.title = forecast;
        previousWind = direction;
      }
    }
  }

  function announce(message) {
    ui.announce.textContent = message;
  }

  function notify(message) {
    ui.notice.textContent = message;
    ui.notice.hidden = false;
    announce(message);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { ui.notice.hidden = true; }, 1850);
  }

  function addPoint(point) {
    const event = extendStroke(round, point);
    if (event === "puppy" || event === "terrain" || event === "patrol") {
      view.drawing = false;
      notify({
        puppy: "墨线碰到小熊了，从它身边重新起笔。",
        terrain: "沿着地形边缘画，墨线别穿过实地。",
        patrol: "给小熊留出散步空间，沿脚印外侧画线。",
      }[event]);
    }
    if (event === "dry" && round.ink === round.level.ink && ui.notice.hidden) {
      notify("墨水用完了，松手让防线生效。");
    }
    return event;
  }

  function beginStroke(point) {
    if (round.phase !== "ready" || view.drawing) return false;
    ui.notice.hidden = true;
    clearTimeout(noticeTimer);
    discardStroke(round);
    view.drawing = true;
    addPoint(point);
    return view.drawing;
  }

  function finishStroke() {
    if (!view.drawing) return;
    view.drawing = false;
    if (!launchSwarm(round)) {
      const hasLine = round.ink > 0;
      discardStroke(round);
      if (hasLine) notify(round.rescue ? "再画长一点，让墨线能搭住地形。" : "再画长一点，才能挡住蜜蜂。");
      return;
    }
    ui.notice.hidden = true;
    ui.rule.hidden = true;
    ui.help.textContent = round.level.rescue?.releaseAt ? "小熊正沿脚印走向断口。" :
      round.rescue ? "接住小熊，守到倒计时归零。" : "蜂群出发了，小心防线被撞歪！";
    announce(ui.help.textContent);
    audio.effect("start");
  }

  function showResult() {
    const won = round.phase === "win";
    ui.resultCard.dataset.outcome = won ? "win" : round.failure === "bees" ? "stung" : "loss";
    if (won) {
      best[round.level.id] = Math.max(best[round.level.id] ?? 0, round.stars);
      saveProgress();
    }
    const rescue = Boolean(round.level.rescue);
    nextLevel = won && unlocked(levelIndex + 1) ? levelIndex + 1 : -1;
    const finished = won && nextLevel === -1;
    if (round.failure !== "bees") audio.effect(won ? "win" : "loss");
    const used = Math.round(round.ink / round.level.ink * 100);
    byId("result-stars").replaceChildren(starRow(won ? round.stars : 0));
    const rescueLoss = {
      water: ["小熊掉进水里了", "让墨线在支点上搭稳，给接小熊的部分留出水面余量。"],
      spikes: ["小熊碰到尖刺了", "在木桩上多搭一截，别让墨线滑进刺沟。"],
      lava: ["小熊碰到熔岩了", "借更高的岩沿撑住墨线，给上升的熔岩留出空间。"],
      bees: [stingMessage, "把靠蜂巢的一侧画高些，挡住追过来的蜜蜂。"],
      missed: ["吊床没接住小熊", "让线从小熊正下方经过。"],
    };
    const loss = rescueLoss[round.failure] ?? rescueLoss.missed;
    let advice = rescue ? loss[1] : "试试让防线靠稳地形。";
    if (round.failure === "bees") {
      if (round.stungBy === "charge") advice = "冲锋蜂蓄力后会直撞。让墨线靠住土柱或地面。";
      else if (round.stungBy === "scout") advice = "钻缝蜂会沿墨线找开口。试试把线尾贴近岩沿。";
      else if (round.level.beeLossAdvice) advice = round.level.beeLossAdvice;
    }
    if (round.fragilePlatforms.some(box => box.brokenAt !== undefined)) {
      advice = "细枝断了。试试少画一点，或把重量分到结实的木桩上。";
    } else if (round.level.wind?.inkFactor) {
      advice = "风会推墨线。试试借粗糙的岩沿稳住防线，给滑动的雪台留出余量。";
    } else if (round.platforms.some(box => box.iceFrom !== undefined)) {
      advice = "冰面会滑。试试让墨线靠住粗糙的岩沿。";
    }
    const title = won ? (finished ? "全员安全！" : "小熊安全啦！") : rescue ? loss[0] : stingMessage;
    byId("result-title").textContent = title;
    byId("result-copy").textContent = won
      ? "用了 " + used + "% 的墨水，拿到 " + round.stars + " 颗星。"
      : "撑了 " + round.elapsed.toFixed(1) + " 秒。" + advice;
    ui.retry.textContent = won ? "再画一笔" : "再试一次";
    ui.help.textContent = won ? (finished ? "六个场景已全部通过。" : "本关通过，可以继续闯关。") : "重画防线，再试一次。";
    ui.next.hidden = nextLevel === -1;
    const nextGroup = PORTRAIT_LEVELS[nextLevel]?.chapterId;
    ui.next.textContent = nextLevel === levelIndex + 1
      ? (nextGroup === round.level.chapterId ? "下一关 →" : "下一章 →")
      : "继续闯关 →";
    ui.result.hidden = false;
    backgroundControls.forEach(element => { element.inert = true; });
    if (round.failure !== "bees") announce(title);
    (ui.next.hidden ? ui.retry : ui.next).focus({ preventScroll: true });
  }

  function coordinates(event, requireBoard = false) {
    const rect = field.getBoundingClientRect();
    const camera = boardViewport(field.width, field.height, round.board);
    const x = ((event.clientX - rect.left) / rect.width * field.width - camera.x) / camera.scale;
    const y = ((event.clientY - rect.top) / rect.height * field.height - camera.y) / camera.scale;
    if (requireBoard && (x < 0 || x > round.board.width || y < 0 || y > round.board.height)) return null;
    return {
      x: clamp(x, 0, round.board.width),
      y: clamp(y, 0, round.board.height),
    };
  }

  field.addEventListener("pointerdown", event => {
    if (event.button !== 0 || pointer !== null || round.phase !== "ready") return;
    const point = coordinates(event, true);
    if (!point) return;
    event.preventDefault();
    field.focus({ preventScroll: true });
    view.cursor = null;
    if (!beginStroke(point)) return;
    pointer = event.pointerId;
    field.setPointerCapture(pointer);
  });

  field.addEventListener("pointermove", event => {
    if (event.pointerId !== pointer || !view.drawing) return;
    const samples = event.getCoalescedEvents?.();
    for (const sample of samples?.length ? samples : [event]) {
      addPoint(coordinates(sample));
      if (!view.drawing) break;
    }
  });

  field.addEventListener("pointerup", event => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    if (view.drawing) addPoint(coordinates(event));
    finishStroke();
  });

  function cancelPointer(event) {
    if (event.pointerId !== pointer) return;
    pointer = null;
    view.drawing = false;
    discardStroke(round);
  }
  field.addEventListener("pointercancel", cancelPointer);
  field.addEventListener("lostpointercapture", cancelPointer);
  field.addEventListener("blur", () => {
    if (!view.cursor) return;
    view.cursor = null;
    if (view.drawing && pointer === null) {
      view.drawing = false;
      discardStroke(round);
    }
  });

  field.addEventListener("keydown", event => {
    if (round.phase !== "ready" || pointer !== null) return;
    const directions = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const direction = directions[event.key];
    const activate = event.code === "Space" || event.key === "Enter";
    if (!direction && !activate) return;
    event.preventDefault();
    if (!view.cursor) {
      const [x, y] = round.level.guide[0];
      view.cursor = { x, y };
    }
    if (activate && !event.repeat) {
      if (view.drawing) finishStroke();
      else beginStroke(view.cursor);
    }
    if (direction) {
      const step = event.shiftKey ? 18 : 6;
      view.cursor = { x: clamp(view.cursor.x + direction[0] * step, 0, round.board.width),
        y: clamp(view.cursor.y + direction[1] * step, 0, round.board.height) };
      if (view.drawing) addPoint(view.cursor);
    }
  });

  document.addEventListener("keydown", event => {
    if (screen !== "game") return;
    if (event.key === "Escape" && (round.phase !== "ready" || view.drawing)) {
      event.preventDefault();
      newRound(true);
    }
    if (event.key === "Tab" && !ui.result.hidden) {
      const first = byId("result-map");
      const last = ui.next.hidden ? ui.retry : ui.next;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const retry = () => {
    audio.effect("reset");
    newRound(true);
  };
  ui.retry.addEventListener("click", retry);
  byId("restart").addEventListener("click", retry);
  ui.next.addEventListener("click", () => selectLevel(nextLevel));
  byId("start").addEventListener("click", showMap);
  byId("back-map").addEventListener("click", showMap);
  byId("result-map").addEventListener("click", showMap);
  byId("back-home").addEventListener("click", () => {
    setScreen("home");
    byId("start").focus({ preventScroll: true });
  });
  byId("sound").addEventListener("click", () => {
    sound = audio.setEnabled(!sound);
    byId("sound").setAttribute("aria-pressed", String(sound));
    byId("sound").setAttribute("aria-label", sound ? "关闭声音" : "开启声音");
    byId("sound-wave").setAttribute("d", sound ? "M15 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" : "m15 10 5 5m0-5-5 5");
    byId("sound-label").textContent = sound ? "声音开启" : "声音关闭";
    if (sound) audio.effect("reset");
  });

  function resizeCanvas() {
    const widthCSS = field.clientWidth;
    const heightCSS = field.clientHeight;
    if (screen !== "game" || !round || !widthCSS || !heightCSS) return;
    const scale = Math.min(devicePixelRatio || 1, 2, 4096 / widthCSS, 4096 / heightCSS);
    const width = Math.max(1, Math.round(widthCSS * scale));
    const height = Math.max(1, Math.round(heightCSS * scale));
    if (width === field.width && height === field.height) return;
    field.width = width;
    field.height = height;
    paint(round, view);
  }

  function loop(now) {
    const dt = document.hidden ? 0 : Math.min((now - lastFrame) / 1000, .07);
    lastFrame = now;
    time += dt;
    view.age = time;
    if (round.phase === "playing") {
      lag += dt;
      const bounces = round.bounces;
      const wasReleased = round.rescue?.released;
      const elapsed = round.elapsed;
      while (lag >= RULES.step && round.phase === "playing") {
        stepRound(round);
        lag -= RULES.step;
      }
      if (round.bounces !== bounces) audio.effect("bounce");
      if (round.fragilePlatforms.some(box => box.brokenAt > elapsed) && round.phase === "playing") {
        notify("细枝断了，墨线失去了一处支撑。");
      }
      if (round.level.rescue?.releaseAt && !wasReleased && round.rescue.released && round.phase === "playing") {
        ui.help.textContent = "小熊从断口落下了，守到倒计时归零。";
        announce(ui.help.textContent);
      }
      if (round.failure === "bees") {
        view.stingAge = 0;
        ui.help.textContent = stingMessage;
        audio.effect("loss");
        announce(stingMessage);
      } else if (round.phase !== "playing") {
        showResult();
      }
    }
    if (view.stingAge !== null && ui.result.hidden) {
      view.stingAge += dt;
      if (view.stingAge >= stingRevealSeconds) showResult();
    }
    audio.tick();
    updateHud();
    paint(round, view);
    frameId = requestAnimationFrame(loop);
  }

  window.__omGame = {
    getState: () => ({
      screen, phase: screen === "game" ? round.phase : "menu", level: levelIndex + 1,
      seconds: round?.time, ink: round?.ink, stars: round?.stars,
      levelId: round?.level.id, group: round && round.level.groupIndex + 1,
      mode: "adventure", chapterId: round?.level.chapterId, chapterLevel: round?.level.chapterLevel,
      wave: activeWave + 1, waveTimes: round?.waves.map(wave => wave.at) ?? [],
      result: ["win", "loss"].includes(round?.phase) ? round.phase : null, failure: round?.failure, stungBy: round?.stungBy,
      best: LEVELS.map(level => best[level.id] ?? 0),
      rescueBest: best[RESCUE_LEVELS[0].id] ?? 0,
      rescueProgress: RESCUE_LEVELS.map(level => best[level.id] ?? 0),
      campaignProgress: PORTRAIT_LEVELS.map(level => best[level.id] ?? 0),
      previewProgress: JUNGLE_PREVIEW.map(level => previewBest[level.id] ?? 0),
      selfId: "local", players: { local: { connected: true, x: 0, z: 0 } },
    }),
    getStats: () => {
      if (screen !== "game") return { entities: 0, tick: 0, dogs: [] };
      const body = round.inkBody;
      return {
        entities: round.bees.length + round.dogs.length, tick: round.ticks, bounces: round.bounces,
        activeBees: round.bees.filter(bee => bee.delay <= round.elapsed).length,
        activeHeavyBees: round.bees.filter(bee => bee.heavy && bee.delay <= round.elapsed).length,
        specialBees: round.bees.filter(bee => bee.type && bee.delay <= round.elapsed)
          .map(bee => ({ type: bee.type, stage: bee.charge?.stage })),
        dogs: round.dogs.map(({x, y}) => ({x, y})),
        platforms: round.platforms.map(({x, y}) => ({x, y})),
        fragile: round.fragilePlatforms.map(({ id, overload = 0, brokenAt }) => ({ id, overload, brokenAt })),
        shield: body && { x: body.x, y: body.y, angle: body.angle },
        hammock: round.rescue ? { supports: rescueSupports(round), caught: round.rescue.caught, released: round.rescue.released } : null,
        hazard: round.rescue ? { kind: round.level.rescue.hazard.kind, y: rescueHazardY(round) } : null,
      };
    },
    sendAction(action) {
      if (screen !== "game") return false;
      if (action?.type === "restart") return retry();
      if (action?.type !== "draw" || !Array.isArray(action.points) || action.points.length < 2 ||
          action.points.length > 512 || round.phase !== "ready" || view.drawing) return false;
      const points = action.points;
      if (!points.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y) &&
          point.x >= 0 && point.x <= round.board.width && point.y >= 0 && point.y <= round.board.height)) return false;
      if (!beginStroke(points[0])) return false;
      for (const point of points.slice(1)) {
        addPoint(point);
        if (!view.drawing) return false;
      }
      finishStroke();
      return round.phase === "playing";
    },
    runSelfTests: () => ({ ...runEngineChecks(), ...runPortraitChecks() }),
  };

  const titleArt = byId("title-art");
  function showTitleArt() {
    titleArt.hidden = false;
    byId("title-text").classList.add("sr-only");
  }
  titleArt.addEventListener("load", showTitleArt);
  if (titleArt.complete && titleArt.naturalWidth) showTitleArt();
  for (const artwork of document.querySelectorAll("[data-ui-art]")) {
    artwork.addEventListener("load", () => { artwork.hidden = false; }, { once: true });
    if (artwork.complete && artwork.naturalWidth) artwork.hidden = false;
  }
  new ResizeObserver(resizeCanvas).observe(field);
  new ResizeObserver(paintMapTrail).observe(byId("map-route"));
})();
