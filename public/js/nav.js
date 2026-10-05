// Path-based navigation (History API). Pages are real URLs so search engines can index them.
export function navigate(path, { replace = false } = {}) {
  if (path !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState'](null, '', path);
  window.dispatchEvent(new Event('fmq:navigate'));
}

// Update the address bar without re-rendering (a view that already shows this state).
export function setPath(path) {
  if (path !== location.pathname) history.replaceState(null, '', path);
}
