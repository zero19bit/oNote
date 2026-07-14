import { useEffect, useState } from "react";
import { Inbox as InboxIcon, Trash2, Check, Sparkles, StickyNote, Code2, BookOpen, ArrowRight } from "lucide-react";
import {
  listInbox,
  addInbox,
  deleteInbox,
  processInbox,
  createNote,
  createSnippet,
  InboxItem,
} from "@/lib/api";
import { cn, relativeTime, todayString } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { useNavigate } from "react-router-dom";

export function Inbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [draft, setDraft] = useState("");
  const [showProcessed, setShowProcessed] = useState(false);
  const pushToast = useUI((s) => s.pushToast);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setItems(await listInbox(!showProcessed));
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to load", "error");
    }
  };

  useEffect(() => {
    load();
  }, [showProcessed]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("inbox:changed", handler);
    return () => window.removeEventListener("inbox:changed", handler);
  }, []);

  const submit = async () => {
    const v = draft.trim();
    if (!v) return;
    try {
      await addInbox(v);
      setDraft("");
      load();
      window.dispatchEvent(new CustomEvent("inbox:changed"));
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to add", "error");
    }
  };

  const sendToNote = async (item: InboxItem) => {
    const n = await createNote({
      title: item.content.split("\n")[0].slice(0, 60),
      content: `# ${todayString()}\n\n${item.content}\n`,
    });
    await processInbox(item.id);
    load();
    navigate(`/notes/${n.id}`);
  };

  const sendToSnippet = async (item: InboxItem) => {
    const firstLine = item.content.split("\n")[0].slice(0, 60);
    const rest = item.content.split("\n").slice(1).join("\n");
    await createSnippet({
      title: firstLine,
      description: "",
      language: "plaintext",
      code: rest || item.content,
      tags: [],
    });
    await processInbox(item.id);
    load();
    pushToast("Sent to snippets", "success");
    navigate("/snippets");
  };

  const sendToSkill = async (item: InboxItem) => {
    // Use the first line as the name; create a skill
    const { createSkill } = await import("@/lib/api");
    const firstLine = item.content.split("\n")[0].slice(0, 60);
    const s = await createSkill({
      name: firstLine,
      description: item.content,
    });
    await processInbox(item.id);
    load();
    navigate(`/skills/${s.id}`);
  };

  const remove = async (item: InboxItem) => {
    await deleteInbox(item.id);
    load();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 surface">
          <InboxIcon size={14} className="text-fg-muted" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            data-search-input
            placeholder="Dump a thought, link, code, idea..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button onClick={submit} className="btn-primary">
            Capture
          </button>
        </div>
        <button
          onClick={() => setShowProcessed((v) => !v)}
          className={cn("btn-outline", showProcessed && "text-accent border-accent/50")}
        >
          {showProcessed ? "Hide processed" : "Show processed"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="surface p-12 text-center">
          <InboxIcon size={32} className="text-fg-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">Inbox empty</h3>
          <p className="text-sm text-fg-muted">
            Use <span className="kbd">Ctrl+Shift+A</span> anywhere, or type above to capture.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="surface p-4 group">
              <p className="text-sm whitespace-pre-wrap mb-3">{item.content}</p>
              <div className="flex items-center justify-between text-[11px] text-fg-subtle">
                <span>{relativeTime(item.created_at)}</span>
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                  <span className="text-[10px] uppercase tracking-wider mr-1">Send to:</span>
                  <button
                    onClick={() => sendToNote(item)}
                    className="btn-ghost"
                    title="Make a note"
                  >
                    <StickyNote size={12} /> Note
                  </button>
                  <button
                    onClick={() => sendToSnippet(item)}
                    className="btn-ghost"
                    title="Make a snippet"
                  >
                    <Code2 size={12} /> Snippet
                  </button>
                  <button
                    onClick={() => sendToSkill(item)}
                    className="btn-ghost"
                    title="Make a skill"
                  >
                    <Sparkles size={12} /> Skill
                  </button>
                  <button
                    onClick={() => {
                      processInbox(item.id);
                      load();
                    }}
                    className="btn-ghost text-green-400"
                    title="Mark processed"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => remove(item)}
                    className="btn-ghost text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
