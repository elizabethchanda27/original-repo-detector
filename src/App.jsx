import { useState } from "react";
import { investigate } from "./api/github.js";
import { parseRepoInput } from "./lib/parseInput.js";
import { ReportView } from "./components/Report.jsx";
import { Findings } from "./components/Findings.jsx";

export default function App() {
  const [input, setInput] = useState("");
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem("ord-token") || "";
    } catch {
      return "";
    }
  });
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [view, setView] = useState("tool");

  async function run(fullName) {
    setStatus("loading");
    setError("");
    setProgress("Reading the repository on GitHub");
    const trimmedToken = token.trim();
    try {
      if (trimmedToken) sessionStorage.setItem("ord-token", trimmedToken);
      else sessionStorage.removeItem("ord-token");
    } catch {
      // The tab can still check public repositories if storage is blocked.
    }
    try {
      const next = await investigate([fullName], {
        token: trimmedToken || undefined,
        label: fullName,
        onProgress: setProgress,
      });
      setReport(next);
      setStatus("ready");
    } catch (err) {
      setStatus(report ? "ready" : "idle");
      setError(err?.message || "The request to GitHub failed.");
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    const parsed = parseRepoInput(input);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setInput(parsed.fullName);
    run(parsed.fullName);
  }

  return (
    <div className="page">
      <nav className="nav" aria-label="Sections">
        <div className="nav-links">
          <button type="button" aria-current={view === "tool" ? "page" : undefined} onClick={() => setView("tool")}>
            Detector
          </button>
          <button type="button" aria-current={view === "findings" ? "page" : undefined} onClick={() => setView("findings")}>
            Team findings
          </button>
        </div>
        <div className="team-mark" aria-label="Microsoft 3B team" title="Microsoft 3B">
          <span className="die">
            <span className="die-face die-front"><span>M</span>3B</span>
            <span className="die-face die-back" aria-hidden="true" />
            <span className="die-face die-right" aria-hidden="true"><i /><i /><i /></span>
            <span className="die-face die-left" aria-hidden="true" />
            <span className="die-face die-top" aria-hidden="true" />
            <span className="die-face die-bottom" aria-hidden="true" />
          </span>
        </div>
      </nav>

      {view === "findings" ? (
        <Findings />
      ) : (
      <>
      <header className="mast">
        <p className="wordmark">Original Repo Detector</p>
        <h1>Where does this repository sit?</h1>
        <div className="lede">
          <p>
            Paste <strong>owner/name</strong> or a github.com link, then press Check. This looks at GitHub’s public record and tells you whether that repository is the original, a fork, or a copy made from a template.
          </p>
          <ul>
            <li><strong>Original.</strong> GitHub does not record an earlier repository.</li>
            <li><strong>Fork.</strong> GitHub records the parent this was forked from.</li>
            <li><strong>Generated from a template.</strong> GitHub records the template it was made from.</li>
            <li><strong>Not found.</strong> That name is missing, private, or renamed.</li>
          </ul>
        </div>
      </header>

      <form className="finder" onSubmit={onSubmit}>
        <label htmlFor="repo">Repository</label>
        <div className="finder-row">
          <input
            id="repo"
            name="repo"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="owner/name or https://github.com/owner/name"
            autoComplete="off"
            spellCheck="false"
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Checking" : "Check"}
          </button>
        </div>
        <details className="token">
          <summary>GitHub token, optional</summary>
          <p>Public repositories work without one. A token raises the hourly limit and stays in this browser tab.</p>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="github_pat_…"
            autoComplete="off"
            aria-label="GitHub personal access token"
          />
        </details>
        {error ? <p className="form-error">{error}</p> : null}
        {status === "loading" ? <p className="progress">{progress}</p> : null}
      </form>

      {report ? <ReportView report={report} /> : null}
      </>
      )}
    </div>
  );
}
