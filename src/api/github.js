import { formatDate } from "../lib/format.js";
import { buildReport } from "../lib/report.js";

const API = "https://api.github.com";
const bundleCache = new Map();

function headers(token, raw) {
  const result = {
    Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

async function request(url, { token, raw } = {}) {
  const response = await fetch(url, { headers: headers(token, raw) });
  const rate = {
    remaining: response.headers.get("x-ratelimit-remaining"),
    limit: response.headers.get("x-ratelimit-limit"),
  };
  if (response.status === 404) {
    return { ok: false, status: 404, rate };
  }
  if (!response.ok) {
    let message = `GitHub returned ${response.status}.`;
    try {
      const body = await response.json();
      if (body.message) message = body.message;
    } catch {
      // The error body was not JSON.
    }
    if (response.status === 403 && /rate limit/i.test(message)) {
      message = "GitHub's hourly limit was reached. A personal access token raises that limit.";
    }
    return { ok: false, status: response.status, message, rate };
  }
  const body = raw ? await response.text() : await response.json();
  return { ok: true, body, rate, link: response.headers.get("Link") };
}

function remember(rateBox, result) {
  if (result?.rate?.remaining != null) {
    rateBox.remaining = Number(result.rate.remaining);
    rateBox.limit = Number(result.rate.limit);
  }
}

function briefRepo(repo) {
  if (!repo?.full_name) return null;
  return {
    fullName: repo.full_name,
    description: repo.description || "",
    htmlUrl: repo.html_url,
    stars: repo.stargazers_count ?? null,
  };
}

function normalizeRepo(repo, readmePushedAt) {
  return {
    fullName: repo.full_name,
    description: repo.description || "",
    htmlUrl: repo.html_url,
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    stars: repo.stargazers_count ?? null,
    forksCount: repo.forks_count ?? null,
    openIssues: repo.open_issues_count ?? null,
    language: repo.language || "",
    license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : "",
    isFork: Boolean(repo.fork),
    parent: repo.parent?.full_name || null,
    source: repo.source?.full_name || null,
    template: repo.template_repository?.full_name || null,
    defaultBranch: repo.default_branch || "main",
    readmePushedAt: readmePushedAt || null,
  };
}

async function readmeCommits(fullName, token, { since, until, perPage = 20 } = {}) {
  const params = new URLSearchParams({ path: "README.md", per_page: String(perPage) });
  if (since) params.set("since", since);
  if (until) params.set("until", until);
  const result = await request(`${API}/repos/${fullName}/commits?${params}`, { token });
  if (!result.ok) return result;
  if (Array.isArray(result.body) && result.body.length) return result;
  params.set("path", "readme.md");
  return request(`${API}/repos/${fullName}/commits?${params}`, { token });
}

function commitDate(commit) {
  return commit.commit?.author?.date || commit.commit?.committer?.date || null;
}

function sourceList(repo, fetchedAt) {
  const items = [
    {
      label: "Repository record",
      dateLabel: fetchedAt,
      url: repo.htmlUrl,
    },
  ];
  if (repo.readmePushedAt) {
    items.push({
      label: "Current README",
      dateLabel: repo.readmePushedAt,
      url: `${repo.htmlUrl}/blob/${repo.defaultBranch}/README.md`,
    });
  }
  return items;
}

export async function fetchBundle(fullName, token, onRate) {
  const cacheKey = `${token ? "token" : "anon"}:${fullName.toLowerCase()}`;
  if (bundleCache.has(cacheKey)) return bundleCache.get(cacheKey);
  const task = loadBundle(fullName, token, onRate).catch((error) => {
    bundleCache.delete(cacheKey);
    throw error;
  });
  bundleCache.set(cacheKey, task);
  task.then((bundle) => {
    if (bundle?.error) bundleCache.delete(cacheKey);
  });
  return task;
}

async function loadBundle(fullName, token, onRate) {
  const rateBox = { remaining: null, limit: null };
  const fetchedAt = new Date().toISOString();
  const record = await request(`${API}/repos/${fullName}`, { token });
  remember(rateBox, record);
  onRate?.(rateBox);
  if (!record.ok) {
    return {
      fullName,
      hop: "query",
      error: record.status === 404 ? `${fullName} was not found on GitHub. It may be private or renamed.` : record.message,
      repo: null,
      claims: [],
      sources: [],
      fetchedAt,
      rate: rateBox,
    };
  }

  const latest = await readmeCommits(fullName, token, { perPage: 1 });
  remember(rateBox, latest);
  const readmePushedAt = latest.ok && latest.body[0] ? commitDate(latest.body[0]) : null;
  const repo = normalizeRepo(record.body, readmePushedAt);

  onRate?.(rateBox);
  return {
    fullName: repo.fullName,
    hop: "query",
    error: null,
    repo,
    parentInfo: briefRepo(record.body.parent),
    sourceInfo: briefRepo(record.body.source),
    templateInfo: briefRepo(record.body.template_repository),
    sources: sourceList(repo, fetchedAt),
    fetchedAt,
    rate: rateBox,
  };
}

export async function investigate(fullNames, { token, label, onProgress } = {}) {
  const loaded = new Map();
  const inflight = new Map();
  const rate = { remaining: null, limit: null };

  async function load(name, hop) {
    const key = name.toLowerCase();
    if (inflight.has(key)) return inflight.get(key);
    const task = (async () => {
      onProgress?.(`Reading ${name}`);
      const bundle = await fetchBundle(name, token, (next) => {
        if (next.remaining != null) {
          rate.remaining = next.remaining;
          rate.limit = next.limit;
        }
      });
      bundle.hop = hop;
      loaded.set(key, bundle);
      return bundle;
    })();
    inflight.set(key, task);
    return task;
  }

  for (const name of fullNames) {
    await load(name, "query");
  }

  const fetchedAt = new Date().toISOString();
  const report = buildReport([...loaded.values()].filter((bundle) => bundle.repo), {
    queries: [...loaded.values()].filter((bundle) => bundle.hop === "query" && bundle.repo).map((bundle) => bundle.repo.fullName),
    label,
    rate: rate.remaining == null ? null : rate,
    fetchedAt,
  });

  const failures = [...loaded.values()].filter((bundle) => bundle.error).map((bundle) => bundle.error);
  if (failures.length && !report.nodes.length) {
    const notFound = failures.some((failure) => /was not found/i.test(failure));
    report.verdict = {
      tone: "missing",
      headline: notFound ? "That repository was not found." : "That repository could not be read.",
      detail: failures[0],
    };
    report.notFound = true;
  }
  report.fetchedAtLabel = formatDate(fetchedAt);
  return report;
}
