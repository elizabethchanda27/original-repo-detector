import assert from "node:assert/strict";
import test from "node:test";
import { parseRepoInput } from "./parseInput.js";

test("accepts owner/name", () => {
  assert.deepEqual(parseRepoInput(" HKUDS/nanobot "), { fullName: "HKUDS/nanobot" });
});

test("accepts a repository url and drops extra path", () => {
  assert.deepEqual(parseRepoInput("https://github.com/Maxmount/hkuds-nanobot/tree/main"), {
    fullName: "Maxmount/hkuds-nanobot",
  });
});

test("rejects a non-github host", () => {
  assert.equal(parseRepoInput("https://gitlab.com/a/b").error, "Use a github.com repository link.");
});
