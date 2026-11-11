// Su maurotracks.com: copia nell'addon il tema scelto sul sito (classe "dark" o "light" su <html>).
(() => {
  const root = document.documentElement;
  const save = () => {
    const theme = root.classList.contains("light") ? "light" : root.classList.contains("dark") ? "dark" : null;
    if (theme) chrome.storage.local.set({ theme });
  };
  save();
  new MutationObserver(save).observe(root, { attributes: true, attributeFilter: ["class"] });
})();
