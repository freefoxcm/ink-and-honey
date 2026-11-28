"use strict";

(() => {
  const byId = id => document.getElementById(id);
  const field = byId("field");
  const paint = makePainter(field);
  const audio = makeAudio();
  const saveKey = "ink-and-honey-progress-v2";
  const oldSaveKey = "ink-and-honey-progress-v1";
  const stingMessage = "哎呀，小熊被蛰到了！";
  const stingRevealSeconds = 1.05;
  const previewSaveKey = "ink-and-honey-jungle-preview-v1";
  const lockIcon = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="5" width="7" height="5.5" rx="1"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5"/></svg>';
  const backgroundControls = [document.querySelector(".masthead"), document.querySelector(".intro"), document.querySelector(".stage-bar"), document.querySelector(".side"), field];
  const ui = {
    result: byId("result"), next: byId("result-next"), retry: byId("result-retry"),
    timer: byId("timer-label"), ink: byId("ink-label"), fill: byId("ink-fill"),
    meter: byId("ink-meter"), rounds: byId("rounds"), hint: byId("hint"), notice: byId("notice"),
    announce: byId("announcement"), help: byId("round-help"), groups: byId("groups"),
    groupLock: byId("group-lock"), wind: byId("wind-indicator"), windArrow: byId("wind-arrow"),
    waves: byId("waves"),
  };
  const adventure = { id: "adventure", key: saveKey, levels: CAMPAIGN_LEVELS, chapters: CAMPAIGN_CHAPTERS, best: readProgress(saveKey) };
  const preview = {
    id: "preview", key: previewSaveKey, levels: JUNGLE_PREVIEW,
    chapters: CAMPAIGN_CHAPTERS.filter(chapter => chapter.id === "jungle"), best: readProgress(previewSaveKey),
  };
  let mode = adventure;
  let levelIndex;
  let browseChapter;
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
  let groupButtons = [];
  let nodes = [];
  const view = { age: 0, hint: 0, drawing: false, cursor: null, stingAge: null };

  function startMode(selected, focus) {
    mode = selected;
    levelIndex = Math.max(0, mode.levels.findIndex(level => !mode.best[level.id]));
    browseChapter = mode.levels[levelIndex].chapterId;
    byId("adventure-mode").setAttribute("aria-pressed", String(mode === adventure));
    byId("preview-mode").setAttribute("aria-pressed", String(mode === preview));
    groupButtons = mode.chapters.map(chapter => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "group-button";
      button.dataset.chapter = chapter.id;
      button.textContent = chapter.name;
      button.addEventListener("click", () => {
        browseChapter = chapter.id;
        updateLevels();
      });
      return button;
    });
    ui.groups.replaceChildren(...groupButtons);
    ui.groups.hidden = mode === preview;
    ui.rounds.setAttribute("aria-label", mode === preview ? "丛林试玩关卡" : "选择关卡");
    nodes = mode.levels.map((level, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = level.challenge ? "round challenge" : "round";
      button.dataset.levelId = level.id;
      button.addEventListener("click", () => selectLevel(index));
      return button;
    });
    ui.rounds.replaceChildren(...nodes);
    newRound(focus);
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
      localStorage.setItem(mode.key, JSON.stringify(mode.best));
    } catch {
      // Keep playing with the in-memory progress when storage is unavailable.
    }
  }

  function unlocked(index) {
    return mode.levels.slice(0, index).every(level => mode.best[level.id] > 0);
  }

  function selectLevel(index) {
    if (!mode.levels[index] || !unlocked(index)) return;
    levelIndex = index;
    browseChapter = mode.levels[index].chapterId;
    newRound(true);
    field.scrollIntoView({ block: "nearest" });
  }

  function updateLevels() {
    groupButtons.forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.chapter === browseChapter));
    });
    nodes.forEach((button, index) => {
      const level = mode.levels[index];
      button.hidden = level.chapterId !== browseChapter;
      button.disabled = !unlocked(index);
      if (index === levelIndex) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      const stars = mode.best[level.id] ?? 0;
      const status = button.disabled ? (stars ? "未解锁，已保留 " + stars + " 颗星" : "未解锁") :
        stars ? "已获得 " + stars + " 颗星" : "未通过";
      button.setAttribute("aria-label", "第 " + level.chapterLevel + " 关，" + level.name +
        (level.challenge ? "，挑战关，" : "，") + status);
      const number = String(level.chapterLevel).padStart(2, "0");
      const label = level.challenge ? number + " · 挑战关" : number;
      button.innerHTML = "<span>" + label + "</span>" +
        (button.disabled && !stars ? lockIcon : '<small aria-hidden="true">' + "★".repeat(stars) + "</small>");
    });
    const first = mode.levels.findIndex(level => level.chapterId === browseChapter);
    ui.groupLock.hidden = first <= 0 || unlocked(first);
    if (!ui.groupLock.hidden) {
      const previous = mode.chapters.find(chapter => chapter.id === mode.levels[first - 1].chapterId);
      ui.groupLock.textContent = "通过「" + previous.name + "」的挑战关后解锁";
    }
    const stars = mode.best[round.level.id];
    byId("best").textContent = stars ? "本关最佳 " + stars + " / 3 星" : "本关尚未获得星星";
    byId("overall").textContent = (mode === preview ? "试玩 " : "已通过 ") +
      mode.levels.filter(level => mode.best[level.id]).length + " / " + mode.levels.length;
  }

  function closeResult() {
    ui.result.hidden = true;
    backgroundControls.forEach(element => { element.inert = false; });
  }

  function newRound(focus) {
    pointer = null;
    view.hint = 0;
    view.drawing = false;
    view.cursor = null;
    view.stingAge = null;
    lag = 0;
    round = makeRound(mode.levels[levelIndex]);
    showWaves();
    closeResult();
    ui.notice.hidden = true;
    clearTimeout(noticeTimer);
    const chapter = mode.chapters.find(entry => entry.id === round.level.chapterId);
    byId("round-number").textContent = chapter.name + " · 第 " + round.level.chapterLevel + " 关";
    byId("round-theme").textContent = round.level.theme;
    byId("round-title").textContent = round.level.name;
    byId("round-copy").textContent = round.level.copy;
    byId("guide-draw").textContent = round.rescue ? "画一条能借地形撑住的线" : "一笔画出防线";
    byId("guide-release").textContent = round.level.rescue ? "松手，让墨线接住小熊" : "松手，让防线落稳";
    ui.hint.disabled = false;
    ui.wind.hidden = !round.level.wind;
    syncHint();
    updateLevels();
    updateHud();
    if (focus) field.focus({ preventScroll: true });
  }

  function syncHint() {
    ui.hint.setAttribute("aria-pressed", String(view.hint > 0));
    ui.hint.querySelector("span").textContent = ["提示", "看路线", "隐藏"][view.hint];
    const readyHelp = round.level.rescue?.releaseAt ? "在脚印尽头的下方画好吊床，松手让小熊出发。" :
      round.rescue ? "借地形撑住墨线，再把线画到小熊下方。" : "按住拖动来画线，松手后蜂群就会出发。";
    ui.help.textContent = view.hint ? round.level.hint : readyHelp;
  }

  function showWaves() {
    activeWave = -1;
    waveNodes = round.waves.map((wave, index) => {
      const node = document.createElement("li");
      const number = document.createElement("strong");
      number.textContent = (index + 1) + "波";
      const locations = new Set(wave.launches.map(({ hiveIndex }) => {
        const { x, y } = round.level.hives[hiveIndex];
        return (x < 335 ? "左" : x > 565 ? "右" : "中") + (y >= 350 ? "下" : "");
      }));
      const directions = locations.size > 1 ? "多向" : [...locations][0];
      node.append(number, wave.at + "秒 · " + directions);
      if (wave.launches.some(launch => launch.heavy)) {
        const heavy = document.createElement("span");
        heavy.className = "wave-heavy";
        heavy.textContent = "重蜂";
        node.append(heavy);
        node.setAttribute("aria-label", node.textContent);
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
        ui.wind.setAttribute("aria-label", reversing ? "本关风向会反转" :
          direction === "→" ? "风向右吹" : direction === "←" ? "风向左吹" : "风暂时减弱");
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
    ui.hint.disabled = true;
    ui.help.textContent = round.level.rescue?.releaseAt ? "小熊正沿脚印走向断口。" :
      round.rescue ? "接住小熊，守到倒计时归零。" : "蜂群出发了，小心防线被撞歪！";
    announce(ui.help.textContent);
    audio.effect("start");
  }

  function showResult() {
    const won = round.phase === "win";
    if (won) {
      mode.best[round.level.id] = Math.max(mode.best[round.level.id] ?? 0, round.stars);
      saveProgress();
      updateLevels();
    }
    const rescue = Boolean(round.level.rescue);
    nextLevel = won && mode.levels[levelIndex + 1] && unlocked(levelIndex + 1) ? levelIndex + 1 : -1;
    const finished = won && nextLevel === -1;
    if (round.failure !== "bees") audio.effect(won ? "win" : "loss");
    const used = Math.round(round.ink / round.level.ink * 100);
    byId("result-stars").textContent = won ? "★".repeat(round.stars) + "☆".repeat(3 - round.stars) : "☆ ☆ ☆";
    const rescueLoss = {
      water: ["小熊掉进水里了", "让墨线在支点上搭稳，给接小熊的部分留出水面余量。"],
      spikes: ["小熊碰到尖刺了", "在木桩上多搭一截，别让墨线滑进刺沟。"],
      lava: ["小熊碰到熔岩了", "借更高的岩沿撑住墨线，给上升的熔岩留出空间。"],
      bees: [stingMessage, "把靠蜂巢的一侧画高些，挡住追过来的蜜蜂。"],
      missed: ["吊床没接住小熊", "让线从小熊正下方经过。"],
    };
    const loss = rescueLoss[round.failure];
    const title = won ? (finished ? "全员安全！" : "小熊安全啦！") : rescue ? loss[0] : stingMessage;
    byId("result-title").textContent = title;
    byId("result-copy").textContent = won
      ? "用了 " + used + "% 的墨水，拿到 " + round.stars + " 颗星。"
      : "撑了 " + round.elapsed.toFixed(1) + " 秒。" + (rescue ? loss[1] : "试试让防线靠稳地形。");
    ui.retry.textContent = won ? "再画一笔" : "再试一次";
    ui.help.textContent = won ? (finished ? (mode === preview ? "丛林试玩五关已通过。" : "六个场景已全部通过。") : "本关通过，可以继续闯关。") : "重画防线，再试一次。";
    ui.next.hidden = nextLevel === -1;
    const nextGroup = mode.levels[nextLevel]?.chapterId;
    ui.next.textContent = nextLevel === levelIndex + 1
      ? (nextGroup === round.level.chapterId ? "下一关 →" : "下一章 →")
      : "继续闯关 →";
    ui.result.hidden = false;
    backgroundControls.forEach(element => { element.inert = true; });
    if (round.failure !== "bees") announce(title);
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
    view.hint = (view.hint + 1) % 3;
    syncHint();
  });

  const retry = () => {
    audio.effect("reset");
    newRound(true);
  };
  ui.retry.addEventListener("click", retry);
  byId("restart").addEventListener("click", retry);
  ui.next.addEventListener("click", () => selectLevel(nextLevel));
  byId("adventure-mode").addEventListener("click", () => { if (mode !== adventure) startMode(adventure, true); });
  byId("preview-mode").addEventListener("click", () => { if (mode !== preview) startMode(preview, true); });
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
      const wasReleased = round.rescue?.released;
      while (lag >= RULES.step && round.phase === "playing") {
        stepRound(round);
        lag -= RULES.step;
      }
      if (round.bounces !== bounces) audio.effect("bounce");
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
    requestAnimationFrame(loop);
  }

  window.__omGame = {
    getState: () => ({
      phase: round.phase, level: levelIndex + 1, seconds: round.time, ink: round.ink, stars: round.stars,
      levelId: round.level.id, group: round.level.groupIndex + 1,
      mode: mode.id, chapterId: round.level.chapterId, chapterLevel: round.level.chapterLevel,
      wave: activeWave + 1, waveTimes: round.waves.map(wave => wave.at),
      result: ["win", "loss"].includes(round.phase) ? round.phase : null, failure: round.failure,
      best: LEVELS.map(level => adventure.best[level.id] ?? 0),
      rescueBest: adventure.best[RESCUE_LEVELS[0].id] ?? 0,
      rescueProgress: RESCUE_LEVELS.map(level => adventure.best[level.id] ?? 0),
      campaignProgress: CAMPAIGN_LEVELS.map(level => adventure.best[level.id] ?? 0),
      previewProgress: JUNGLE_PREVIEW.map(level => preview.best[level.id] ?? 0),
      selfId: "local", players: { local: { connected: true, x: 0, z: 0 } },
    }),
    getStats: () => {
      const body = round.inkBody;
      return {
        entities: round.bees.length + round.dogs.length, tick: round.ticks, bounces: round.bounces,
        activeBees: round.bees.filter(bee => bee.delay <= round.elapsed).length,
        activeHeavyBees: round.bees.filter(bee => bee.heavy && bee.delay <= round.elapsed).length,
        dogs: round.dogs.map(({x, y}) => ({x, y})),
        platforms: round.platforms.map(({x, y}) => ({x, y})),
        shield: body && { x: body.x, y: body.y, angle: body.angle },
        hammock: round.rescue ? { supports: rescueSupports(round), caught: round.rescue.caught, released: round.rescue.released } : null,
        hazard: round.rescue ? { kind: round.level.rescue.hazard.kind, y: rescueHazardY(round) } : null,
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

  startMode(adventure, false);
  resizeCanvas();
  new ResizeObserver(resizeCanvas).observe(field);
  requestAnimationFrame(loop);
})();
