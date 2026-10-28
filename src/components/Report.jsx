import { Graph } from "./Graph.jsx";
import { formatDate } from "../lib/format.js";

function when(value) {
  if (!value) return "date not recorded";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
  return value;
}

function kindClass(kicker) {
  if (kicker === "Recorded fork" || kicker === "Fork parent" || kicker === "Recorded original") return "kind-fork";
  if (kicker === "Generated from template" || kicker === "Template") return "kind-template";
  if (kicker === "Documented relationship") return "kind-claim";
  if (kicker === "Reference project") return "kind-reference";
  return "kind-quiet";
}

export function ReportView({ report }) {
  const nodes = [...report.nodes].sort((a, b) => Number(b.queried) - Number(a.queried) || a.title.localeCompare(b.title));

  if (report.notFound || !nodes.length) {
    return (
      <div className="result">
        <section className={`verdict tone-${report.verdict.tone}`} aria-live="polite">
          <p className="eyebrow">What the records support</p>
          <h2>{report.verdict.headline}</h2>
          <p>{report.verdict.detail}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="result">
      <section className={`verdict tone-${report.verdict.tone}`} aria-live="polite">
        <p className="eyebrow">What the records support</p>
        <h2>{report.verdict.headline}</h2>
        <p>{report.verdict.detail}</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Relationships</h3>
          <p>A solid arrow is a fork GitHub records. A dashed arrow is a template GitHub records.</p>
        </div>
        <Graph nodes={report.nodes} edges={report.edges} />
        {nodes.length ? (
          <ul className="relations">
            {nodes.map((node) => (
              <li key={node.id} className={node.queried ? "relation queried" : "relation"}>
                <span className={`kind ${kindClass(node.kicker)}`}>{node.kicker}</span>
                <div>
                  {node.htmlUrl ? (
                    <a className="relation-name" href={node.htmlUrl} target="_blank" rel="noreferrer">
                      {node.title}
                    </a>
                  ) : (
                    <p className="relation-name">{node.title}</p>
                  )}
                  <p className="relation-detail">{node.subtitle}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet">No repository record was available.</p>
        )}
      </section>

      <div className="casefile">
        <section className="panel">
          <h3>Supporting evidence</h3>
          <div className="stack">
            <article>
              <h4>Activity</h4>
              {report.activity.length ? (
                report.activity.map((group) => (
                  <div key={group.repo} className="repo-block">
                    <p className="repo-name">{group.repo}</p>
                    <ul>
                      {group.lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="quiet">Activity was not available.</p>
              )}
            </article>
            <article>
              <h4>Sources and dates</h4>
              {report.sources.map((group) => (
                <div key={group.repo} className="repo-block">
                  <p className="repo-name">{group.repo}</p>
                  <ul>
                    {group.items.map((item) => (
                      <li key={`${item.label}-${item.url}`}>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noreferrer">
                            {item.label}
                          </a>
                        ) : (
                          item.label
                        )}
                        <span> · {when(item.dateLabel)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          </div>
        </section>

        <section className="panel">
          <h3>Verified facts</h3>
          <article className="review verified">
            <ul>
              {report.verified.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>
      </div>

      <p className="fetched">
        Read from the public GitHub API{report.fetchedAtLabel ? ` on ${report.fetchedAtLabel}` : ""}.
        {report.rate?.remaining != null ? ` ${report.rate.remaining} requests left in this hour.` : ""}
      </p>
    </div>
  );
}
