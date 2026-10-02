export const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
export const MAX_COMPONENTS = 5000;

const text = (value, key, max = 256) => {
  if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid component ${key}.`);
  return value;
};
const optionalText = (value, key, max = 512) => {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid component ${key}.`);
  return value;
};
const optionalStringArray = (value, key, maxItems = 32, maxLen = 128) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems || value.some((x) => typeof x !== 'string' || x.length > maxLen)) {
    throw new Error(`Invalid component ${key}.`);
  }
  return [...value];
};

/** Validate both legacy exports and current project files before replacing state.
 * @param {string} raw
 */
export function parseProject(raw) {
  if (new TextEncoder().encode(raw).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 2 MB limit.');
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.components) || data.components.length > MAX_COMPONENTS) throw new Error('Invalid component list.');

  const ids = new Set();
  const components = data.components.map((/** @type {any} */ part) => {
    if (!part || typeof part !== 'object') throw new Error('Invalid component.');

    const id = text(part.id, 'id');
    const code = text(part.code, 'code');
    const name = text(part.name, 'name');
    const value = text(part.value, 'value');
    const footprint = text(part.footprint, 'footprint');

    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id) || ids.has(id)) throw new Error('Invalid or duplicate reference.');
    ids.add(id);

    for (const key of ['sx', 'sy', 'px', 'py']) {
      if (!Number.isFinite(part[key]) || part[key] < 0 || part[key] > 100) throw new Error(`Invalid position for ${id}.`);
    }
    if (!Number.isFinite(part.rot)) throw new Error(`Invalid rotation for ${id}.`);

    let pinCount = null;
    if (part.pinCount != null) {
      if (!Number.isInteger(part.pinCount) || part.pinCount < 0 || part.pinCount > 10000) throw new Error(`Invalid component pinCount for ${id}.`);
      pinCount = part.pinCount;
    }

    return {
      id, code, name, value, footprint,
      catalogKey: optionalText(part.catalogKey, 'catalogKey'),
      group: optionalText(part.group, 'group'),
      pinCount,
      kind: optionalText(part.kind, 'kind'),
      manufacturer: optionalText(part.manufacturer, 'manufacturer'),
      mpn: optionalText(part.mpn, 'mpn'),
      tags: optionalStringArray(part.tags, 'tags'),
      description: optionalText(part.description, 'description', 2000),
      sx: part.sx, sy: part.sy, px: part.px, py: part.py,
      rot: ((part.rot % 360) + 360) % 360
    };
  });

  return {
    components,
    leftWidth: Number.isFinite(data.leftWidth) ? Math.max(190, Math.min(430, data.leftWidth)) : 258,
    rightWidth: Number.isFinite(data.rightWidth) ? Math.max(220, Math.min(430, data.rightWidth)) : 282
  };
}
