import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Italic,
  Strikethrough,
  Code as CodeIcon,
  Link as LinkIcon,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Pilcrow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NoteFloatingToolbarProps {
  editor: Editor | null;
}

interface TBtnProps {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}

function TBtn({ active, onClick, title, children, disabled }: TBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded text-fg-muted hover:bg-bg-elevated hover:text-fg",
        "disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed",
        active && "bg-accent/20 text-accent hover:bg-accent/30"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5" />;
}

/**
 * Floating toolbar that appears above any non-empty text selection in
 * the editor. Wraps TipTap's `<BubbleMenu>` so positioning is handled
 * by the library. Hidden when the selection collapses to a caret or
 * the editor is in read-only mode.
 */
export function NoteFloatingToolbar({ editor }: NoteFloatingToolbarProps) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor: ed, from, to }) => {
        if (ed.isFocused && from !== to) return true;
        return false;
      }}
      className="surface-elevated shadow-card flex items-center gap-0.5 p-1 rounded-lg"
    >
      <TBtn
        title="Bold (⌘B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={13} />
      </TBtn>
      <TBtn
        title="Italic (⌘I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={13} />
      </TBtn>
      <TBtn
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={13} />
      </TBtn>
      <TBtn
        title="Inline code (⌘E)"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon size={13} />
      </TBtn>
      <TBtn
        title="Highlight"
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter size={13} />
      </TBtn>
      <TBtn
        title="Link (⌘K)"
        active={editor.isActive("link")}
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
      >
        <LinkIcon size={13} />
      </TBtn>

      <Divider />

      <TBtn
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={13} />
      </TBtn>
      <TBtn
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={13} />
      </TBtn>
      <TBtn
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={13} />
      </TBtn>
      <TBtn
        title="Paragraph"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow size={13} />
      </TBtn>

      <Divider />

      <TBtn
        title="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={13} />
      </TBtn>
      <TBtn
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={13} />
      </TBtn>
      <TBtn
        title="Task list"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks size={13} />
      </TBtn>
      <TBtn
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={13} />
      </TBtn>
      <TBtn
        title="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 size={13} />
      </TBtn>
    </BubbleMenu>
  );
}

// Re-export for the index file.
export type { LucideIcon };
