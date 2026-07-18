import {
  BookOpen,
  Globe,
  GraduationCap,
  Headphones,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { ResourceKind, ResourceSourceMode } from "@/lib/api";

export const RESOURCE_KINDS: ResourceKind[] = [
  "book",
  "video",
  "course",
  "podcast",
  "website",
];

export const KIND_META: Record<
  ResourceKind,
  { label: string; icon: LucideIcon; emptyHint: string }
> = {
  book: {
    label: "Book",
    icon: BookOpen,
    emptyHint: "Add PDF books from your computer or a download link.",
  },
  video: {
    label: "Video",
    icon: Video,
    emptyHint: "Add local video files or links to watch later.",
  },
  course: {
    label: "Course",
    icon: GraduationCap,
    emptyHint: "Save course URLs — opening sends you to the course page.",
  },
  podcast: {
    label: "Podcast",
    icon: Headphones,
    emptyHint: "Save podcast or episode links.",
  },
  website: {
    label: "Website",
    icon: Globe,
    emptyHint: "Bookmark sites and pages to revisit.",
  },
};

export function supportsLocalSource(type: ResourceKind): boolean {
  return type === "book" || type === "video";
}

export function defaultSourceMode(type: ResourceKind): ResourceSourceMode {
  return supportsLocalSource(type) ? "url" : "url";
}

export function emptyResourceDefaults(): {
  title: string;
  url: string;
  type: ResourceKind;
  source_mode: ResourceSourceMode;
  local_path: string;
  status: "to_read";
  progress: number;
  description: string;
  tags: string[];
} {
  return {
    title: "",
    url: "",
    type: "website",
    source_mode: "url",
    local_path: "",
    status: "to_read",
    progress: 0,
    description: "",
    tags: [],
  };
}
