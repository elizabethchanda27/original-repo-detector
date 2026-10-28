function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = String(value).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function keyOf(fullName) {
  return String(fullName || "").toLowerCase();
}

export function buildReport(bundles, options = {}) {
  const queries = options.queries || [];
  const queryKeys = new Set(queries.map(keyOf));
  const usable = bundles.filter((bundle) => bundle.repo);

  const edges = [];
  const edgeKeys = new Set();
  const addEdge = (edge) => {
    const key = `${keyOf(edge.from)}|${keyOf(edge.to)}|${edge.style}`;
    if (edgeKeys.has(key) || keyOf(edge.from) === keyOf(edge.to)) return;
    edgeKeys.add(key);
    edges.push(edge);
  };

  for (const bundle of usable) {
    const repo = bundle.repo;
    if (repo.isFork && repo.parent) {
      addEdge({
        from: repo.parent,
        to: repo.fullName,
        style: "solid",
      });
      if (repo.source && keyOf(repo.source) !== keyOf(repo.parent)) {
        addEdge({ from: repo.source, to: repo.parent, style: "solid" });
      }
    } else if (repo.template) {
      addEdge({
        from: repo.template,
        to: repo.fullName,
        style: "template",
      });
    }
  }

  const nodes = new Map();
  const ensure = (id, extra = {}) => {
    const key = keyOf(id);
    if (!nodes.has(key)) {
      nodes.set(key, {
        id,
        title: id.startsWith("name:") ? extra.title || id.slice(5) : id,
        htmlUrl: extra.htmlUrl || (id.startsWith("name:") ? null : `https://github.com/${id}`),
        owner: id.startsWith("name:") ? null : id.split("/")[0],
        queried: queryKeys.has(key),
        subtitle: "",
        kicker: "",
      });
    }
    const node = nodes.get(key);
    if (extra.htmlUrl && !node.htmlUrl) node.htmlUrl = extra.htmlUrl;
    if (extra.title && id.startsWith("name:")) node.title = extra.title;
    if (queryKeys.has(key)) node.queried = true;
    return node;
  };

  for (const bundle of usable) {
    ensure(bundle.repo.fullName, { htmlUrl: bundle.repo.htmlUrl });
    if (bundle.repo.parent) {
      ensure(bundle.repo.parent, { htmlUrl: bundle.parentInfo?.htmlUrl });
    }
    if (bundle.repo.source) {
      ensure(bundle.repo.source, { htmlUrl: bundle.sourceInfo?.htmlUrl });
    }
    if (bundle.repo.template) {
      ensure(bundle.repo.template, { htmlUrl: bundle.templateInfo?.htmlUrl });
    }
  }
  for (const edge of edges) {
    ensure(edge.from);
    ensure(edge.to);
  }

  for (const node of nodes.values()) {
    const bundle = usable.find((item) => keyOf(item.repo.fullName) === keyOf(node.id));
    const outgoingSolid = edges.some((edge) => keyOf(edge.from) === keyOf(node.id) && edge.style === "solid");
    const outgoingTemplate = edges.some((edge) => keyOf(edge.from) === keyOf(node.id) && edge.style === "template");
    if (bundle?.repo.isFork && bundle.repo.parent) {
      node.subtitle = `GitHub records a fork of ${bundle.repo.parent}`;
      node.kicker = "Recorded fork";
    } else if (bundle?.repo.template) {
      node.subtitle = `GitHub records this as generated from ${bundle.repo.template}`;
      node.kicker = "Generated from template";
    } else if (outgoingSolid) {
      node.subtitle = "GitHub records this as a fork parent";
      node.kicker = "Fork parent";
    } else if (outgoingTemplate) {
      node.subtitle = "GitHub records this as the template";
      node.kicker = "Template";
    } else {
      node.subtitle = "GitHub records no earlier repository";
      node.kicker = "Recorded original";
    }
  }

  const primary = usable.filter((bundle) => queryKeys.has(keyOf(bundle.repo.fullName)));
  const verdict = buildVerdict(primary);
  const activity = primary.map((bundle) => ({
    repo: bundle.repo.fullName,
    lines: activityLines(bundle.repo),
  }));
  const sources = usable
    .filter((bundle) => queryKeys.has(keyOf(bundle.repo.fullName)) || bundle.hop === "parent")
    .map((bundle) => ({
      repo: bundle.repo.fullName,
      items: bundle.sources || [],
    }));

  return {
    mode: queries.length > 1 ? "family" : "single",
    queried: queries,
    verdict,
    nodes: [...nodes.values()],
    edges,
    activity,
    sources,
    verified: verifiedFacts(usable, primary),
    rate: options.rate || null,
    fetchedAtLabel: options.fetchedAt ? formatDateSafe(options.fetchedAt) : null,
  };
}

function formatDateSafe(iso) {
  if (!iso) return "date not recorded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "date not recorded";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

function activityLines(repo) {
  return [
    `Created ${formatDateSafe(repo.createdAt)}.`,
    `Last push ${formatDateSafe(repo.pushedAt)}.`,
    `${formatCount(repo.stars)} stars, ${formatCount(repo.forksCount)} forks, ${formatCount(repo.openIssues)} open issues.`,
    [repo.language, repo.license].filter(Boolean).join(" · ") || "Language and license were not listed.",
    repo.description
      ? `Description: ${repo.description.length > 220 ? `${repo.description.slice(0, 217)}...` : repo.description}`
      : "GitHub returned no description.",
  ];
}

function formatCount(value) {
  if (value == null) return "an unknown number of";
  return Number(value).toLocaleString("en-US");
}

function buildVerdict(primary) {
  if (!primary.length) {
    return {
      tone: "missing",
      headline: "That repository could not be read.",
      detail: "GitHub did not return a repository record.",
    };
  }

  const bundle = primary[0];
  if (bundle.error && !bundle.repo) {
    return { tone: "missing", headline: "That repository could not be read.", detail: bundle.error };
  }
  if (bundle.repo.isFork && bundle.repo.parent) {
    const root = bundle.repo.source && keyOf(bundle.repo.source) !== keyOf(bundle.repo.parent)
      ? ` The recorded root of that line is ${bundle.repo.source}.`
      : "";
    return {
      tone: "fork",
      headline: "GitHub records this as a fork.",
      detail: `${bundle.repo.fullName} is a fork of ${bundle.repo.parent}.${root}`,
    };
  }
  if (bundle.repo.template) {
    return {
      tone: "template",
      headline: "GitHub records this as generated from a template.",
      detail: `${bundle.repo.fullName} was generated from ${bundle.repo.template}. The fork field is false. The template is the earlier repository on GitHub's record.`,
    };
  }
  return {
    tone: "original",
    headline: "GitHub records this as the original.",
    detail: "The fork field is false, and GitHub stores no template repository. Those are the public fields that name an earlier repository.",
  };
}

function verifiedFacts(usable, primary) {
  const facts = [];
  const focus = primary.length ? primary : usable;
  for (const bundle of focus) {
    const repo = bundle.repo;
    facts.push(`${repo.fullName} exists on GitHub. This was read from the repository record.`);
    facts.push(
      repo.isFork
        ? `GitHub's fork field is true. The parent is ${repo.parent}.`
        : "GitHub's fork field is false.",
    );
    facts.push(
      repo.template
        ? `GitHub's template field names ${repo.template}.`
        : "GitHub stores no template repository.",
    );
    facts.push(`The repository was created on ${formatDateSafe(repo.createdAt)} and last pushed on ${formatDateSafe(repo.pushedAt)}.`);
    if (repo.readmePushedAt) {
      facts.push(`The current README last changed on ${formatDateSafe(repo.readmePushedAt)}.`);
    }
  }
  return unique(facts);
}
