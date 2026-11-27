"use strict";

(() => {
  const byId = id => document.getElementById(id);
  const field = byId("field");
  const paint = makePainter(field);
  const audio = makeAudio();
  const saveKey = "ink-and-honey-progress-v1";
  const chapterNames = ["第一关", "第二关", "第三关", "第四关", "第五关", "第六关", "第七关"];
  const lockIcon = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="5" width="7" height="5.5" rx="1"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5"/></svg>';
  const backgroundControls = [document.querySelector(".masthead"), document.querySelector(".intro"), document.querySelector(".stage-bar"), document.querySelector(".side"), field];
  const ui = {
    result: byId("result"), next: byId("result-next"), retry: byId("result-retry"),
    timer: byId("timer-label"), ink: byId("ink-label"), fill: byId("ink-fill"),
    meter: byId("ink-meter"), rounds: byId("rounds"), hint: byId("hint"), notice: byId("notice"),
    announce: byId("announcement"), help: byId("round-help"),
  };
  const best = readProgress();
  let levelIndex = 0;
  let round;
  let pointer = null;
  let noticeTimer;
  let previousInk;
  let previousTime;
  let sound = false;
  let lag = 0;
  let time = 0;
  let lastFrame = performance.now();
  const view = { age: 0, hint: !best[0], drawing: false, cursor: null };
  const nodes = LEVELS.map((level, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = level.challenge ? "round challenge" : "round";
    button.addEventListener("click", () => selectLevel(index));
    ui.rounds.append(button);
    return button;
  });

  function readProgress() {
    try {
      const data = JSON.parse(localStorage.getItem(saveKey));
      return LEVELS.map((level, index) => Number.isInteger(data?.[index]) ? clamp(data[index], 0, 3) : 0);
    } catch {
      return LEVELS.map(() => 0);
    }
  }

  function unlocked(index) {
    return index === 0 || Boolean(best[index - 1]);
  }

  function selectLevel(index) {
    if (!LEVELS[index] || !unlocked(index)) return;
    levelIndex = index;
    view.hint = index === 0 && !best[0];
    newRound(true);
  }

  function updateLevels() {
    nodes.forEach((button, index) => {
      button.disabled = !unlocked(index);
      if (index === levelIndex) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      const stars = best[index];
      const status = button.disabled ? "未解锁" : stars ? "已获得 " + stars + " 颗星" : "未通过";
      button.setAttribute("aria-label", chapterNames[index] + "，" + LEVELS[index].name + "，" + status);
      const number = String(index + 1).padStart(2, "0");
      const label = LEVELS[index].challenge ? number + " · 挑战关" : number;
      button.innerHTML = "<span>" + label + "</span>" +
        (button.disabled ? lockIcon : "<small aria-hidden=\"true\">" + "★".repeat(stars) + "</small>");
    });
    const stars = best[levelIndex];
    byId("best").textContent = stars ? "本关最佳 " + stars + " / 3 星" : "本关尚未获得星星";
    byId("overall").textContent = "已通过 " + best.filter(Boolean).length + " / " + LEVELS.length;
  }

  function closeResult() {
    ui.result.hidden = true;
    backgroundControls.forEach(element => { element.inert = false; });
  }

  function newRound(focus) {
    pointer = null;
    view.drawing = false;
    view.cursor = null;
    lag = 0;
    round = makeRound(LEVELS[levelIndex]);
    closeResult();
    ui.notice.hidden = true;
    clearTimeout(noticeTimer);
    byId("round-number").textContent = chapterNames[levelIndex];
    byId("round-theme").textContent = round.level.theme;
    byId("round-title").textContent = round.level.name;
    byId("round-copy").textContent = round.level.copy;
    ui.hint.disabled = false;
    syncHint();
    updateLevels();
    updateHud();
    if (focus) field.focus({ preventScroll: true });
  }

  function syncHint() {
    ui.hint.setAttribute("aria-pressed", String(view.hint));
    ui.help.textContent = view.hint ? round.level.hint : "按住拖动来画线，松手后蜂群就会出发。";
  }

  function updateHud() {
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
    if (event === "puppy" || event === "terrain") {
      view.drawing = false;
      notify(event === "puppy" ? "墨线碰到小狗了，从它身边重新起笔。" : "沿着地形边缘画，墨线别穿过平台。");
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
      if (hasLine) notify("再画长一点，才能挡住蜜蜂。");
      return;
    }
    ui.notice.hidden = true;
    ui.hint.disabled = true;
    ui.help.textContent = "蜂群出发了，小心防线被撞歪！";
    announce(ui.help.textContent);
    audio.effect("start");
  }

  function showResult() {
    const won = round.phase === "win";
    const last = levelIndex === LEVELS.length - 1;
    if (won) {
      best[levelIndex] = Math.max(best[levelIndex], round.stars);
      try {
        localStorage.setItem(saveKey, JSON.stringify(best));
      } catch {
        // Play and unlock levels in memory when local storage is unavailable.
      }
      updateLevels();
    }
    audio.effect(won ? "win" : "loss");
    const used = Math.round(round.ink / round.level.ink * 100);
    byId("result-stars").textContent = won ? "★".repeat(round.stars) + "☆".repeat(3 - round.stars) : "☆ ☆ ☆";
    const title = won ? (last ? "全员安全！" : "小狗安全啦！") : "蜜蜂找到缺口了";
    byId("result-title").textContent = title;
    byId("result-copy").textContent = won
      ? "用了 " + used + "% 的墨水，拿到 " + round.stars + " 颗星。"
      : "撑了 " + round.elapsed.toFixed(1) + " 秒。试试让防线靠稳地形。";
    ui.retry.textContent = won ? "再画一笔" : "再试一次";
    ui.help.textContent = won ? (last ? "所有关卡已通过。" : "本关通过，可以继续闯关。") : "重画防线，再试一次。";
    ui.next.hidden = !won || last;
    ui.result.hidden = false;
    backgroundControls.forEach(element => { element.inert = true; });
    announce(title);
    (ui.next.hidden ? ui.retry : ui.next).focus({ preventScroll: true });
  }

  function coordinates(event) {
    const rect = field.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width * BOARD.width, 0, BOARD.width),
      y: clamp((event.clientY - rect.top) / rect.height * BOARD.height, 0, BOARD.height),
    };
  }

  field.addEventListener("pointerdown", event => {
    if (event.button !== 0 || pointer !== null || round.phase !== "ready") return;
    event.preventDefault();
    field.focus({ preventScroll: true });
    view.cursor = null;
    if (!beginStroke(coordinates(event))) return;
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
      view.cursor = { x: clamp(view.cursor.x + direction[0] * step, 0, BOARD.width),
        y: clamp(view.cursor.y + direction[1] * step, 0, BOARD.height) };
      if (view.drawing) addPoint(view.cursor);
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && (round.phase !== "ready" || view.drawing)) {
      event.preventDefault();
      newRound(true);
    }
    if (event.key === "Tab" && !ui.result.hidden) {
      const first = ui.retry;
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

  ui.hint.addEventListener("click", () => {
    view.hint = !view.hint;
    syncHint();
  });

  const retry = () => {
    audio.effect("reset");
    newRound(true);
  };
  ui.retry.addEventListener("click", retry);
  byId("restart").addEventListener("click", retry);
  ui.next.addEventListener("click", () => selectLevel(levelIndex + 1));
  byId("sound").addEventListener("click", () => {
    sound = audio.setEnabled(!sound);
    byId("sound").setAttribute("aria-pressed", String(sound));
    byId("sound").setAttribute("aria-label", sound ? "关闭声音" : "开启声音");
    byId("sound-wave").setAttribute("d", sound ? "M15 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" : "m15 10 5 5m0-5-5 5");
    byId("sound-label").textContent = sound ? "声音开启" : "声音关闭";
    if (sound) audio.effect("reset");
  });

  function resizeCanvas() {
    const scale = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(field.clientWidth * scale));
    const height = Math.max(1, Math.round(width * BOARD.height / BOARD.width));
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
      while (lag >= RULES.step && round.phase === "playing") {
        stepRound(round);
        lag -= RULES.step;
      }
      if (round.bounces !== bounces) audio.effect("bounce");
      if (round.phase !== "playing") showResult();
    }
    audio.tick();
    updateHud();
    paint(round, view);
    requestAnimationFrame(loop);
  }

  window.__omGame = {
    getState: () => ({
      phase: round.phase, level: levelIndex + 1, seconds: round.time, ink: round.ink, stars: round.stars,
      result: ["win", "loss"].includes(round.phase) ? round.phase : null, best: [...best],
      selfId: "local", players: { local: { connected: true, x: 0, z: 0 } },
    }),
    getStats: () => {
      const body = round.inkBody;
      return {
        entities: round.bees.length + round.level.dogs.length, tick: round.ticks, bounces: round.bounces,
        shield: body && { x: body.x, y: body.y, angle: body.angle, flex: body.flex },
      };
    },
    sendAction(action) {
      if (action?.type === "restart") return retry();
      if (action?.type !== "draw" || !Array.isArray(action.points) || action.points.length < 2 ||
          action.points.length > 512 || round.phase !== "ready" || view.drawing) return false;
      const points = action.points;
      if (!points.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y) &&
          point.x >= 0 && point.x <= BOARD.width && point.y >= 0 && point.y <= BOARD.height)) return false;
      if (!beginStroke(points[0])) return false;
      for (const point of points.slice(1)) {
        addPoint(point);
        if (!view.drawing) return false;
      }
      finishStroke();
      return round.phase === "playing";
    },
    runSelfTests: runEngineChecks,
  };

  newRound(false);
  resizeCanvas();
  new ResizeObserver(resizeCanvas).observe(field);
  requestAnimationFrame(loop);
})();
