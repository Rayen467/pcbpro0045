export const MAX_PROJECT_BYTES = 2 * 1024 * 1024;

/** Validate both legacy exports and current project files before replacing state.
 * @param {string} raw
 */
export function parseProject(raw) {
  if (new TextEncoder().encode(raw).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 2 MB limit.');
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.components) || data.components.length > 5000) throw new Error('Invalid component list.');
  const ids = new Set();
  const components = data.components.map((/** @type {any} */ part) => {
    if (!part || typeof part !== 'object') throw new Error('Invalid component.');
    for (const key of ['id', 'code', 'name', 'value', 'footprint']) {
      if (typeof part[key] !== 'string' || part[key].length > 256) throw new Error(`Invalid component ${key}.`);
    }
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(part.id) || ids.has(part.id)) throw new Error('Invalid or duplicate reference.');
    ids.add(part.id);
    for (const key of ['sx', 'sy', 'px', 'py']) {
      if (!Number.isFinite(part[key]) || part[key] < 0 || part[key] > 100) throw new Error(`Invalid position for ${part.id}.`);
    }
    if (!Number.isFinite(part.rot)) throw new Error(`Invalid rotation for ${part.id}.`);
    return { id: part.id, code: part.code, name: part.name, value: part.value, footprint: part.footprint,
      sx: part.sx, sy: part.sy, px: part.px, py: part.py, rot: ((part.rot % 360) + 360) % 360 };
  });
  return { components,
    leftWidth: Number.isFinite(data.leftWidth) ? Math.max(190, Math.min(430, data.leftWidth)) : 258,
    rightWidth: Number.isFinite(data.rightWidth) ? Math.max(220, Math.min(430, data.rightWidth)) : 282 };
}
