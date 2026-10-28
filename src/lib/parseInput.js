export function parseRepoInput(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return { error: "Enter a GitHub repository." };
  }

  let path = text;
  if (/^https?:\/\//i.test(text)) {
    let url;
    try {
      url = new URL(text);
    } catch {
      return { error: "That link could not be read." };
    }
    if (!/(^|\.)github\.com$/i.test(url.hostname)) {
      return { error: "Use a github.com repository link." };
    }
    path = url.pathname;
  }

  path = path.replace(/^\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  const [owner, repo] = path.split("/").filter(Boolean);
  if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return { error: "Enter a repository as owner/name or a GitHub link." };
  }

  return { fullName: `${owner}/${repo}` };
}
