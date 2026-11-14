"use strict";

function renderMurloc(reply, seed, sampleRate) {
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  }

  const words = reply.toLowerCase().match(/[a-z]+[.!?]?/g) || [];
  const phrases = words.map((word) => ({
    frames: Math.round(sampleRate * (0.17 + word.length * 0.014 + random() * 0.09)),
    gap: Math.round(sampleRate * (/[.!?]$/.test(word) ? 0.15 : 0.025 + random() * 0.035)),
    pitch: 145 + random() * 105,
    lifts: word.endsWith("?"),
    accent: word.endsWith("!") ? 1.25 : 1,
    pulse: 9 + random() * 8,
    phase: random() * 6.283,
  }));
  const audio = new Float32Array(phrases.reduce((sum, word) => sum + word.frames + word.gap, 0));
  let offset = 0;
  const cycle = 2 * Math.PI;

  for (const word of phrases) {
    let phase = 0;
    let breath = 0;
    const harmonics = new Float64Array(13);
    for (let i = 0; i < word.frames; i++) {
      const t = i / sampleRate;
      const progress = i / word.frames;
      const gulp = Math.sin(cycle * (word.pulse * t + 4 * t * t) + word.phase);
      const pitch = word.pitch * (0.78 + 0.47 * Math.sin(Math.PI * progress)
        + (word.lifts ? 0.58 : -0.12) * progress + 0.075 * gulp);
      phase += cycle * pitch / sampleRate;
      const openness = Math.sin(Math.PI * progress) ** 2;
      if (i % 16 === 0) {
        const throat = 375 + 360 * openness + 80 * gulp;
        const mouth = 980 + 650 * (1 - openness);
        for (let h = 1; h < harmonics.length; h++) {
          const frequency = h * pitch;
          harmonics[h] = (0.22 + 1.45 / (1 + ((frequency - throat) / 150) ** 2)
            + 0.65 / (1 + ((frequency - mouth) / 280) ** 2)) / h ** 1.35;
        }
      }

      let voiced = 0;
      for (let h = 1; h < harmonics.length; h++) {
        voiced += harmonics[h] * Math.sin(h * phase + (h % 2) * 0.8);
      }
      breath += 0.19 * (2 * random() - 1 - breath);
      const fade = Math.min(1, t / 0.035, (word.frames - i - 1) / (sampleRate * 0.065));
      const envelope = (0.5 - 0.5 * Math.cos(Math.PI * fade)) * (0.79 + 0.21 * gulp);
      audio[offset + i] = 0.55 * Math.tanh(envelope * word.accent
        * (voiced * 0.73 + breath * (0.3 + 0.35 * (1 - openness))));
    }
    offset += word.frames + word.gap;
  }
  return audio;
}

function createMurlocVoice(browser, toggle) {
  if (!browser.AudioContext) return null;

  const preference = "murlocgpt.sound";
  let enabled = false;
  let context;
  let active;
  let playbackId = 0;
  try {
    enabled = browser.localStorage.getItem(preference) === "on";
  } catch {
    // The toggle remains usable for this visit.
  }

  function stop() {
    playbackId++;
    if (active) {
      const { source, gain } = active;
      active = undefined;
      const now = context.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.015);
      source.stop(now + 0.015);
    }
  }

  function unlock() {
    try {
      context ??= new browser.AudioContext();
      return context.state === "running" ? Promise.resolve() : context.resume();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function play(reply, seed) {
    if (context?.state !== "running") return;
    stop();
    const samples = renderMurloc(reply, seed, 24000);
    if (!samples.length) return;

    const buffer = context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    const clip = { source, gain };
    active = clip;
    source.addEventListener("ended", () => {
      source.disconnect();
      gain.disconnect();
      if (active === clip) active = undefined;
    }, { once: true });
    source.start();
  }

  function updateToggle() {
    toggle.setAttribute("aria-pressed", String(enabled));
  }

  updateToggle();
  toggle.addEventListener("click", () => {
    enabled = !enabled;
    updateToggle();
    try {
      browser.localStorage.setItem(preference, enabled ? "on" : "off");
    } catch {
      // The in-memory preference still applies.
    }
    if (enabled) unlock().catch(() => {});
    else stop();
  });

  return {
    prepare() {
      if (enabled) unlock().catch(() => {});
    },
    autoplay(reply, seed) {
      if (enabled) play(reply, seed);
    },
    replay(reply, seed) {
      stop();
      const requested = playbackId;
      unlock().then(() => {
        if (requested === playbackId) play(reply, seed);
      }).catch(() => {});
    },
  };
}

if (typeof module !== "undefined") module.exports = { renderMurloc, createMurlocVoice };
