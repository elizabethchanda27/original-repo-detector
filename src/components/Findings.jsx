const PLACEHOLDERS = [1, 2, 3, 4];

export function Findings() {
  return (
    <section className="findings" aria-label="Team findings">
      <div className="findings-head">
        <p className="eyebrow">Team findings</p>
        <h2>Research behind the tool</h2>
        <p>What was the team able to find to support this tool? Here is our research.</p>
      </div>
      <ul className="chart-list">
        {PLACEHOLDERS.map((number) => (
          <li key={number} className="chart-card">
            <h3>Placeholder {number}</h3>
            <div className="chart-slot" aria-hidden="true">
              <span className="chart-bars">
                <span />
                <span />
                <span />
                <span />
                <span />
              </span>
              <span className="chart-label">Chart</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
