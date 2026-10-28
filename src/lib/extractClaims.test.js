import assert from "node:assert/strict";
import test from "node:test";
import { extractClaims } from "./extractClaims.js";

test("reads an inspired-by link", () => {
  const claims = extractClaims(
    "nanobot is an ultra-lightweight personal AI assistant inspired by [Clawdbot](https://github.com/openclaw/openclaw)",
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0].kind, "inspired");
  assert.equal(claims[0].name, "Clawdbot");
  assert.equal(claims[0].url, "https://github.com/openclaw/openclaw");
});

test("reads an alternative from a repository description", () => {
  const claims = extractClaims("A lightweight alternative to OpenClaw that runs in containers for security.");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].kind, "alternative");
  assert.equal(claims[0].name, "OpenClaw");
  assert.equal(claims[0].url, null);
});

test("reads a comparison with every linked project", () => {
  const claims = extractClaims(
    "A high-level inventory of selected ZeroClaw capability sets, compared against [OpenClaw](https://github.com/openclaw/openclaw) and [Hermes](https://github.com/NousResearch/hermes-agent).",
  );
  assert.equal(claims.length, 2);
  assert.deepEqual(
    claims.map((claim) => claim.name),
    ["OpenClaw", "Hermes"],
  );
  assert.ok(claims.every((claim) => claim.kind === "comparison"));
});

test("reads an early implementation line", () => {
  const claims = extractClaims('"nanobot: Extremely Simple and Lightweight Clawdbot Implementation"');
  assert.equal(claims.length, 1);
  assert.equal(claims[0].kind, "implementation");
  assert.equal(claims[0].name, "Clawdbot");
});

test("keeps the project named in the relationship sentence", () => {
  const claims = extractClaims(
    "A lightweight alternative to OpenClaw that runs in containers for security. It runs on Anthropic's Agents SDK.",
  );
  assert.deepEqual(
    claims.map((claim) => claim.name),
    ["OpenClaw"],
  );
});

test("ignores a plain use of the word compare", () => {
  const claims = extractClaims("For the guided Unix installer, compare the installation paths.");
  assert.equal(claims.length, 0);
});

test("ignores relationship wording inside a code fence", () => {
  const claims = extractClaims("```\ninspired by OpenClaw\n```\n\nHello.");
  assert.equal(claims.length, 0);
});
