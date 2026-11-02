import type { z } from "zod";
import type { SaveProjectBody } from "@workspace/api-zod";
import { requireCondition } from "./errors";
import { safeUrl } from "./safe-fetch";

type Revision = z.infer<typeof SaveProjectBody>;
export type Immersion = NonNullable<Revision["immersion"]>;
export const emptyImmersion = (): Immersion => ({ scenes: [], comparisons: [] });

/** Confirmation never changes a claim's evidence/reviewer label. */
export function validateImmersion(
  revision: Revision,
  sources: Record<string, string>,
  documentedDate: (quote: string, date: string) => boolean,
) {
  const immersion = revision.immersion ?? emptyImmersion();
  const media = new Map(revision.media.map(m => [m.id, m]));
  const claims = new Map(revision.claims.map(c => [c.id, c]));
  requireCondition(media.size === revision.media.length, 422, "Duplicate media identifiers.");
  const sceneIds = new Set<string>();
  const hotspotIds = new Set<string>();
  for (const scene of immersion.scenes) {
    const item = media.get(scene.mediaId);
    requireCondition(item && !sceneIds.has(scene.mediaId), 422, "Each scene must reference a unique project media record.");
    sceneIds.add(scene.mediaId);
    requireCondition(!scene.panoramaConfirmed || (item.type === "image" && item.permissionStatus === "approved"), 422,
      "A panorama requires an authorized image and explicit organization confirmation.");
    if (scene.date) {
      const source = sources[safeUrl(item.sourceUrl).toString()];
      const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
      requireCondition(typeof source === "string" && scene.dateQuote.trim().length >= 12 &&
        normalize(source).includes(normalize(scene.dateQuote)) && documentedDate(scene.dateQuote, scene.date), 422,
      "The media date must occur in a quotation from that media item's fetched source.");
    } else {
      requireCondition(!scene.dateQuote.trim(), 422, "Provide a documented date with its quotation, or leave both blank.");
    }
    for (const h of scene.hotspots) {
      requireCondition(!hotspotIds.has(h.id), 422, "Hotspot identifiers must be unique.");
      hotspotIds.add(h.id);
      const target = h.kind === "claim" ? claims.get(h.recordId) : media.get(h.recordId);
      requireCondition(target, 422, "Hotspots must reference an included claim or media record.");
      if (h.confirmed) {
        requireCondition(item.permissionStatus === "approved", 422, "Confirm scene media permission before confirming hotspots.");
        requireCondition(h.kind !== "media" || media.get(h.recordId)?.permissionStatus === "approved", 422,
          "Hotspots cannot expose media without permission.");
      }
    }
  }
  const comparisons = new Set<string>();
  for (const comparison of immersion.comparisons) {
    const before = immersion.scenes.find(s => s.mediaId === comparison.beforeMediaId);
    const after = immersion.scenes.find(s => s.mediaId === comparison.afterMediaId);
    const claim = claims.get(comparison.claimId);
    const key = `${comparison.beforeMediaId}:${comparison.afterMediaId}`;
    requireCondition(!comparisons.has(key), 422, "Duplicate comparison.");
    comparisons.add(key);
    requireCondition(before?.date && after?.date && before.date < after.date &&
      before.mediaId !== after.mediaId && claim, 422, "A comparison requires two distinct, chronologically dated scenes and a source-backed claim.");
    requireCondition(documentedDate(claim.quote, before.date) && documentedDate(claim.quote, after.date), 422,
      "The comparison claim must document both dates; unrelated photos are not before-and-after evidence.");
    if (comparison.confirmed) requireCondition(
      media.get(before.mediaId)?.permissionStatus === "approved" && media.get(after.mediaId)?.permissionStatus === "approved",
      422, "Both comparison media items require permission.");
  }
}

/** Fail closed on stale references, withheld permissions, and unconfirmed suggestions. */
export function publicImmersion(immersion: Immersion, mediaIds: Set<string>, claimIds: Set<string>): Immersion {
  const scenes = immersion.scenes.filter(s => mediaIds.has(s.mediaId)).map(s => ({
    ...s,
    hotspots: s.hotspots.filter(h => h.confirmed && (h.kind === "claim" ? claimIds : mediaIds).has(h.recordId)),
  }));
  const sceneIds = new Set(scenes.map(s => s.mediaId));
  return {
    scenes,
    comparisons: immersion.comparisons.filter(c => c.confirmed && sceneIds.has(c.beforeMediaId) &&
      sceneIds.has(c.afterMediaId) && claimIds.has(c.claimId)),
  };
}

export function remapImmersion(immersion: Immersion, mediaIds: Map<string, string>, claimIds: Map<string, string>): Immersion {
  const mapped = (map: Map<string, string>, id: string) => {
    const value = map.get(id);
    requireCondition(value, 422, "Immersive evidence reference could not be saved.");
    return value;
  };
  return {
    scenes: immersion.scenes.map(s => ({
      ...s, mediaId: mapped(mediaIds, s.mediaId),
      hotspots: s.hotspots.map(h => ({ ...h, recordId: mapped(h.kind === "claim" ? claimIds : mediaIds, h.recordId) })),
    })),
    comparisons: immersion.comparisons.map(c => ({ ...c, beforeMediaId: mapped(mediaIds, c.beforeMediaId),
      afterMediaId: mapped(mediaIds, c.afterMediaId), claimId: mapped(claimIds, c.claimId) })),
  };
}
