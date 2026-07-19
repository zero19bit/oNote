import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import {
  Table,
  TableRow,
  TableCell,
  TableHeader,
} from "@tiptap/extension-table";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Markdown } from "tiptap-markdown";
import { common, createLowlight } from "lowlight";
import { useEffect, useImperativeHandle, forwardRef } from "react";
import { cn } from "@/lib/utils";

const lowlight = createLowlight(common);

/** Shape of the storage that `tiptap-markdown` adds to every editor
 *  instance. It's not exported by the package so we declare it locally
 *  to keep `getMarkdown` / `parse` strongly typed. */
interface MarkdownStorage {
  getMarkdown: () => string;
  parse: (md: string) => unknown;
}

function asMarkdownStorage(editor: Editor): MarkdownStorage | null {
  const storage = editor.storage as unknown as { markdown?: MarkdownStorage };
  return storage.markdown ?? null;
}

export interface RichTextEditorHandle {
  /** Returns the current document as markdown. */
  getMarkdown: () => string;
  /** Replaces the document with new markdown. */
  setMarkdown: (md: string) => void;
  /** Direct access to the underlying TipTap Editor. */
  editor: Editor | null;
}

interface RichTextEditorProps {
  initialMarkdown?: string;
  placeholder?: string;
  editable?: boolean;
  onChange?: (markdown: string) => void;
  className?: string;
  /** Called when the editor mounts and is ready to use. */
  onReady?: (editor: Editor) => void;
}

/**
 * The Notion-style rich text editor used by NoteEditor.
 *
 * Built on TipTap. All content is round-tripped through markdown via
 * `tiptap-markdown` so what you see in the WYSIWYG view is what gets
 * stored in the database. The handle exposes `getMarkdown` /
 * `setMarkdown` so the parent (NoteEditor) can wire it to the
 * autosave loop.
 */
export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    { initialMarkdown = "", placeholder, editable = true, onChange, className, onReady },
    ref
  ) {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false, // replaced with lowlight version below
        }),
        Markdown.configure({
          html: false, // we don't need raw HTML in the markdown source
          linkify: true,
          breaks: true, // Enter makes a hard break (closer to Apple Notes)
          transformPastedText: true,
          transformCopiedText: true,
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noreferrer", target: "_blank" },
        }),
        Placeholder.configure({
          placeholder:
            placeholder ?? "Start writing…  (Markdown shortcuts work: **, #, -, >, ```)",
        }),
        Highlight,
        Typography,
        Table.configure({ resizable: true, allowTableNodeSelection: true }),
        TableRow,
        TableCell,
        TableHeader,
        CodeBlockLowlight.configure({ lowlight }),
      ],
      content: "",
      editable,
      editorProps: {
        attributes: {
          class: cn("focus:outline-none min-h-full", className),
          spellcheck: "true",
        },
      },
      onUpdate: ({ editor: ed }) => {
        try {
          const md = asMarkdownStorage(ed)?.getMarkdown() ?? "";
          onChange?.(md);
        } catch {
          /* ignore */
        }
      },
    });

    // Seed the editor once it exists (separate from `content` so we can
    // go through the markdown round-trip instead of treating the source
    // as a raw HTML/string).
    useEffect(() => {
      if (!editor) return;
      if (!initialMarkdown) return;
      try {
        const parsed = asMarkdownStorage(editor)?.parse?.(initialMarkdown);
        editor.commands.setContent(parsed ?? initialMarkdown);
      } catch {
        editor.commands.setContent(initialMarkdown);
      }
      // Run only on mount; the parent component re-creates us when the
      // underlying note id changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    useEffect(() => {
      if (editor && onReady) onReady(editor);
    }, [editor, onReady]);

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (!editor) return "";
        try {
          return asMarkdownStorage(editor)?.getMarkdown() ?? "";
        } catch {
          return "";
        }
      },
      setMarkdown: (md: string) => {
        if (!editor) return;
        try {
          const parsed = asMarkdownStorage(editor)?.parse?.(md) ?? md;
          editor.commands.setContent(parsed);
        } catch {
          editor.commands.setContent(md);
        }
      },
      get editor() {
        return editor;
      },
    }));

    return (
      <div
        className={cn(
          "rich-text-editor relative h-full prose-devnotes",
          className
        )}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>
    );
  }
);
