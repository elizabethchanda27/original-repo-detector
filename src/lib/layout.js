function keyOf(id) {
  return String(id || "").toLowerCase();
}

function computeDepth(nodes, edges) {
  const preds = new Map(nodes.map((node) => [keyOf(node.id), []]));
  for (const edge of edges) {
    if (!preds.has(keyOf(edge.to))) preds.set(keyOf(edge.to), []);
    preds.get(keyOf(edge.to)).push(edge.from);
  }
  const memo = new Map();
  const stack = new Set();

  function depth(id) {
    const key = keyOf(id);
    if (memo.has(key)) return memo.get(key);
    if (stack.has(key)) return 0;
    stack.add(key);
    const parents = preds.get(key) || [];
    const value = parents.length ? Math.max(...parents.map((parent) => depth(parent))) + 1 : 0;
    stack.delete(key);
    memo.set(key, value);
    return value;
  }

  for (const node of nodes) depth(node.id);
  return memo;
}

function curve(from, to) {
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  if (to.x >= from.x) {
    const bend = Math.max(28, (x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2 - 2} ${y2}`;
  }
  const midY = Math.min(from.y, to.y) - 18;
  return `M ${x1 - from.w / 2} ${from.y} C ${x1 - from.w / 2} ${midY}, ${x2 + to.w / 2} ${midY}, ${x2 + to.w / 2} ${to.y}`;
}

export function layoutGraph(nodes, edges) {
  const cardW = 250;
  const cardH = 128;
  const gapX = 84;
  const gapY = 26;
  const pad = 28;
  const depth = computeDepth(nodes, edges);
  const columns = new Map();

  for (const node of nodes) {
    const layer = depth.get(keyOf(node.id)) || 0;
    if (!columns.has(layer)) columns.set(layer, []);
    columns.get(layer).push(node);
  }

  for (const list of columns.values()) {
    list.sort((a, b) => {
      const aOut = edges.some((edge) => keyOf(edge.from) === keyOf(a.id)) ? 0 : 1;
      const bOut = edges.some((edge) => keyOf(edge.from) === keyOf(b.id)) ? 0 : 1;
      if (aOut !== bOut) return aOut - bOut;
      return a.title.localeCompare(b.title);
    });
  }

  const layers = [...columns.keys()];
  const maxRows = Math.max(1, ...[...columns.values()].map((list) => list.length));
  const height = pad * 2 + maxRows * cardH + Math.max(0, maxRows - 1) * gapY;
  const width = pad * 2 + Math.max(1, layers.length) * cardW + Math.max(0, layers.length - 1) * gapX;
  const positioned = [];

  for (const layer of layers.sort((a, b) => a - b)) {
    const list = columns.get(layer);
    const colHeight = list.length * cardH + (list.length - 1) * gapY;
    const offsetY = (height - colHeight) / 2;
    list.forEach((node, index) => {
      positioned.push({
        ...node,
        x: pad + layer * (cardW + gapX),
        y: offsetY + index * (cardH + gapY),
        w: cardW,
        h: cardH,
      });
    });
  }

  const byId = new Map(positioned.map((node) => [keyOf(node.id), node]));
  const arrows = edges
    .map((edge) => {
      const from = byId.get(keyOf(edge.from));
      const to = byId.get(keyOf(edge.to));
      if (!from || !to) return null;
      return { style: edge.style, d: curve(from, to) };
    })
    .filter(Boolean);

  return { nodes: positioned, arrows, width, height };
}
