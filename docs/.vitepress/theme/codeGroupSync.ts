import { onContentUpdated } from 'vitepress';

/**
 * Synced + persisted `::: code-group` tabs for package managers.
 *
 * VitePress renders code groups per-instance with no shared state, while
 * vitepress-plugin-tabs' `key:` persistence cannot carry group-icons on the
 * tab buttons (it renders plain-text labels without `data-title`). So we keep
 * native code groups (icons via vitepress-plugin-group-icons) and add the
 * `sync` behavior other ecosystems ship built-in (Nuxt UI Pro, Docusaurus):
 * clicking a tab mirrors the selection onto every *other* package-manager
 * group on the page and stores it in localStorage so it survives reloads and
 * navigation.
 *
 * Must be called from a component's setup (uses `onContentUpdated`).
 */

const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun', 'deno']);
const STORAGE_KEY = 'vitepress:code-group-package-manager';

function groupInputs(group: HTMLElement): HTMLInputElement[] {
  return [...group.querySelectorAll<HTMLInputElement>('.tabs input')];
}

function labelFor(group: HTMLElement, input: HTMLInputElement): string {
  const label = [...group.querySelectorAll('label')].find((l) => l.htmlFor === input.id);
  return label?.textContent?.trim() ?? '';
}

function isPackageManagerGroup(group: HTMLElement): boolean {
  const inputs = groupInputs(group);
  return inputs.length > 1 && inputs.every((i) => PACKAGE_MANAGERS.has(labelFor(group, i)));
}

function pmGroups(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.vp-code-group')].filter(
    isPackageManagerGroup,
  );
}

function selectLabel(group: HTMLElement, label: string): void {
  const inputs = groupInputs(group);
  const i = inputs.findIndex((input) => labelFor(group, input) === label);
  const input = inputs[i];
  if (!input || input.checked) return;
  // Toggle state directly instead of `input.click()`: a real click event would
  // bubble to VitePress' own window listener (useCodeGroups), which calls
  // `label.scrollIntoView()` on every synced group — that is the scroll jump.
  // The click's focus step would also scroll to the visually-hidden radio.
  // Mirrors core's class toggling, minus both side effects.
  input.checked = true;
  const blocks = group.querySelector<HTMLElement>('.blocks');
  const current = blocks && [...blocks.children].find((c) => c.classList.contains('active'));
  const next = blocks?.children[i];
  if (current && next && current !== next) {
    current.classList.remove('active');
    next.classList.add('active');
  }
}

export function setupCodeGroupSync(): void {
  window.addEventListener('click', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !el.matches('.vp-code-group input')) return;
    const group = el.closest<HTMLElement>('.vp-code-group');
    if (!group || !isPackageManagerGroup(group)) return;
    const label = labelFor(group, el);
    if (!label) return;
    localStorage.setItem(STORAGE_KEY, label);
    for (const other of pmGroups()) {
      if (other !== group) selectLabel(other, label);
    }
  });

  onContentUpdated(() => {
    const label = localStorage.getItem(STORAGE_KEY);
    if (!label || !PACKAGE_MANAGERS.has(label)) return;
    for (const group of pmGroups()) selectLabel(group, label);
  });
}
