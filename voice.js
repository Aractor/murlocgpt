"use strict";

const sampleWindows = [[0, 12789], [12789, 9261], [22050, 15435], [37485, 10584], [48069, 17199], [65268, 14553], [79821, 12789], [92610, 11907]];

const syllablePatterns = {
  mrgl: [[0, 6], [1, 3]],
  mrrrgl: [[2, 6, 3], [7, 2, 5]],
  mrglglgl: [[0, 4, 5, 6], [1, 7, 3, 5]],
  grrrlgl: [[2, 3, 5], [7, 4, 6]],
  mrrglgl: [[0, 2, 5], [1, 4, 3]],
  awwwrrrglglgl: [[4, 7, 2, 5, 6], [4, 0, 7, 3, 5]],
  glrgl: [[1, 5], [3, 6]],
  wrrrgl: [[4, 2], [4, 7]],
  blrrgl: [[7, 3], [0, 7]],
  grglgl: [[1, 2, 5], [3, 7, 6]],
  mgrrrl: [[0, 3, 2], [0, 7, 3]],
};

function renderMurloc(reply, seed, sampleRate, sampleData) {
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  }
  const words = reply.toLowerCase().match(/[a-z]+[.!?]?/g) || [];
  const segments = [];
  const fadeFrames = Math.round(sampleRate * 0.025);
  let cursor = 0;
  let sentenceStart = 0;
  let sentenceEnd = -1;
  let sentenceRate = 1;
  for (const [wordIndex, word] of words.entries()) {
    if (wordIndex > sentenceEnd) {
      sentenceStart = wordIndex;
      sentenceEnd = wordIndex;
      while (sentenceEnd < words.length - 1 && !/[.!?]$/.test(words[sentenceEnd])) {
        sentenceEnd++;
      }
      sentenceRate = 0.98 + random() * 0.22;
    }

    const takes = syllablePatterns[word.replace(/[.!?]$/, "")] || [[0, 5]];
    const pattern = takes[Math.floor(random() * takes.length)];
    const progress = (wordIndex - sentenceStart) / Math.max(1, sentenceEnd - sentenceStart);
    const endsSentence = wordIndex === sentenceEnd;
    const rising = words[sentenceEnd].endsWith("?");
    const baseRate = sentenceRate + (rising ? 0.10 : -0.07) * progress;
    for (const [index, clip] of pattern.entries()) {
      const [offset, length] = sampleWindows[clip];
      const endsWord = index === pattern.length - 1;
      const inflection = endsWord && endsSentence ? (rising ? 0.22 : -0.13) : 0;
      const step = 44100 / sampleRate;
      const rate = baseRate + (random() - 0.5) * 0.16;
      const frames = Math.floor(length / (step * (rate + inflection * 0.5)));
      const gain = word.endsWith("!") ? 0.86 : 0.76 - 0.1 * progress;
      segments.push({ offset, length, frames, cursor, step, rate, inflection, gain });
      cursor += frames - fadeFrames;
    }
    cursor += endsSentence ? fadeFrames + Math.round(sampleRate * (0.13 + random() * 0.09)) : Math.round(fadeFrames * 0.55);
  }

  if (segments.length) {
    const last = segments.at(-1);
    cursor = Math.max(cursor, last.cursor + last.frames);
  }

  const audio = new Float32Array(cursor);
  for (const segment of segments) {
    let source = 0;
    for (let i = 0; i < segment.frames; i++) {
      const frame = Math.floor(source);
      if (frame + 1 >= segment.length) break;
      const left = sampleData[segment.offset + frame];
      const right = sampleData[segment.offset + frame + 1];
      const fade = Math.min(1, i / fadeFrames, (segment.frames - i - 1) / fadeFrames);
      audio[segment.cursor + i] += (left + (right - left) * (source - frame)) * segment.gain * fade;
      source += segment.step * (segment.rate + segment.inflection * i / segment.frames);
    }
  }
  return audio;
}

function createMurlocVoice(browser) {
  if (!browser.AudioContext) return null;

  let context;
  let active;
  let requestId = 0;
  let waitingPlayer;
  let samples;
  let loading;

  function loadLegacySamples() {
    return new Promise((resolve, reject) => {
      const script = browser.document.createElement("script");
      script.src = "./voice-samples.js";
      script.onload = () => {
        try {
          samples = browser.atob(browser.murlocSamples);
          delete browser.murlocSamples;
          resolve(samples);
        } catch (error) {
          reject(error);
        } finally {
          script.remove();
        }
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("Voice samples could not load"));
      };
      browser.document.head.append(script);
    });
  }

  function loadSamples() {
    if (samples) return Promise.resolve(samples);
    loading ??= (browser.location.protocol === "file:" ? loadLegacySamples() : browser.fetch("./voice-bank.flac")
      .then((response) => {
        if (!response.ok) throw new Error("Voice samples could not load");
        return response.arrayBuffer();
      })
      .then((data) => new browser.OfflineAudioContext(1, 1, 44100).decodeAudioData(data))
      .then((buffer) => {
        samples = buffer.getChannelData(0);
        return samples;
      }).catch(loadLegacySamples)).catch((error) => {
      loading = undefined;
      throw error;
    });
    return loading;
  }

  function stop(keepPosition) {
    if (!active) return;
    const { player, source, startedAt } = active;
    active = undefined;
    player.position = keepPosition
      ? Math.min(player.buffer.duration, player.position + context.currentTime - startedAt)
      : 0;
    player.update(player.completed && player.position === 0 ? "replay" : "play");
    source.stop();
    source.disconnect();
  }

  async function play(player) {
    const requested = ++requestId;
    waitingPlayer?.update("play");
    waitingPlayer = player;
    player.update("loading");
    try {
      context ??= new browser.AudioContext();
      const resume = context.state === "running" ? Promise.resolve() : context.resume();
      const [, data] = await Promise.all([resume, loadSamples()]);
      if (requested !== requestId) return;
      if (context.state !== "running") throw new Error("Audio is unavailable");

      stop(true);
      if (!player.buffer) {
        const samples = renderMurloc(player.reply, player.seed, 24000, data);
        if (!samples.length) throw new Error("Reply has no audio");
        player.buffer = context.createBuffer(1, samples.length, 24000);
        player.buffer.copyToChannel(samples, 0);
      }

      if (player.position >= player.buffer.duration) player.position = 0;
      const source = context.createBufferSource();
      source.buffer = player.buffer;
      source.connect(context.destination);
      const clip = { player, source, startedAt: context.currentTime };
      source.addEventListener("ended", () => {
        if (active !== clip) return;
        active = undefined;
        source.disconnect();
        player.position = 0;
        player.completed = true;
        player.update("replay");
      }, { once: true });
      try {
        source.start(0, player.position);
      } catch (error) {
        source.disconnect();
        throw error;
      }
      active = clip;
      player.update("pause");
    } catch {
      if (requested === requestId) player.update("error");
    } finally {
      if (requested === requestId) waitingPlayer = undefined;
    }
  }

  return {
    createPlayer(reply, seed, update) {
      const player = { reply, seed, update, position: 0, completed: false };
      return {
        toggle() {
          if (active?.player === player) {
            requestId++;
            waitingPlayer?.update("play");
            waitingPlayer = undefined;
            stop(true);
          } else {
            return play(player);
          }
        },
      };
    },
  };
}

if (typeof module !== "undefined") module.exports = { renderMurloc, createMurlocVoice };
