import assert from "node:assert/strict";
import test from "node:test";
import { layoutGraph } from "./layout.js";
import { buildReport } from "./report.js";

function bundle(overrides) {
  const repo = {
    fullName: "acme/widget",
    description: "",
    htmlUrl: "https://github.com/acme/widget",
    createdAt: "2026-02-01T00:00:00Z",
    pushedAt: "2026-10-01T00:00:00Z",
    stars: 3,
    forksCount: 1,
    openIssues: 0,
    language: "Python",
    license: "MIT",
    isFork: false,
    parent: null,
    source: null,
    template: null,
    defaultBranch: "main",
    readmePushedAt: "2026-10-01T00:00:00Z",
    ...overrides.repo,
  };
  return {
    hop: "query",
    error: null,
    repo,
    claims: overrides.claims || [],
    sources: overrides.sources || [{ label: "Current README", dateLabel: "2026-10-01T00:00:00Z", url: repo.htmlUrl }],
    earlyNote: null,
    extraNote: null,
    readmeError: null,
  };
}

test("a recorded fork is a solid line and is not treated as the start", () => {
  const report = buildReport(
    [
      bundle({
        repo: {
          fullName: "Maxmount/hkuds-nanobot",
          htmlUrl: "https://github.com/Maxmount/hkuds-nanobot",
          isFork: true,
          parent: "HKUDS/nanobot",
          source: "HKUDS/nanobot",
        },
      }),
    ],
    { queries: ["Maxmount/hkuds-nanobot"] },
  );
  assert.equal(report.verdict.headline, "GitHub records this as a fork.");
  assert.ok(report.edges.some((edge) => edge.style === "solid" && edge.from === "HKUDS/nanobot"));
  assert.equal(report.edges.some((edge) => edge.style === "dotted"), false);
});

test("a sentence in the files does not change the headline", () => {
  const report = buildReport(
    [
      bundle({
        repo: { fullName: "HKUDS/nanobot" },
        claims: [{ kind: "inspired", name: "Clawdbot", url: "https://github.com/openclaw/openclaw", quote: "inspired by Clawdbot" }],
      }),
    ],
    { queries: ["HKUDS/nanobot"] },
  );
  assert.equal(report.verdict.headline, "GitHub records this as the original.");
  assert.equal(report.edges.some((edge) => edge.style === "dotted"), false);
  assert.equal(report.nodes.some((node) => node.id === "openclaw/openclaw"), false);
});

test("no fork parent and no template is recorded as the original", () => {
  const report = buildReport([bundle({ repo: { fullName: "acme/widget" } })], {
    queries: ["acme/widget"],
  });
  assert.equal(report.verdict.headline, "GitHub records this as the original.");
  assert.match(report.verdict.detail, /fork field is false/);
  assert.match(report.verified.join(" "), /no template repository/);
  assert.equal(report.nodes.find((node) => node.id === "acme/widget").kicker, "Recorded original");
});

test("a template repository is an earlier GitHub record", () => {
  const report = buildReport(
    [
      bundle({
        repo: {
          fullName: "Break-Through-Tech/Microsoft-3B-github-repo-trust-signals",
          template: "Break-Through-Tech/Microsoft-3A-github-repo-trust-signals",
        },
        templateInfo: { htmlUrl: "https://github.com/Break-Through-Tech/Microsoft-3A-github-repo-trust-signals" },
      }),
    ],
    { queries: ["Break-Through-Tech/Microsoft-3B-github-repo-trust-signals"] },
  );
  assert.equal(report.verdict.headline, "GitHub records this as generated from a template.");
  assert.ok(
    report.edges.some(
      (edge) =>
        edge.style === "template" &&
        edge.from === "Break-Through-Tech/Microsoft-3A-github-repo-trust-signals" &&
        edge.to === "Break-Through-Tech/Microsoft-3B-github-repo-trust-signals",
    ),
  );
});

test("dotted arrows point from the reference toward the repository", () => {
  const laid = layoutGraph(
    [
      { id: "openclaw/openclaw", title: "openclaw/openclaw" },
      { id: "HKUDS/nanobot", title: "HKUDS/nanobot" },
    ],
    [{ from: "openclaw/openclaw", to: "HKUDS/nanobot", style: "dotted" }],
  );
  const reference = laid.nodes.find((node) => node.id === "openclaw/openclaw");
  const project = laid.nodes.find((node) => node.id === "HKUDS/nanobot");
  assert.ok(project.x > reference.x);
});
