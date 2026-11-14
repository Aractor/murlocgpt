const assert = require("node:assert/strict");
const { test } = require("node:test");
const { murlocReply } = require("../chat");

test("a low roll produces a one-word reply", () => {
  assert.equal(murlocReply(() => 0), "Mrgl.");
});

test("a high roll produces four seven-word sentences", () => {
  assert.equal(murlocReply(() => 0.999), Array(4).fill(
    "Mgrrrl mgrrrl mgrrrl mgrrrl mgrrrl mgrrrl mgrrrl?"
  ).join(" "));
});

test("replies use Murloc sounds and valid sentence punctuation", () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const reply = murlocReply();
    assert.match(reply, /^[A-Z][a-z]+(?: [a-z]+)*[.!?](?: [A-Z][a-z]+(?: [a-z]+)*[.!?]){0,3}$/);
    for (const word of reply.toLowerCase().match(/[a-z]+/g)) {
      assert.match(word, /^(mrgl|mrrrgl|mrglglgl|grrrlgl|mrrglgl|awwwrrrglglgl|glrgl|wrrrgl|blrrgl|grglgl|mgrrrl)$/);
    }
  }
});
