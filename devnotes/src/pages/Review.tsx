import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  StickyNote,
  BookOpen,
  Video,
  Globe,
  Headphones,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Tag as TagIcon,
  BrainCircuit,
  Search,
  X,
  CalendarDays,
  Hash,
  ExternalLink,
} from "lucide-react";
import {
  listSkills,
  getSkillLinkedItems,
  LinkedItem,
  Skill,
} from "@/lib/api";
import { useUI } from "@/store/ui";
import { cn, relativeTime } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Review — manual review flow
//
// Phase 1 (this file): pick a skill → see every note/resource linked to it
// (with last-review date + total review count) → tick the ones you want
// → Next.
//
// Phase 2 (in this file, below): walk through the selected items one at a
// time. Each item has a "Review Complete" button which records a row in
// `review_log` and moves to the next item. When the queue is empty you
// land on a completion screen.
//
// This is intentionally separate from the SM-2 spaced-repetition queue
// that the old `get_due_for_review` produced. That logic still exists in
// the backend (`commands/review.rs`) but is no longer surfaced in the UI.
// ─────────────────────────────────────────────────────────────────────────────

type Phase = "skills" | "items" | "session" | "done";

/** Stable key for an item: `kind:id`. Used as Set key and React key. */
const itemKey = (it: { kind: string; id: string }) => `${it.kind}:${it.id}`;

/** Icon for a resource sub-kind. */
const SubKindIcon = ({ k }: { k: string }) => {
  switch (k) {
    case "video":
      return <Video size={11} />;
    case "course":
      return <GraduationCap size={11} />;
    case "book":
      return <BookOpen size={11} />;
    case "podcast":
      return <Headphones size={11} />;
    case "website":
      return <Globe size={11} />;
    default:
      return <Globe size={11} />;
  }
};

/** Human label for a resource sub-kind. */
const SUB_KIND_LABEL: Record<string, string> = {
  video: "Video",
  course: "Course",
  book: "Book",
  podcast: "Podcast",
  website: "Website",
};

/** Status color helper. */
const STATUS_COLOR: Record<string, string> = {
  to_read: "text-fg-muted bg-bg-elevated",
  in_progress: "text-accent bg-accent/20",
  done: "text-green-300 bg-green-500/20",
  archived: "text-fg-subtle bg-bg-elevated",
};
const STATUS_LABEL: Record<string, string> = {
  to_read: "To read",
  in_progress: "In progress",
  done: "Done",
  archived: "Archived",
};

export function Review() {
  const [phase, setPhase] = useState<Phase>("skills");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillQ, setSkillQ] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [linked, setLinked] = useState<{ notes: LinkedItem[]; resources: LinkedItem[] }>({
    notes: [],
    resources: [],
  });
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [itemQ, setItemQ] = useState("");

  // Session state
  const [queue, setQueue] = useState<LinkedItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);

  const pushToast = useUI((s) => s.pushToast);

  // ── Load skills on mount ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setSkills(await listSkills());
      } catch (e: any) {
        pushToast(e?.message ?? "Failed to load skills", "error");
      }
    };
    load();
  }, [pushToast]);

  // ── When a skill is selected, load its linked items ────────────────────
  useEffect(() => {
    if (!selectedSkill) return;
    setLinkedLoading(true);
    setSelected(new Set());
    setItemQ("");
    getSkillLinkedItems(selectedSkill.id)
      .then((r) => setLinked(r))
      .catch((e: any) => pushToast(e?.message ?? "Failed to load items", "error"))
      .finally(() => setLinkedLoading(false));
  }, [selectedSkill, pushToast]);

  // ── Filtered skill list ────────────────────────────────────────────────
  const filteredSkills = useMemo(() => {
    if (!skillQ.trim()) return skills;
    const q = skillQ.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [skills, skillQ]);

  // ── Filtered item list (search across both notes and resources) ────────
  const filteredNotes = useMemo(() => {
    if (!itemQ.trim()) return linked.notes;
    const q = itemQ.toLowerCase();
    return linked.notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.preview.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [linked.notes, itemQ]);

  const filteredResources = useMemo(() => {
    if (!itemQ.trim()) return linked.resources;
    const q = itemQ.toLowerCase();
    return linked.resources.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.preview.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [linked.resources, itemQ]);

  // ── Toggle a single item in the selection set ───────────────────────────
  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>(selected);
    [...filteredNotes, ...filteredResources].forEach((it) => all.add(itemKey(it)));
    setSelected(all);
  };

  const selectNone = () => setSelected(new Set());

  // ── Start the review session ───────────────────────────────────────────
  const startSession = () => {
    // Build the session queue in the order: notes first, then resources,
    // honouring the user's selection. We re-read the un-filtered lists so
    // a user who hid something with the search box still gets it if they
    // already ticked it.
    const all = [...linked.notes, ...linked.resources];
    const ordered = all.filter((it) => selected.has(itemKey(it)));
    if (ordered.length === 0) return;
    setQueue(ordered);
    setCurrentIdx(0);
    setReviewedCount(0);
    setPhase("session");
  };

  // ── Mark current item reviewed and move to next ────────────────────────
  // Implemented in Phase 2.
  const markCurrentReviewed = async () => {
    if (currentIdx >= queue.length) return;
    const it = queue[currentIdx];
    try {
      const { submitReview } = await import("@/lib/api");
      // Quality 3 = "good" / "I saw it again". The point of this flow is
      // to record *that* it was reviewed, not to grade the recall. The
      // 0-5 grade is preserved so it still feeds the review_log counts
      // and the stats.
      await submitReview(it.kind, it.id, 3);
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to record review", "error");
      return;
    }
    const newCount = reviewedCount + 1;
    setReviewedCount(newCount);
    if (currentIdx + 1 >= queue.length) {
      setPhase("done");
    } else {
      setCurrentIdx(currentIdx + 1);
    }
    // Achievement re-check is fired on the completion screen so it
    // happens once per session, not once per item.
  };

  // ── Reset to a clean state ─────────────────────────────────────────────
  const resetToSkills = () => {
    setPhase("skills");
    setSelectedSkill(null);
    setLinked({ notes: [], resources: [] });
    setSelected(new Set());
    setQueue([]);
    setCurrentIdx(0);
    setReviewedCount(0);
  };

  // ─────────────────────────────────────────────────────────────────────
  // View 1: skills
  // ─────────────────────────────────────────────────────────────────────
  if (phase === "skills") {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit size={20} className="text-accent" />
            <h1 className="text-xl font-bold">Review</h1>
          </div>
          <p className="text-sm text-fg-muted">
            Pick a skill to review every note and resource linked to it.
          </p>
        </div>

        {/* Search */}
        {skills.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 surface mb-4">
            <Search size={14} className="text-fg-muted" />
            <input
              value={skillQ}
              onChange={(e) => setSkillQ(e.target.value)}
              placeholder="Search skills..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {skillQ && (
              <button
                onClick={() => setSkillQ("")}
                className="text-fg-muted hover:text-fg"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {skills.length === 0 ? (
          <div className="surface p-12 text-center">
            <Sparkles size={32} className="text-fg-muted mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">No skills yet</h3>
            <p className="text-sm text-fg-muted mb-4">
              Add a skill first, then link notes and resources to it. After
              that you can come back here to review them.
            </p>
            <a className="btn-primary inline-flex" href="/skills">
              <Sparkles size={14} /> Go to Skills
            </a>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="surface p-8 text-center text-fg-muted text-sm">
            No skills match "{skillQ}".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSkills.map((s) => (
              <SkillPickerCard
                key={s.id}
                skill={s}
                onPick={() => {
                  setSelectedSkill(s);
                  setPhase("items");
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // View 2: items (notes + resources for the selected skill)
  // ─────────────────────────────────────────────────────────────────────
  if (phase === "items" && selectedSkill) {
    const totalCount = linked.notes.length + linked.resources.length;
    const allFiltered = [...filteredNotes, ...filteredResources];
    const allFilteredSelected = allFiltered.every((it) => selected.has(itemKey(it)));
    const someFilteredSelected =
      allFiltered.some((it) => selected.has(itemKey(it))) && !allFilteredSelected;

    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Back bar */}
        <button
          onClick={resetToSkills}
          className="flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg mb-3"
        >
          <ArrowLeft size={14} />
          Back to skills
        </button>

        {/* Skill header */}
        <div className="surface p-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-bg-base font-bold text-lg shrink-0"
              style={{ background: selectedSkill.color }}
            >
              {selectedSkill.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold truncate">
                {selectedSkill.name}
              </div>
              <div className="text-[11px] text-fg-muted uppercase tracking-wider">
                {selectedSkill.category}
              </div>
            </div>
            <div className="text-right text-xs text-fg-muted">
              <div>
                <span className="text-fg font-semibold">{totalCount}</span> linked
              </div>
              <div>
                <span className="text-accent font-semibold">{selected.size}</span>{" "}
                selected
              </div>
            </div>
          </div>
        </div>

        {linkedLoading ? (
          <div className="surface p-8 text-center text-fg-muted text-sm">
            Loading linked items...
          </div>
        ) : totalCount === 0 ? (
          <div className="surface p-12 text-center">
            <StickyNote size={28} className="text-fg-muted mx-auto mb-2" />
            <h3 className="text-base font-semibold mb-1">
              Nothing linked to this skill yet
            </h3>
            <p className="text-sm text-fg-muted">
              Edit a note or a resource and set its skill to "
              {selectedSkill.name}" to see it here.
            </p>
          </div>
        ) : (
          <>
            {/* Toolbar: search + select-all/none */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 surface">
                <Search size={14} className="text-fg-muted" />
                <input
                  value={itemQ}
                  onChange={(e) => setItemQ(e.target.value)}
                  placeholder="Search items..."
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>
              <button
                onClick={() => (allFilteredSelected ? selectNone() : selectAll())}
                className="btn-outline text-xs whitespace-nowrap"
              >
                {allFilteredSelected ? "Deselect visible" : "Select visible"}
              </button>
            </div>

            {/* Notes section */}
            {filteredNotes.length > 0 && (
              <div className="mb-5">
                <div className="text-xs text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <StickyNote size={12} />
                  Notes ({filteredNotes.length})
                </div>
                <div className="space-y-2">
                  {filteredNotes.map((n) => (
                    <ItemRow
                      key={itemKey(n)}
                      item={n}
                      checked={selected.has(itemKey(n))}
                      onToggle={() => toggle(itemKey(n))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Resources section */}
            {filteredResources.length > 0 && (
              <div className="mb-5">
                <div className="text-xs text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BookOpen size={12} />
                  Resources ({filteredResources.length})
                </div>
                <div className="space-y-2">
                  {filteredResources.map((r) => (
                    <ItemRow
                      key={itemKey(r)}
                      item={r}
                      checked={selected.has(itemKey(r))}
                      onToggle={() => toggle(itemKey(r))}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Bottom bar: Next */}
            <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-2 bg-bg-base/90 backdrop-blur border-t border-border mt-6">
              <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
                <div className="text-sm text-fg-muted">
                  {selected.size === 0 ? (
                    <>Tick the items you want to review</>
                  ) : (
                    <>
                      <span className="text-fg font-semibold">
                        {selected.size}
                      </span>{" "}
                      item{selected.size !== 1 && "s"} selected
                    </>
                  )}
                </div>
                <button
                  onClick={startSession}
                  disabled={selected.size === 0}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // View 3: review session
  // ─────────────────────────────────────────────────────────────────────
  if (phase === "session") {
    const it = queue[currentIdx];
    const total = queue.length;
    const progress = (reviewedCount / total) * 100;
    const Icon = it.kind === "note" ? StickyNote : BookOpen;

    return (
      <div className="p-6 max-w-2xl mx-auto">
        {/* Top progress */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setPhase("items")}
            className="text-fg-muted hover:text-fg"
            title="Back to selection"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-brand-purple transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-fg-muted font-mono whitespace-nowrap">
            {reviewedCount + 1} / {total}
          </div>
        </div>

        {/* The item card */}
        <div className="surface-elevated p-8 min-h-[420px] flex flex-col">
          {/* Header chip row */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="chip">
              <Icon size={11} />
              {it.kind}
            </span>
            {it.sub_kind && (
              <span className="chip">
                <SubKindIcon k={it.sub_kind} />
                {SUB_KIND_LABEL[it.sub_kind] ?? it.sub_kind}
              </span>
            )}
            {it.status && (
              <span className={cn("chip", STATUS_COLOR[it.status] ?? "")}>
                {STATUS_LABEL[it.status] ?? it.status}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold mb-2 break-words">{it.title}</h2>

          {/* Meta row: last reviewed + count */}
          <div className="flex items-center gap-4 text-xs text-fg-muted mb-4">
            <div className="flex items-center gap-1">
              <CalendarDays size={11} />
              {it.last_reviewed_at
                ? `Last reviewed ${relativeTime(it.last_reviewed_at)}`
                : "Never reviewed"}
            </div>
            <div className="flex items-center gap-1">
              <Hash size={11} />
              {it.review_count} review{it.review_count !== 1 && "s"}
            </div>
          </div>

          {/* Content / preview */}
          <div className="flex-1 min-h-0 overflow-y-auto mb-4 -mx-2 px-2">
            {it.kind === "note" ? (
              <p className="text-sm text-fg whitespace-pre-wrap leading-relaxed">
                {it.preview || (
                  <span className="text-fg-subtle italic">No content.</span>
                )}
              </p>
            ) : (
              <div className="space-y-2">
                {it.href && (
                  <div className="text-xs text-fg-muted break-all bg-bg-base p-2 rounded">
                    {it.href}
                  </div>
                )}
                {it.preview && it.preview !== it.href && (
                  <p className="text-sm text-fg-muted">
                    {it.preview}
                  </p>
                )}
              </div>
            )}
            {it.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {it.tags.map((t) => (
                  <span key={t} className="chip">
                    <TagIcon size={9} />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              onClick={() => {
                // Open the resource in the browser / app viewer, depending
                // on the type. Notes have href="" so this is a no-op.
                if (it.href) {
                  // We use the same helper the rest of the app uses.
                  import("@/lib/openResource").then(({ openResource }) => {
                    const fakeNav = ((path: string) => {
                      window.history.pushState({}, "", path);
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    }) as any;
                    openResource(
                      {
                        id: it.id,
                        title: it.title,
                        url: it.href,
                        type: (it.sub_kind as any) || "website",
                        source_mode: "url" as any,
                        local_path: "",
                        status: (it.status as any) || "to_read",
                        progress: 0,
                        description: "",
                        tags: it.tags,
                        skill_id: selectedSkill?.id ?? null,
                        created_at: "",
                        updated_at: "",
                      },
                      fakeNav,
                    );
                  });
                }
              }}
              disabled={!it.href}
              className="btn-outline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ExternalLink size={13} />
              {it.kind === "note" ? "View" : "Open"}
            </button>
            <button onClick={markCurrentReviewed} className="btn-primary">
              <CheckCircle2 size={14} />
              Review Complete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // View 4: done
  // ─────────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="surface-elevated p-12">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-accent" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Review complete</h2>
          <p className="text-fg-muted mb-6">
            You reviewed{" "}
            <span className="text-accent font-semibold">{reviewedCount}</span>{" "}
            item{reviewedCount !== 1 && "s"} linked to{" "}
            <span className="text-fg font-semibold">
              {selectedSkill?.name}
            </span>
            . Nice.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={resetToSkills} className="btn-outline">
              Pick another skill
            </button>
            <button
              onClick={() => {
                // Re-open the same skill in selection mode so the user
                // can pick more (the items have new review counts now).
                setPhase("items");
              }}
              className="btn-primary"
            >
              Review more of this skill
              <ArrowRight size={14} />
            </button>
          </div>
          {typeof window !== "undefined" &&
            // Fire-and-forget achievement re-check; mirrors the rest of
            // the app.
            (() => {
              window.dispatchEvent(new CustomEvent("achievement:recheck"));
              return null;
            })()}
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SkillPickerCard({
  skill,
  onPick,
}: {
  skill: Skill;
  onPick: () => void;
}) {
  const isDue =
    !skill.next_review_at || new Date(skill.next_review_at) <= new Date();
  return (
    <button
      onClick={onPick}
      className="surface p-4 hover:border-border-strong transition-colors text-left w-full"
    >
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-bg-base font-bold text-lg shrink-0"
          style={{ background: skill.color }}
        >
          {skill.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate">{skill.name}</div>
          <div className="text-[11px] text-fg-muted uppercase tracking-wider">
            {skill.category}
          </div>
        </div>
        <ArrowRight size={16} className="text-fg-muted shrink-0 mt-1" />
      </div>

      <p className="text-sm text-fg-muted line-clamp-2 mb-3 min-h-[2.5rem]">
        {skill.description || "No description yet."}
      </p>

      <div className="flex items-center justify-between text-[11px] text-fg-subtle pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          {isDue ? (
            <span className="text-accent flex items-center gap-1">
              <Clock size={11} /> due
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock size={11} /> scheduled
            </span>
          )}
        </div>
        <div>
          {skill.last_reviewed_at
            ? `Last: ${relativeTime(skill.last_reviewed_at)}`
            : "Never reviewed"}
        </div>
      </div>
    </button>
  );
}

function ItemRow({
  item,
  checked,
  onToggle,
}: {
  item: LinkedItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const Icon = item.kind === "note" ? StickyNote : BookOpen;
  const SubIcon = item.sub_kind ? (
    <SubKindIcon k={item.sub_kind} />
  ) : null;

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3",
        checked
          ? "border-accent/50 bg-accent/10"
          : "border-border bg-bg-surface hover:border-border-strong",
      )}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors",
          checked
            ? "bg-accent border-accent"
            : "border-fg-muted/50 bg-transparent",
        )}
      >
        {checked && <CheckCircle2 size={11} className="text-bg-base" />}
      </div>

      {/* Icon */}
      <div className="text-fg-muted shrink-0 mt-0.5">
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="font-medium text-sm truncate">{item.title}</span>
          {item.sub_kind && (
            <span className="chip text-[10px]">
              {SubIcon}
              {SUB_KIND_LABEL[item.sub_kind] ?? item.sub_kind}
            </span>
          )}
          {item.status && (
            <span
              className={cn(
                "chip text-[10px]",
                STATUS_COLOR[item.status] ?? "",
              )}
            >
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
          )}
        </div>
        {item.preview && (
          <div className="text-xs text-fg-muted line-clamp-2 break-words">
            {item.preview}
          </div>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1">
            <CalendarDays size={10} />
            {item.last_reviewed_at
              ? `Last: ${relativeTime(item.last_reviewed_at)}`
              : "Never reviewed"}
          </span>
          <span className="flex items-center gap-1">
            <Hash size={10} />
            {item.review_count} review{item.review_count !== 1 && "s"}
          </span>
        </div>
      </div>
    </button>
  );
}
