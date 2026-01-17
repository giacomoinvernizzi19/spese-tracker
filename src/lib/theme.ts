// Theme manager for dark mode

export function initTheme(): void {
  // Check localStorage first, then system preference
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored ? stored === 'dark' : prefersDark;

  document.documentElement.classList.toggle('dark', isDark);
}

export function toggleTheme(): boolean {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  return isDark;
}

export function setTheme(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}

export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}
