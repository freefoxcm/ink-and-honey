"use strict";

function makeAudio() {
  let context;
  let mix;
  let enabled = false;
  let musicTime = 0;
  let musicIndex = 0;
  let nextHit = 0;
  const notes = [72, 76, null, 79, 76, null, 74, null, 71, 74, null, 77, 74, null, 72, null];
  const bass = [48, 50, 45, 43];

  function tone(midi, start, length, volume, type = "sine") {
    const osc = context.createOscillator();
    const envelope = context.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + .018);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
    osc.connect(envelope).connect(mix);
    osc.start(start);
    osc.stop(start + length + .025);
  }

  function setEnabled(value) {
    if (!value) {
      enabled = false;
      if (context) mix.gain.setTargetAtTime(0, context.currentTime, .025);
      return false;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    if (!context) {
      context = new Audio();
      mix = context.createGain();
      mix.gain.value = 0;
      mix.connect(context.destination);
    }
    context.resume().catch(() => {});
    mix.gain.setTargetAtTime(1, context.currentTime, .035);
    enabled = true;
    musicTime = context.currentTime + .03;
    musicIndex = 0;
    return true;
  }

  function tick() {
    if (!enabled || context.state !== "running" || document.hidden) return;
    const now = context.currentTime;
    if (musicTime < now - .1) musicTime = now + .03;
    while (musicTime < now + .17) {
      const index = musicIndex % notes.length;
      const note = notes[index];
      if (note) tone(note, musicTime, .31, .032, "triangle");
      if (index % 4 === 0) tone(bass[index / 4], musicTime, .66, .027);
      musicIndex++;
      musicTime += .37;
    }
  }

  function effect(name) {
    if (!enabled || context.state !== "running") return;
    const now = context.currentTime;
    if (name === "bounce") {
      if (now < nextHit) return;
      nextHit = now + .22;
      tone(50, now, .11, .041, "triangle");
      return;
    }
    const sequence = { start: [59, 66], win: [64, 67, 72, 76], loss: [64, 60, 55], reset: [66] }[name];
    sequence.forEach((note, index) => tone(note, now + index * .102, .24, .067, "triangle"));
  }

  return { setEnabled, tick, effect };
}
