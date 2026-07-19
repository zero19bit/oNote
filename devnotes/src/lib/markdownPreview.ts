// Markdown preview helpers.
//
// Small additions on top of the existing `react-markdown` + `remark-gfm` +
// `rehype-raw` + `rehype-highlight` stack that improve the rendered
// output for the note preview/recall panes without changing anything
// in the editor, the save/load path, or the database layer.
//
//  - `preprocessMarkdown`     : strips YAML frontmatter and converts
//                                [[Wikilinks]] to clickable note links
//                                so the existing [[name]] convention
//                                that the editor's backlinks code has
//                                been parsing all along actually
//                                navigates somewhere in the preview.
//  - `rehypeHeadingIds`       : tiny rehype plugin that gives every
//                                heading a stable `id` so users can
//                                link to sections of a note.
//
// Everything is built on already-installed dependencies — no new
// packages, no schema changes, no editor refactor.

/* ------------------------------------------------------------------
 *  String-level pre-processing
 * ------------------------------------------------------------------ */

/**
 * Strip a leading YAML frontmatter block (`---\n…\n---\n`) and
 * convert `[[Note Title]]` occurrences to ordinary markdown links
 * whose URL uses the `note:` scheme. The custom `<a>` handler in
 * `MarkdownPreview` navigates `note:Name` URLs to the corresponding
 * note by case-insensitive title match, so this unlocks the wikilink
 * convention that the editor's backlinks code has been parsing all
 * along.
 *
 * Names are URL-encoded so titles containing spaces, parens or
 * non-ASCII characters still round-trip safely through the markdown
 * link parser. The `<a>` handler decodes them again before lookup.
 */
export function preprocessMarkdown(md: string): string {
  if (!md) return md;
  let out = md;
  // 1. Strip a leading YAML frontmatter block, if any.
  out = out.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  // 2. Convert [[Name]] → [Name](note:<encoded>).
  out = out.replace(/\[\[([^\]\n]+?)\]\]/g, (_m, name: string) => {
    const safe = String(name).trim();
    if (!safe) return _m;
    return `[${safe}](note:${encodeURIComponent(safe)})`;
  });
  return out;
}

/* ------------------------------------------------------------------
 *  Rehype plugin: heading ids
 * ------------------------------------------------------------------ */

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** Slugify a string for use as a heading anchor id. Conservative:
 *  lowercase ASCII alphanumerics and dashes, collapses runs of
 *  whitespace / punctuation. Empty result falls back to `heading-N`. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\u2000-\u206f\u2e00-\u2e7f]+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getNodeText(node: unknown): string {
  const n = node as { type?: string; value?: unknown; children?: unknown[] } | null;
  if (!n) return "";
  if (n.type === "text") return String(n.value ?? "");
  if (Array.isArray(n.children)) {
    return n.children.map((c) => getNodeText(c)).join("");
  }
  return "";
}

/**
 * Tiny rehype plugin that adds a stable `id` to every heading node
 * that doesn't already have one. We walk the tree by hand instead
 * of pulling in `unist-util-visit` directly (it's only a transitive
 * dep of react-markdown) — the node shapes are simple enough.
 *
 * IDs are de-duplicated by appending `-2`, `-3`, … if a slug has
 * already been used in the document.
 */
export function rehypeHeadingIds() {
  const used = new Set<string>();
  function walk(node: any): void {
    if (!node) return;
    if (
      node.type === "element" &&
      typeof node.tagName === "string" &&
      HEADING_TAGS.has(node.tagName)
    ) {
      const props = (node.properties ||= {});
      if (!props.id) {
        const text = getNodeText(node);
        let id = slugify(text);
        if (!id) id = `heading-${used.size + 1}`;
        let candidate = id;
        let i = 2;
        while (used.has(candidate)) {
          candidate = `${id}-${i++}`;
        }
        used.add(candidate);
        props.id = candidate;
      }
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c);
    }
  }
  return (tree: unknown) => walk(tree);
}
