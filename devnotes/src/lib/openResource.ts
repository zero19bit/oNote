import { openUrl } from "@tauri-apps/plugin-opener";
import type { NavigateFunction } from "react-router-dom";
import type { Resource } from "@/lib/api";

/**
 * True when the resource can be viewed inside the oNote app
 * (book with a local PDF, or video with a local file).
 */
export function canViewInApp(resource: Resource): boolean {
  if (resource.source_mode !== "local" || !resource.local_path) return false;
  if (resource.type === "book") {
    return resource.local_path.toLowerCase().endsWith(".pdf");
  }
  if (resource.type === "video") {
    return /\.(mp4|webm|mkv|mov|avi)$/i.test(resource.local_path);
  }
  return false;
}

/**
 * Default click behaviour for a resource card.
 *
 * - course / podcast / website with a URL → open the URL in the user's browser
 * - book (local PDF) or video (local file) → open the in-app viewer
 * - anything else with a URL → open the URL in the browser
 * - fallback → in-app viewer (which can show details / progress)
 */
export async function openResource(resource: Resource, navigate: NavigateFunction) {
  const url = resource.url?.trim();
  const isWebLike =
    resource.type === "course" ||
    resource.type === "podcast" ||
    resource.type === "website";

  if (isWebLike && url) {
    try {
      await openUrl(url);
      return;
    } catch {
      // fall through to viewer if opener fails
    }
  }

  if (canViewInApp(resource)) {
    navigate(`/resources/${resource.id}/view`);
    return;
  }

  if (url) {
    try {
      await openUrl(url);
      return;
    } catch {
      /* fall through */
    }
  }

  // Last resort: open the in-app viewer for context (title, description, progress).
  navigate(`/resources/${resource.id}/view`);
}
