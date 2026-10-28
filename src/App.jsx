import { useState } from "react";
import { investigate } from "./api/github.js";
import { parseRepoInput } from "./lib/parseInput.js";
import { ReportView } from "./components/Report.jsx";

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
    </div>
  );
}
