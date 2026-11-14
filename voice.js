"use strict";

function voiceSyllables(reply, seed) {
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  }

  return (reply.match(/[a-z]+[.!?]?/gi) || []).map((word) => ({
    duration: 0.09 + word.length * 0.011 + random() * 0.045,
    pitch: 90 + random() * 95,
    resonance: 480 + word.length * 27 + random() * 250,
    flutter: 19 + random() * 15,
    inflection: word.endsWith("?") ? 1.6 : word.endsWith("!") ? 0.7 : 0.85,
    pause: /[.!?]$/.test(word) ? 0.16 : 0.025,
  }));
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
      active.gain.disconnect();
      for (const source of active.sources) source.stop();
      active = undefined;
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
    const gain = context.createGain();
    gain.gain.value = 0.22;
    gain.connect(context.destination);
    const sources = [];
    const clip = { gain, sources };
    active = clip;
    let start = context.currentTime + 0.025;

    for (const syllable of voiceSyllables(reply, seed)) {
      const end = start + syllable.duration;
      const throat = context.createOscillator();
      const flutter = context.createOscillator();
      const depth = context.createGain();
      const mouth = context.createBiquadFilter();
      const envelope = context.createGain();

      throat.type = "sawtooth";
      throat.frequency.setValueAtTime(syllable.pitch, start);
      throat.frequency.exponentialRampToValueAtTime(syllable.pitch * syllable.inflection, end);
      flutter.frequency.value = syllable.flutter;
      depth.gain.value = 35;
      flutter.connect(depth).connect(throat.frequency);
      mouth.type = "bandpass";
      mouth.Q.value = 1.25;
      mouth.frequency.setValueAtTime(syllable.resonance, start);
      mouth.frequency.exponentialRampToValueAtTime(syllable.resonance * 0.65, end);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(0.75, start + 0.025);
      envelope.gain.linearRampToValueAtTime(0, end);
      throat.connect(mouth).connect(envelope).connect(gain);

      for (const source of [throat, flutter]) {
        sources.push(source);
        source.start(start);
        source.stop(end);
      }
      start = end + syllable.pause;
    }

    sources.at(-1)?.addEventListener("ended", () => {
      if (active === clip) {
        gain.disconnect();
        active = undefined;
      }
    }, { once: true });
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

if (typeof module !== "undefined") module.exports = { voiceSyllables, createMurlocVoice };
