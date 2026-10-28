const STOP = new Set([
  "extremely",
  "simple",
  "lightweight",
  "ultra",
  "personal",
  "your",
  "their",
  "this",
  "that",
  "with",
  "from",
  "into",
  "implementation",
  "github",
  "http",
  "https",
  "assistant",
  "project",
  "software",
  "documentation",
  "early",
  "current",
  "alternative",
  "compared",
  "comparison",
  "inspired",
  "based",
  "derived",
  "fork",
  "forked",
  "port",
  "clone",
  "migration",
  "migrating",
  "linux",
  "unix",
  "python",
  "rust",
  "java",
  "golang",
  "harvard",
  "university",
  "mit",
  "apache",
  "the",
  "and",
  "for",
  "not",
  "are",
  "was",
  "were",
  "has",
  "have",
  "its",
  "minimal",
  "fast",
  "small",
  "open",
  "source",
  "bot",
  "framework",
  "tool",
  "tools",
  "feature",
  "features",
  "support",
  "status",
  "server",
  "client",
  "api",
  "sdk",
  "cli",
  "default",
  "custom",
  "internal",
  "public",
  "reference",
  "core",
  "base",
  "sample",
  "example",
  "test",
  "production",
  "full",
  "basic",
  "new",
  "initial",
  "app",
  "web",
]);

const STRONG_CUES = [
  { kind: "inspired", re: /\binspired by\b/i },
  { kind: "alternative", re: /\balternative to\b/i },
  { kind: "comparison", re: /\b(?:compared (?:with|to|against)|comparison (?:with|to|against)|compares (?:it |this )?(?:with|to|against))\b/i },
  { kind: "fork-claim", re: /\b(?:fork of|forked from)\b/i },
  { kind: "derived", re: /\b(?:based on|derived from|a port of|port of|clone of)\b/i },
  { kind: "migration", re: /\bmigrat(?:e|ing|ion) from\b/i },
];

function preprocess(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const name = label.replace(/<[^>]+>/g, "").trim();
      return `[${name}](${href})`;
    })
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`]/g, "");
}

function paragraphs(text) {
  const lines = preprocess(text).split(/\n/);
  const blocks = [];
  let buffer = [];
  let start = 0;

  const flush = (endLine) => {
    if (!buffer.length) return;
    blocks.push({ text: buffer.join(" ").replace(/\s+/g, " ").trim(), start });
    buffer = [];
    start = endLine;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flush(index + 1);
      return;
    }
    const ownLine = trimmed.startsWith("|") || trimmed.startsWith("#") || /^[-*]\s/.test(trimmed);
    if (ownLine) {
      flush(index);
      blocks.push({ text: trimmed.replace(/\s+/g, " "), start: index });
      start = index + 1;
      return;
    }
    if (!buffer.length) start = index;
    buffer.push(trimmed);
    if (buffer.join(" ").length > 500) flush(index + 1);
  });
  flush(lines.length);
  return blocks.filter((block) => block.text && !/^\|?\s*-{3,}/.test(block.text));
}

function cleanName(name) {
  return name.replace(/\s+/g, " ").trim();
}

function isStop(name) {
  return STOP.has(name.toLowerCase());
}

function targetsFromTail(tail) {
  const links = [...tail.matchAll(/\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g)];
  if (links.length) {
    return links
      .map((match) => ({ name: cleanName(match[1]), url: match[2] }))
      .filter((target) => target.name && !isStop(target.name));
  }

  const githubUrls = [...tail.matchAll(/https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g)];
  if (githubUrls.length) {
    return githubUrls.map((match) => ({
      name: `${match[1]}/${match[2].replace(/\.git$/, "")}`,
      url: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}`,
    }));
  }

  const words = [...tail.split(/[.!?]/)[0].matchAll(/\b[A-Z][A-Za-z0-9_.-]{2,}\b/g)]
    .map((match) => match[0])
    .filter((word) => !isStop(word));
  return words.map((name) => ({ name, url: null }));
}

function quoteFrom(text) {
  const withoutLinks = text.replace(/\[([^\]]+)]\([^)]+\)/g, "$1");
  const compact = withoutLinks.replace(/\s+/g, " ").trim();
  if (compact.length <= 280) return compact;
  return `${compact.slice(0, 277)}...`;
}

function claimsFromBlock(block) {
  const claims = [];

  for (const cue of STRONG_CUES) {
    const match = cue.re.exec(block.text);
    if (!match) continue;
    const tail = block.text.slice(match.index + match[0].length, match.index + match[0].length + 220);
    for (const target of targetsFromTail(tail)) {
      claims.push({
        kind: cue.kind,
        name: target.name,
        url: target.url,
        quote: quoteFrom(block.text),
      });
    }
  }

  if (block.start < 40) {
    const implementation = /\b([A-Z][A-Za-z0-9_.-]{2,})\s+implementation\b/gi;
    for (const match of block.text.matchAll(implementation)) {
      const name = match[1];
      if (isStop(name)) continue;
      claims.push({
        kind: "implementation",
        name,
        url: null,
        quote: quoteFrom(block.text),
      });
    }
  }

  return claims;
}

export function extractClaims(text) {
  const claims = [];
  for (const block of paragraphs(text)) {
    claims.push(...claimsFromBlock(block));
  }

  const unique = [];
  const seen = new Set();
  for (const claim of claims) {
    const key = `${claim.kind}|${claim.name.toLowerCase()}|${claim.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(claim);
  }
  return unique;
}

export function githubFullName(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)github\.com$/i.test(parsed.hostname)) return null;
    const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null;
    if (["topics", "orgs", "features", "settings", "marketplace"].includes(owner.toLowerCase())) {
      return null;
    }
    return `${owner}/${repo.replace(/\.git$/, "")}`;
  } catch {
    return null;
  }
}
