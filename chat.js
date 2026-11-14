"use strict";

const sounds = [
  "mrgl", "mrrrgl", "mrglglgl", "grrrlgl", "mrrglgl", "awwwrrrglglgl",
  "glrgl", "wrrrgl", "blrrgl", "grglgl", "mgrrrl",
];

function randomInt(min, max, random) {
  return min + Math.floor(random() * (max - min + 1));
}

function murlocReply(random = Math.random) {
  const sentenceCount = randomInt(1, 4, random);
  const sentences = [];
  for (let sentence = 0; sentence < sentenceCount; sentence++) {
    const wordCount = randomInt(1, 7, random);
    const words = [];
    for (let word = 0; word < wordCount; word++) {
      words.push(sounds[randomInt(0, sounds.length - 1, random)]);
    }
    const phrase = words.join(" ");
    const punctuation = [".", "!", "?"][randomInt(0, 2, random)];
    sentences.push(phrase[0].toUpperCase() + phrase.slice(1) + punctuation);
  }
  return sentences.join(" ");
}

function initChat(document, browser) {
  const theme = document.querySelector("#theme");
  const themeKey = "murlocgpt.theme";
  const modes = ["system", "light", "dark"];

  function applyTheme(value) {
    if (value === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = value;
    }
  }

  try {
    const stored = browser.localStorage.getItem(themeKey);
    if (modes.includes(stored)) theme.value = stored;
  } catch {
    // Theme changes still work with storage disabled.
  }
  applyTheme(theme.value);
  theme.addEventListener("change", () => {
    applyTheme(theme.value);
    try {
      browser.localStorage.setItem(themeKey, theme.value);
    } catch {
      // Keep the selected theme for this page visit.
    }
  });

  const history = document.querySelector("#history");
  const status = document.querySelector("#status");
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#message");
  const send = document.querySelector("#send");
  let pending = false;

  function appendMessage(author, message) {
    const row = document.createElement("div");
    row.className = author === "You" ? "message user" : "message";
    const label = document.createElement("strong");
    label.textContent = author;
    const body = document.createElement("p");
    body.textContent = message;
    row.append(label, body);
    history.append(row);
    history.scrollTop = history.scrollHeight;
  }

  appendMessage("MurlocGPT", "Mrglglgl!");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || pending) return;
    pending = true;
    appendMessage("You", message);
    input.value = "";
    status.textContent = "MurlockGPT is thinking...";
    send.setAttribute("aria-disabled", "true");
    input.focus({ preventScroll: true });

    browser.setTimeout(() => {
      status.textContent = "";
      appendMessage("MurlocGPT", murlocReply());
      pending = false;
      send.removeAttribute("aria-disabled");
    }, randomInt(650, 1350, Math.random));
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
}

if (typeof document !== "undefined") initChat(document, window);
if (typeof module !== "undefined") module.exports = { initChat, murlocReply };
