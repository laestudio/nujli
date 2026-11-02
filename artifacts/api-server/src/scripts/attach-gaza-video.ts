import { pool } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { recordPublication } from "../lib/publication-dates";
import { GetPublicProjectResponse } from "@workspace/api-zod";
import { getProject } from "../lib/projects";

// An official publisher embed, not a rehosted video or project-outcome evidence.
const projectId = "bf0edb72-d94c-4114-9318-698319dd8ad5";
const url = "https://www.youtube.com/watch?v=xn9G_nild-w";
const source = "https://www.islamicreliefcanada.org/giving/emergencies/palestine/gaza-update";
const caption = "Is Aid Reaching Gaza? — Islamic Relief Canada, 1 April 2024. Official publisher video embedded on its Gaza reporting page. Historical context only: not footage of, or evidence for, the 2025–2026 IATI transactions. No donation allocation is implied. Playback is supplied by YouTube; no download or rehosting permission is claimed.";

async function main() {
  const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  if (!response.ok) throw new Error("Publisher embed is unavailable.");
  const metadata = await response.json() as { author_name: string; html: string };
  if (metadata.author_name !== "Islamic Relief Canada" || !metadata.html.includes("xn9G_nild-w")) throw new Error("Publisher identity mismatch.");
  const page = await fetch(source);
  if (!page.ok || !(await page.text()).includes("xn9G_nild-w")) throw new Error("Official reporting page does not link this video.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = (await client.query("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [projectId])).rows[0];
    if (row?.demonstration?.activityId !== "GB-CHC-328158-MEHA24-2" || row.status !== "published") throw new Error("Unexpected demonstration.");
    let mediaId = (await client.query("SELECT id FROM media WHERE project_id=$1 AND url=$2", [projectId,url])).rows[0]?.id;
    if (!mediaId) mediaId = (await client.query("INSERT INTO media(project_id,url,type,caption,permission_status,source_url) VALUES($1,$2,'video',$3,'approved',$4) RETURNING id", [projectId,url,caption,source])).rows[0].id;
    const item = {id:mediaId,url,type:"video",caption,sourceUrl:source,permissionStatus:"approved"};
    const immersion = row.immersion ?? {scenes:[],comparisons:[]};
    if (!immersion.scenes.some((s: {mediaId:string}) => s.mediaId === mediaId)) immersion.scenes.push({
      mediaId,panoramaConfirmed:false,date:"2024-04-01",dateQuote:"Apr 1, 2024",
      hotspots:[{id:randomUUID(),kind:"media",recordId:mediaId,x:90,y:10,confirmed:true,limitations:caption}],
    });
    const ledger = recordPublication({claims:[],statistics:[],updates:[],media:[item]},row.evidence_publications ?? {},new Date().toISOString());
    const demo = row.demonstration;
    demo.limitations = [...new Set([...(demo.limitations ?? []).filter((s:string) => !s.includes("No photographs or video")), caption, "No authorized project photographs or genuine panoramas are attached. This historical contextual video is not an immersive reconstruction."])];
    await client.query("UPDATE projects SET immersion=$2,evidence_publications=$3,demonstration=$4,updated_at=now() WHERE id=$1", [projectId,JSON.stringify(immersion),JSON.stringify(ledger),JSON.stringify(demo)]);
    await client.query("INSERT INTO audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)",[row.owner_id ?? "nujli-demo-import","demonstration.media-attached",projectId,JSON.stringify({source,url,publisher:metadata.author_name,permission:"official YouTube embed only",contextOnly:true})]);
    await client.query("COMMIT");
    GetPublicProjectResponse.parse(await getProject(projectId,{public:true}));
    console.log(JSON.stringify({projectId,mediaId,publisher:metadata.author_name,photos:0,panoramas:0,video:1,contextOnly:true}));
  } catch(e) {await client.query("ROLLBACK"); throw e;} finally {client.release();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
