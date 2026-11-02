import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { pool } from "@workspace/db";
import * as schemas from "@workspace/api-zod";
import { identity, organizationIdentity } from "../lib/auth";
import { getProject, saveRevision, publicationErrors, audit } from "../lib/projects";
import { safeUrl } from "../lib/safe-fetch";
import { billingPackage, checkout, entitlement, requirePaid } from "../lib/billing";
import { enqueueGeneration, serializeJob } from "../lib/generation";
import { requireCondition } from "../lib/errors";
import { z } from "zod";
import { recordPublication } from "../lib/publication-dates";

const router=Router();
const idOf=(raw:unknown)=>z.string().uuid().parse(raw);
router.get("/public/projects",async(req,res)=>{
  const q=schemas.ListPublicProjectsQueryParams.parse(req.query);
  const {rows}=await pool.query(`SELECT p.id FROM projects p JOIN organizations o ON o.id=p.organization_id WHERE p.status='published'
    AND ($1::text IS NULL OR p.title ILIKE '%'||$1||'%' OR o.name ILIKE '%'||$1||'%')
    AND ($2::text IS NULL OR p.cause=$2) AND ($3::text IS NULL OR o.name=$3 OR o.id::text=$3) ORDER BY p.published_at DESC LIMIT 200`,
    [q.search||null,q.cause||null,q.organization||null]);
  res.json(schemas.ListPublicProjectsResponse.parse(await Promise.all(rows.map(r=>getProject(r.id,{public:true})))));
});
router.get("/public/projects/:id",async(req,res)=>{res.json(await getProject(idOf(req.params.id),{public:true}));});
router.get("/public/summary",async(_req,res)=>{
  const {rows}=await pool.query("SELECT count(*)::int AS projects,count(DISTINCT organization_id)::int AS organizations,COALESCE(array_agg(DISTINCT cause) FILTER(WHERE cause<>''),'{}') AS causes FROM projects WHERE status='published'");
  res.json(schemas.GetPublicSummaryResponse.parse(rows[0]));
});
router.get("/billing/package",async(_req,res)=>{res.json(schemas.GetBillingPackageResponse.parse(await billingPackage()));});
router.post("/billing/checkout",async(req,res)=>{
  const who=await organizationIdentity(req);
  const origin=req.get("origin");
  requireCondition(origin && new URL(origin).host === req.get("host"),403,"Checkout must be initiated from this application.");
  res.json(await checkout(who.organization.id,origin));
});
router.post("/billing/verify",async(req,res)=>{const who=await organizationIdentity(req);res.json(await entitlement(who.organization.id));});
router.post("/billing/developer-access",async(req,res)=>{
  const who=await organizationIdentity(req);
  requireCondition(who.developerEligible,403,"Developer access is restricted to the authorized development account.");
  const origin=req.get("origin");
  requireCondition(origin && new URL(origin).host === req.get("host"),403,"Use Developer access from this application.");
  requireCondition(typeof req.body.enabled === "boolean",400,"Choose whether to enable developer access.");
  await clerkClient.users.updateUserMetadata(who.userId,{publicMetadata:{developerAccessEnabled:req.body.enabled}});
  await pool.query("INSERT INTO audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)",[who.userId,req.body.enabled?"developer-access.enabled":"developer-access.disabled",who.organization.id,JSON.stringify({developmentOnly:true,paymentVerified:false})]);
  res.json(await entitlement(who.organization.id));
});
async function account(who:Awaited<ReturnType<typeof identity>>){
  return schemas.GetMeResponse.parse({userId:who.userId,role:who.role,organizationId:who.organization?.id??null,
    organizationName:who.organization?.name??null,website:who.organization?.website??null,
    entitlement:await entitlement(who.organization?.id),developerEligible:who.developerEligible,aiConfigured:!!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL});
}
router.get("/me",async(req,res)=>{res.json(await account(await identity(req)));});
router.put("/organization",async(req,res)=>{
  const who=await identity(req);requireCondition(who.role==="organization",403,"Reviewers cannot create an organization.");
  const body=schemas.SaveOrganizationBody.parse(req.body);safeUrl(body.website);
  await pool.query(`INSERT INTO organizations(owner_id,name,website) VALUES($1,$2,$3)
    ON CONFLICT(owner_id) DO UPDATE SET name=excluded.name,website=excluded.website`,[who.userId,body.name.trim(),body.website]);
  res.json(await account(await identity(req)));
});
router.get("/organization/projects",async(req,res)=>{
  const who=await organizationIdentity(req);
  const {rows}=await pool.query("SELECT id FROM projects WHERE organization_id=$1 ORDER BY updated_at DESC",[who.organization.id]);
  res.json(await Promise.all(rows.map(r=>getProject(r.id,{organizationId:who.organization.id}))));
});
router.post("/organization/projects",async(req,res)=>{
  const who=await organizationIdentity(req);await requirePaid(who.organization.id);
  const body=schemas.SubmitProjectBody.parse(req.body);const url=safeUrl(body.sourceUrl).toString();
  requireCondition(body.permissionsConfirmed,422,"Confirm you have permission to use and publish these sources.");
  const extras=[...new Set((body.extraSourceUrls??[]).map(s=>safeUrl(s).toString()))].filter(s=>s!==url);
  const client=await pool.connect();
  let projectId:string;
  try{
    await client.query("BEGIN");
    await client.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE",[who.organization.id]);
    const existing=await client.query("SELECT id FROM projects WHERE organization_id=$1 AND source_url=$2 AND extra_source_urls=$3::jsonb AND status='draft' ORDER BY created_at DESC LIMIT 1",[who.organization.id,url,JSON.stringify(extras)]);
    projectId=existing.rows[0]?.id;
    if(!projectId){
      const created=await client.query("INSERT INTO projects(organization_id,source_url,extra_source_urls,submission_permission_at) VALUES($1,$2,$3,now()) RETURNING id",[who.organization.id,url,JSON.stringify(extras)]);
      projectId=created.rows[0].id;
    }else await client.query("UPDATE projects SET submission_permission_at=now() WHERE id=$1",[projectId]);
    await audit(client,who.userId,"project.source-permission-confirmed",projectId);
    await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  res.status(201).json(await getProject(projectId!,{organizationId:who.organization.id}));
});
router.get("/organization/projects/:id",async(req,res)=>{
  const who=await organizationIdentity(req);res.json(await getProject(idOf(req.params.id),{organizationId:who.organization.id}));
});
router.put("/organization/projects/:id",async(req,res)=>{
  const who=await organizationIdentity(req);await requirePaid(who.organization.id);
  res.json(await saveRevision(idOf(req.params.id),who.organization.id,schemas.SaveProjectBody.parse(req.body),who.userId));
});
router.delete("/organization/projects/:id",async(req,res)=>{
  const who=await organizationIdentity(req);const id=idOf(req.params.id);
  const {rowCount}=await pool.query("DELETE FROM projects WHERE id=$1 AND organization_id=$2",[id,who.organization.id]);
  requireCondition(rowCount,404,"Project not found.");res.json({ok:true});
});
router.post("/organization/projects/:id/generate",async(req,res)=>{
  const who=await organizationIdentity(req);const id=idOf(req.params.id);
  const project=await getProject(id,{organizationId:who.organization.id});
  requireCondition(project.status==="draft",409,"Unpublish the project before generating a new draft.");
  res.status(202).json(await enqueueGeneration(id,who.organization.id));
});
router.get("/organization/projects/:id/job",async(req,res)=>{
  const who=await organizationIdentity(req);const id=idOf(req.params.id);
  await getProject(id,{organizationId:who.organization.id});
  const {rows}=await pool.query("SELECT * FROM generation_jobs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1",[id]);
  res.json(rows[0]?serializeJob(rows[0]):{id:"",projectId:id,status:"idle",message:"Generation has not started."});
});
for(const action of ["approve","publish","unpublish"] as const){
  router.post(`/organization/projects/:id/${action}`,async(req,res)=>{
    const who=await organizationIdentity(req);const id=idOf(req.params.id);
    if(action!=="unpublish") await requirePaid(who.organization.id);
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const {rows}=await client.query("SELECT * FROM projects WHERE id=$1 AND organization_id=$2 FOR UPDATE",[id,who.organization.id]);
      requireCondition(rows[0],404,"Project not found.");
      const active=await client.query("SELECT id FROM generation_jobs WHERE project_id=$1 AND status IN ('queued','fetching','generating','building','preparing')",[id]);
      requireCondition(!active.rowCount,409,"Wait for generation to finish.");
      if(action!=="unpublish"){
        const project=await getProject(id,{organizationId:who.organization.id});
        const errors=publicationErrors(project);requireCondition(!errors.length,422,errors.join(" "));
      }
      if(action==="approve"){
        const b=schemas.ApproveProjectBody.parse(req.body);
        requireCondition(b.accuracyConfirmed&&b.permissionsConfirmed&&b.privacyConfirmed,422,"All review confirmations are required.");
        await client.query("UPDATE projects SET status='approved',approved_at=now(),published_at=NULL,updated_at=now() WHERE id=$1",[id]);
      }else if(action==="publish"){
        requireCondition(rows[0].status==="approved"&&rows[0].approved_at,409,"Approve the current draft before publishing.");
        const project = await getProject(id,{organizationId:who.organization.id});
        const publishedAt = new Date().toISOString();
        const ledger = recordPublication(project, rows[0].evidence_publications ?? {}, publishedAt);
        await client.query("UPDATE projects SET status='published',published_at=$2,evidence_publications=$3,updated_at=now() WHERE id=$1",
          [id,publishedAt,JSON.stringify(ledger)]);
      }else await client.query("UPDATE projects SET status='draft',approved_at=NULL,published_at=NULL,updated_at=now() WHERE id=$1",[id]);
      await audit(client,who.userId,`project.${action}`,id);await client.query("COMMIT");
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
    res.json(await getProject(id,{organizationId:who.organization.id}));
  });
}
router.get("/reviewer/claims",async(req,res)=>{
  const who=await identity(req);requireCondition(who.role==="reviewer",403,"Authorized independent reviewers only.");
  const {rows}=await pool.query("SELECT p.id FROM projects p JOIN organizations o ON o.id=p.organization_id WHERE p.status='published' AND o.owner_id<>$1",[who.userId]);
  const projects=await Promise.all(rows.map(r=>getProject(r.id,{public:true})));
  res.json(projects.flatMap(p=>p.claims.map(c=>({...c,projectId:p.id,projectTitle:p.title,organizationName:p.organizationName}))));
});
router.post("/reviewer/claims/:id/reviews",async(req,res)=>{
  const who=await identity(req);requireCondition(who.role==="reviewer",403,"Authorized independent reviewers only.");
  const id=idOf(req.params.id);const b=schemas.SubmitIndependentReviewBody.parse(req.body);
  requireCondition(b.conflictOfInterestConfirmed,422,"Confirm your independence and absence of conflicts.");
  b.evidenceUrls.forEach(safeUrl);
  const {rows}=await pool.query(`INSERT INTO independent_reviews(claim_id,reviewer_id,findings,limitations,evidence_urls)
    SELECT c.id,$2,$3,$4,$5 FROM evidence_claims c JOIN projects p ON p.id=c.project_id JOIN organizations o ON o.id=p.organization_id
    WHERE c.id=$1 AND p.status='published' AND o.owner_id<>$2
    ON CONFLICT(claim_id,reviewer_id) DO NOTHING RETURNING id,findings,limitations,evidence_urls AS "evidenceUrls",created_at`,
    [id,who.userId,b.findings,b.limitations,JSON.stringify(b.evidenceUrls)]);
  requireCondition(rows[0],409,"Claim is unavailable, belongs to you, or you already submitted a review.");
  res.status(201).json({...rows[0],createdAt:rows[0].created_at.toISOString()});
});
router.get("/visual-build",async(req,res)=>{
  const q=schemas.GetVisualBuildQueryParams.parse(req.query);
  if(q.projectId){
    await getProject(idOf(q.projectId),{public:true});
    const {rows}=await pool.query(`SELECT id,title,conceptual,stages,funding_percent AS "fundingPercent",documented_progress AS "documentedProgress",source_url AS "sourceUrl" FROM visual_build_projects WHERE project_id=$1`,[q.projectId]);
    requireCondition(rows[0],404,"No documented Visual Build record is available for this project.");res.json(rows[0]);return;
  }
  res.json({id:"conceptual-masjid",title:"Conceptual masjid",conceptual:true,fundingPercent:null,documentedProgress:null,sourceUrl:null,
    stages:[{name:"Foundation",threshold:10},{name:"Flooring",threshold:30},{name:"Walls",threshold:50},{name:"Doors and windows",threshold:70},{name:"Roof",threshold:85},{name:"Dome",threshold:95}]});
});
export default router;
