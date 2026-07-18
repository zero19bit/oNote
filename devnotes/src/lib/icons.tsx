// Centralized lucide-react icon re-exports.
//
// lucide-react@1.25.0 (the version pinned in package.json) ships each
// icon as a default-exported ESM file and re-exports them as named
// exports from the main entry. With Vite's current `module: ESNext` +
// `moduleResolution: bundler` setup, Rollup drops those named
// re-exports during tree-shaking, which breaks production builds.
//
// `vite.config.ts` and `tsconfig.json` alias the bare specifier
// `lucide-react` (regex `^lucide-react$`, so `lucide-react/dist/...`
// is NOT matched) to this file, so every `import { Foo } from "lucide-react"`
// in the codebase transparently goes through this curated re-export.
//
// The .d.ts shim in `src/types/lucide-react-shim.d.ts` provides types
// for the deep path imports below.

import AlertCircle from "lucide-react/dist/esm/icons/alert-circle.mjs";
import Apple from "lucide-react/dist/esm/icons/apple.mjs";
import Archive from "lucide-react/dist/esm/icons/archive.mjs";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import BookOpen from "lucide-react/dist/esm/icons/book-open.mjs";
import BrainCircuit from "lucide-react/dist/esm/icons/brain-circuit.mjs";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.mjs";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2.mjs";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up.mjs";
import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import Code from "lucide-react/dist/esm/icons/code.mjs";
import Code2 from "lucide-react/dist/esm/icons/code-2.mjs";
import Copy from "lucide-react/dist/esm/icons/copy.mjs";
import Database from "lucide-react/dist/esm/icons/database.mjs";
import Download from "lucide-react/dist/esm/icons/download.mjs";
import Edit3 from "lucide-react/dist/esm/icons/edit-3.mjs";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";
import Eye from "lucide-react/dist/esm/icons/eye.mjs";
import EyeOff from "lucide-react/dist/esm/icons/eye-off.mjs";
import FileText from "lucide-react/dist/esm/icons/file-text.mjs";
import Film from "lucide-react/dist/esm/icons/film.mjs";
import Filter from "lucide-react/dist/esm/icons/filter.mjs";
import Flame from "lucide-react/dist/esm/icons/flame.mjs";
import Globe from "lucide-react/dist/esm/icons/globe.mjs";
import GraduationCap from "lucide-react/dist/esm/icons/graduation-cap.mjs";
import Hash from "lucide-react/dist/esm/icons/hash.mjs";
import Headphones from "lucide-react/dist/esm/icons/headphones.mjs";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle.mjs";
import Highlighter from "lucide-react/dist/esm/icons/highlighter.mjs";
import Heading1 from "lucide-react/dist/esm/icons/heading-1.mjs";
import Heading2 from "lucide-react/dist/esm/icons/heading-2.mjs";
import Heading3 from "lucide-react/dist/esm/icons/heading-3.mjs";
import Inbox from "lucide-react/dist/esm/icons/inbox.mjs";
import Info from "lucide-react/dist/esm/icons/info.mjs";
import Italic from "lucide-react/dist/esm/icons/italic.mjs";
import Keyboard from "lucide-react/dist/esm/icons/keyboard.mjs";
import Languages from "lucide-react/dist/esm/icons/languages.mjs";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard.mjs";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid.mjs";
import Link from "lucide-react/dist/esm/icons/link.mjs";
import List from "lucide-react/dist/esm/icons/list.mjs";
import ListChecks from "lucide-react/dist/esm/icons/list-checks.mjs";
import ListOrdered from "lucide-react/dist/esm/icons/list-ordered.mjs";
import Monitor from "lucide-react/dist/esm/icons/monitor.mjs";
import PartyPopper from "lucide-react/dist/esm/icons/party-popper.mjs";
import Pause from "lucide-react/dist/esm/icons/pause.mjs";
import Pin from "lucide-react/dist/esm/icons/pin.mjs";
import Pilcrow from "lucide-react/dist/esm/icons/pilcrow.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import Quote from "lucide-react/dist/esm/icons/quote.mjs";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Save from "lucide-react/dist/esm/icons/save.mjs";
import Scissors from "lucide-react/dist/esm/icons/scissors.mjs";
import ClipboardPaste from "lucide-react/dist/esm/icons/clipboard-paste.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";
import Settings from "lucide-react/dist/esm/icons/settings.mjs";
import Share2 from "lucide-react/dist/esm/icons/share-2.mjs";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import StickyNote from "lucide-react/dist/esm/icons/sticky-note.mjs";
import Strikethrough from "lucide-react/dist/esm/icons/strikethrough.mjs";
import Tag from "lucide-react/dist/esm/icons/tag.mjs";
import Target from "lucide-react/dist/esm/icons/target.mjs";
import Terminal from "lucide-react/dist/esm/icons/terminal.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up.mjs";
import Trophy from "lucide-react/dist/esm/icons/trophy.mjs";
import Upload from "lucide-react/dist/esm/icons/upload.mjs";
import Video from "lucide-react/dist/esm/icons/video.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import Zap from "lucide-react/dist/esm/icons/zap.mjs";
import ZoomIn from "lucide-react/dist/esm/icons/zoom-in.mjs";
import ZoomOut from "lucide-react/dist/esm/icons/zoom-out.mjs";
import Bold from "lucide-react/dist/esm/icons/bold.mjs";

export {
  AlertCircle,
  Apple,
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Code,
  Code2,
  Copy,
  Database,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Film,
  Filter,
  Flame,
  Globe,
  GraduationCap,
  Hash,
  Headphones,
  HelpCircle,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Inbox,
  Info,
  Italic,
  Keyboard,
  Languages,
  LayoutDashboard,
  LayoutGrid,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Monitor,
  PartyPopper,
  Pause,
  Pin,
  Pilcrow,
  Play,
  Plus,
  Quote,
  RotateCcw,
  Save,
  Scissors,
  ClipboardPaste,
  Search,
  Settings,
  Share2,
  Sparkles,
  StickyNote,
  Strikethrough,
  Tag,
  Target,
  Terminal,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  Video,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  Bold,
};

// Convenience aliases for the in-codebase `X as Y` pattern.
export { Link as LinkIcon };
export { Inbox as InboxIcon };
export { Settings as SettingsIcon };
export { Tag as TagIcon };

// `LucideIcon` is a type that the codebase re-imports from
// "lucide-react". We can't re-export a non-existent type, so we make
// a structurally-compatible one here.
export type LucideIcon = React.ForwardRefExoticComponent<
  React.SVGProps<SVGSVGElement> & { size?: number | string }
>;
