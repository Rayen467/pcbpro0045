(() => {
  'use strict';
  if (window.PCBProTheme) return;

  const VERSION = '1.29.0';
  const KEY = 'sirkuitlab-theme-v129';
  const OPTIONS = Object.freeze(['light','dark','system']);
  const colors = { light:'#f5f7fa', dark:'#101720' };
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const valid = v => OPTIONS.includes(v);
  const stored = () => {
    try { return window.localStorage?.getItem(KEY); } catch (_) { return null; }
  };
  let mode = valid(stored()) ? stored() : 'light';
  const resolve = pref => pref === 'system' ? (media?.matches ? 'dark' : 'light') : pref;

  function apply() {
    const resolved = resolve(mode);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = mode;
    document.documentElement.style.colorScheme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', colors[resolved]);
    document.querySelectorAll('[data-sirkuitlab-theme-select]').forEach(input => {
      if (input.value !== mode) input.value = mode;
    });
    try {
      window.dispatchEvent(new CustomEvent('sirkuitlab:theme-change', {
        detail: { preference:mode, resolved }
      }));
    } catch (_) {}
    return resolved;
  }
  function setMode(next) {
    if (!valid(next)) throw new Error('Theme must be light, dark or system.');
    mode = next;
    try { window.localStorage?.setItem(KEY, mode); } catch (_) {
      // Private/restricted storage: in-memory preference still works for this tab.
    }
    return apply();
  }
  function onSystemChange() {
    if (mode === 'system') apply();
  }
  if (media?.addEventListener) media.addEventListener('change',onSystemChange);
  else if (media?.addListener) media.addListener(onSystemChange);
  window.addEventListener('storage',event => {
    if (event.key !== KEY) return;
    mode = valid(event.newValue) ? event.newValue : 'light';
    apply();
  });
  window.PCBProTheme = {
    version:VERSION, setMode, apply,
    getMode:()=>mode, getResolved:()=>resolve(mode), modes:OPTIONS
  };
  apply();
})();