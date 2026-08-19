export function applyTheme(){const saved=localStorage.getItem('campus-theme')||'light';document.documentElement.dataset.theme=saved;return saved}
export function setTheme(t){localStorage.setItem('campus-theme',t);document.documentElement.dataset.theme=t}
