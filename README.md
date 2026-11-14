# MurlocGPT

An unofficial World of Warcraft-inspired chatbot. Ask it anything and it answers in randomized Murloc sounds. The chat runs entirely in your browser with plain HTML, CSS, and JavaScript.

## Run locally

Open `index.html` in a browser, or run `python3 -m http.server 8000` from this directory and visit `http://localhost:8000`.

Press Enter to send or Shift+Enter to add a line. The transcript lasts until you reload or leave the page. Theme defaults to System and follows changes to your device appearance. Light, Dark, and System choices are saved when local storage is available.

## Test

Run `node --test` with Node.js 20 or newer. To smoke-test in a browser, send a prompt and watch the thinking indicator give way to a Murloc reply. Use Tab to reach the conversation, theme selector, and composer. Change the theme and reload. In System mode, change your device appearance and confirm the page follows it.

## GitHub Pages

[Open MurlocGPT on GitHub Pages](https://aractor.github.io/murlocgpt/).

GitHub Pages publishes this site from the root of the `main` branch. Changes to `main` trigger a deployment. The site needs no build step.

World of Warcraft and its Murlocs belong to Blizzard Entertainment.
