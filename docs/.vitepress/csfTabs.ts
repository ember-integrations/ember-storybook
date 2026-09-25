import container from 'markdown-it-container';

const CSF_RE = /^csf\s+(\S.*)$/;

interface Token {
  nesting: number;
  info: string;
}

interface MarkdownItLike {
  utils: { escapeHtml(str: string): string };
  use(
    plugin: (md: unknown, name: string, options: unknown) => unknown,
    ...options: unknown[]
  ): unknown;
}

/**
 * `:::csf <filename>` — synced CSF-dialect tab group for a single file.
 *
 * Reuses the globally registered PluginTabs/PluginTabsTab components from
 * vitepress-plugin-tabs (the `== Label` block rule parses the panels), so the
 * selection sync (shared state key `syntax`) and localStorage persistence come
 * for free. Renders a Storybook-style filename bar between the tab strip and
 * the active panel.
 */
export function csfTabsPlugin(md: MarkdownItLike) {
  md.use(container, 'csf', {
    validate(params: string) {
      return CSF_RE.test(params.trim());
    },
    render(tokens: Token[], idx: number) {
      const token = tokens[idx];
      if (token.nesting === 1) {
        const filename = token.info.trim().match(CSF_RE)![1];
        const safe = md.utils.escapeHtml(filename);
        return [
          '<div class="csf-tabs">',
          '<PluginTabs sharedStateKey="syntax" variant="code">',
          `<div class="vp-code-block-title csf-file-bar"><div class="vp-code-block-title-bar"><span class="vp-code-block-title-text" data-title="${safe}">${safe}</span></div></div>`,
        ].join('\n');
      }
      return '</PluginTabs>\n</div>';
    },
  });
}
