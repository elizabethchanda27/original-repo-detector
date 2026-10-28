import { layoutGraph } from "../lib/layout.js";

export function Graph({ nodes, edges }) {
  const layout = layoutGraph(nodes, edges);
  if (!layout.nodes.length) return null;

  return (
    <div className="graph-scroll" role="img" aria-label="Relationship map. Solid arrows are recorded forks. Dashed arrows are recorded templates.">
      <div className="graph" style={{ width: layout.width, height: layout.height }}>
        <svg width={layout.width} height={layout.height} aria-hidden="true">
          <defs>
            <marker id="arrow-solid" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1.2 L 8.5 5 L 0 8.8 z" fill="#4B9CD3" />
            </marker>
            <marker id="arrow-dotted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1.2 L 8.5 5 L 0 8.8 z" fill="#b57a1a" />
            </marker>
            <marker id="arrow-template" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1.2 L 8.5 5 L 0 8.8 z" fill="#13294B" />
            </marker>
          </defs>
          {layout.arrows.map((arrow, index) => (
            <path
              key={`${arrow.style}-${index}`}
              d={arrow.d}
              className={arrow.style === "solid" ? "arrow solid" : arrow.style === "template" ? "arrow template" : "arrow dotted"}
              markerEnd={arrow.style === "solid" ? "url(#arrow-solid)" : arrow.style === "template" ? "url(#arrow-template)" : "url(#arrow-dotted)"}
            />
          ))}
        </svg>
        {layout.nodes.map((node) => {
          const body = (
            <>
              <span className="kicker">{node.kicker}</span>
              <span className="node-title">{node.title}</span>
              <span className="node-sub">{node.subtitle}</span>
            </>
          );
          const className = node.queried ? "node queried" : "node";
          const style = { left: node.x, top: node.y, width: node.w, height: node.h };
          return node.htmlUrl ? (
            <a key={node.id} className={className} style={style} href={node.htmlUrl} target="_blank" rel="noreferrer">
              {body}
            </a>
          ) : (
            <div key={node.id} className={className} style={style}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
