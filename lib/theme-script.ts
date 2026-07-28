// Runs synchronously before paint so the correct theme applies immediately —
// avoids a flash of the wrong theme that a useEffect-based toggle would cause.
export const THEME_STORAGE_KEY = "subbie-theme";

export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;
