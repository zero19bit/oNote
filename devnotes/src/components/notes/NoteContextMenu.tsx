import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code as CodeIcon,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Highlighter,
  Code2,
  Pilcrow,
  Copy,
  Scissors,
  ClipboardPaste,
  type LucideIcon,
} from "lucide-react";
import { cn, cmdKey } from "@/lib/utils";
import { useUI } from "@/store/ui";

interface NoteContextMenuProps {
  editor: Editor | null;
  /** When true the component renders a portal at the end of <body>. */
  portal?: boolean;
}

interface MenuState {
  /** Where the user right-clicked, in viewport coordinates. */
  x: number;
  y: number;
  hasSelection: boolean;
  isInCode: boolean;
  isInList: boolean;
  isInOrderedList: boolean;
  isInTaskList: boolean;
  isInBlockquote: boolean;
  isInLink: boolean;
}

/** The menu width is fixed (so the position math is deterministic) and
 *  the body scrolls when there isn't enough room. The max-height is
 *  a fraction of the viewport so we never overflow on small windows. */
const MENU_WIDTH = 240;
const VIEWPORT_PADDING = 8;

/**
 * Right-click context menu for the rich-text editor.
 *
 * Mirrors the standard "select text → right-click → format" flow that
 * Notion / Word / Apple Notes use. Items are disabled (not hidden) when
 * they don't apply to the current selection so the user can see the full
 * surface at a glance.
 *
 * Sizing & positioning:
 *  - width is fixed (240px) so we can compute the on-screen position
 *    without measuring the DOM first
 *  - the menu grows downward from the cursor up to 60vh, then scrolls
 *    inside its own body so long lists never escape the viewport
 *  - if the cursor is too close to the right edge, the menu flips to
 *    the left of the cursor; same for the bottom edge
 *
 * Shortcut labels follow the active platform from the UI store, so
 * Mac users see ⌘ and Windows/Linux users see Ctrl.
 */
export function NoteContextMenu({ editor, portal = true }: NoteContextMenuProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const platform = useUI((s) => s.platform);
  const mod = cmdKey(platform); // "⌘" on Mac, "Ctrl" elsewhere

  // Keep the menu in sync with selection state so the disabled flags
  // are always accurate (e.g. when user changes selection while open).
  useEffect(() => {
    if (!editor || !menu) return;
    const update = () => {
      const sel = editor.state.selection;
      setMenu((prev) => (prev ? { ...prev, ...selectionInfo(editor, sel.empty) } : prev));
    };
    editor.on("selectionUpdate", update);
    editor.on("focus", update);
    editor.on("blur", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("focus", update);
      editor.off("blur", update);
    };
  }, [editor, menu]);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      if (!editor) return;
      const sel = editor.state.selection;
      // Only show our custom context menu when the user has actually
      // selected some text. Right-clicking on an empty caret should
      // let the browser's default menu through so spellcheck / OS
      // actions still work.
      if (sel.empty) return;
      e.preventDefault();
      setMenu({
        x: e.clientX,
        y: e.clientY,
        ...selectionInfo(editor, sel.empty),
      });
    },
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    const el = editor.options.element as HTMLElement;
    el.addEventListener("contextmenu", handleContextMenu);
    return () => el.removeEventListener("contextmenu", handleContextMenu);
  }, [editor, handleContextMenu]);

  // Close on any click or escape.
  useEffect(() => {
    if (!menu) return;
    const onClick = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // Compute the on-screen position. We keep the menu at a known width
  // and let the height grow up to 60vh, so this math is straightforward
  // and we don't have to wait for a measurement after the first paint.
  const [pos, setPos] = useState<{ x: number; y: number; maxH: number }>({
    x: 0,
    y: 0,
    maxH: 0,
  });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!menu) return;
    const maxH = Math.min(window.innerHeight - VIEWPORT_PADDING * 2, window.innerHeight * 0.6);
    const fitsRight = menu.x + MENU_WIDTH + VIEWPORT_PADDING <= window.innerWidth;
    const fitsBelow = menu.y + maxH + VIEWPORT_PADDING <= window.innerHeight;
    const x = fitsRight
      ? menu.x
      : Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING);
    // If we can't fit below the cursor, anchor to the bottom of the
    // viewport so the menu is always fully visible.
    const y = fitsBelow
      ? menu.y
      : Math.max(VIEWPORT_PADDING, window.innerHeight - maxH - VIEWPORT_PADDING);
    setPos({ x, y, maxH });
  }, [menu]);

  if (!editor || !menu) return null;

  const close = () => setMenu(null);

  const wrap = (cb: () => void) => () => {
    cb();
    close();
  };

  const sel = editor.state.selection;
  const empty = sel.empty;

  // Build a single Item helper. Shortcut labels are kept short so the
  // menu width stays predictable across platforms.
  const Item = (props: {
    icon: LucideIcon;
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={wrap(props.onClick)}
      disabled={props.disabled}
      className={cn(
        "w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded",
        "hover:bg-bg-elevated disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed",
        props.danger && "text-red-300"
      )}
    >
      <props.icon size={13} className="shrink-0" />
      <span className="flex-1 truncate">{props.label}</span>
      {props.shortcut && (
        <kbd className="kbd text-[10px] shrink-0">{props.shortcut}</kbd>
      )}
    </button>
  );

  const node = (() => {
    if (empty) return null;
    try {
      return editor.state.doc.nodeAt(sel.from);
    } catch {
      return null;
    }
  })();

  const content = (
    <div
      ref={menuRef}
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[100] surface-elevated shadow-card flex flex-col"
      style={{
        top: pos.y,
        left: pos.x,
        width: MENU_WIDTH,
        // Fallback for the first render before useLayoutEffect runs.
        // Hidden until we know the real coordinates so users never see
        // a flash at (0, 0).
        visibility: pos.maxH > 0 ? "visible" : "hidden",
        maxHeight: pos.maxH || undefined,
      }}
    >
      <div className="overflow-y-auto py-1">
        <Item
          icon={Copy}
          label="Copy"
          shortcut={`${mod}C`}
          onClick={() => document.execCommand("copy")}
          disabled={empty}
        />
        <Item
          icon={Scissors}
          label="Cut"
          shortcut={`${mod}X`}
          onClick={() => document.execCommand("cut")}
          disabled={empty}
        />
        <Item
          icon={ClipboardPaste}
          label="Paste"
          shortcut={`${mod}V`}
          onClick={() => document.execCommand("paste")}
        />

        <div className="my-1 border-t border-border" />

        <Item
          icon={Bold}
          label="Bold"
          shortcut={`${mod}B`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={empty}
        />
        <Item
          icon={Italic}
          label="Italic"
          shortcut={`${mod}I`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={empty}
        />
        <Item
          icon={Strikethrough}
          label="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={empty}
        />
        <Item
          icon={CodeIcon}
          label="Inline code"
          shortcut={`${mod}E`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={empty}
        />
        <Item
          icon={Highlighter}
          label="Highlight"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          disabled={empty}
        />

        <div className="my-1 border-t border-border" />

        <Item
          icon={LinkIcon}
          label={menu.isInLink ? "Edit link" : "Add link"}
          shortcut={`${mod}K`}
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL", prev ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
          disabled={empty}
        />

        <div className="my-1 border-t border-border" />

        <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-fg-subtle">
          Turn into
        </div>
        <Item
          icon={Pilcrow}
          label="Text"
          onClick={() => editor.chain().focus().setParagraph().run()}
          disabled={!node || menu.isInCode}
        />
        <Item
          icon={Heading1}
          label="Heading 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          disabled={empty}
        />
        <Item
          icon={Heading2}
          label="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={empty}
        />
        <Item
          icon={Heading3}
          label="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={empty}
        />
        <Item
          icon={List}
          label="Bulleted list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={empty}
        />
        <Item
          icon={ListOrdered}
          label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={empty}
        />
        <Item
          icon={ListChecks}
          label="Task list"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          disabled={empty}
        />
        <Item
          icon={Quote}
          label="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={empty}
        />
        <Item
          icon={Code2}
          label="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          disabled={empty}
        />
      </div>
    </div>
  );

  if (portal) {
    // Render into <body> so the menu can overflow any clipping container.
    // We use a simple inline approach: the fixed-positioned div still works
    // without a portal because position:fixed escapes all ancestors unless
    // a parent has `transform`/`filter`/`will-change` set. We avoid those
    // classes on the editor, so fixed positioning is sufficient.
    return content;
  }
  return content;
}

function selectionInfo(editor: Editor, empty: boolean) {
  return {
    hasSelection: !empty,
    isInCode: editor.isActive("code") || editor.isActive("codeBlock"),
    isInList:
      editor.isActive("bulletList") ||
      editor.isActive("orderedList") ||
      editor.isActive("taskList"),
    isInOrderedList: editor.isActive("orderedList"),
    isInTaskList: editor.isActive("taskList"),
    isInBlockquote: editor.isActive("blockquote"),
    isInLink: editor.isActive("link"),
  };
}
