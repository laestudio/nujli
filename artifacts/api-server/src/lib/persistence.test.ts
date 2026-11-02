import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {pool} from "@workspace/db";
import {getProject,saveRevision,type Revision} from "./projects";

test("private draft persists, rejects other owners, and failed generation save rolls back evidence",async()=>{
  const owner=`SAMPLE-test-${randomUUID()}`;
  const org=await pool.query("INSERT INTO organizations(owner_id,name,website) VALUES($1,'SAMPLE persistence test','https://example.org') RETURNING id",[owner]);
  const orgId=org.rows[0].id;
  let id:string|undefined;
  try{
    const source="SAMPLE software test. This is not a humanitarian project.";
    const inserted=await pool.query("INSERT INTO projects(organization_id,source_url,source_text,is_sample) VALUES($1,'https://example.org', $2,true) RETURNING id",[orgId,source]);
    id=inserted.rows[0].id;
    const revision:Revision={title:"SAMPLE software test.",overview:source,cause:"Software test",locationName:"",latitude:null,longitude:null,claims:[],statistics:[],updates:[],media:[]};
    await saveRevision(id!,orgId,revision,owner);
    assert.equal((await getProject(id!,{organizationId:orgId})).title,revision.title);
    await assert.rejects(()=>getProject(id!,{organizationId:randomUUID()}));
    await assert.rejects(()=>getProject(id!,{public:true}));
    await assert.rejects(()=>saveRevision(id!,orgId,{...revision,title:"unsupported title"},owner,randomUUID(),{sourceUrl:"https://example.org",corpus:"replacement evidence",hash:"test",warnings:["test"],sources:{}}));
    const row=await pool.query("SELECT source_text,title FROM projects WHERE id=$1",[id]);
    assert.equal(row.rows[0].source_text,source);
    assert.equal(row.rows[0].title,revision.title);
  }finally{
    if(id){await pool.query("DELETE FROM audit_events WHERE resource_id=$1",[id]);await pool.query("DELETE FROM projects WHERE id=$1",[id]);}
    await pool.query("DELETE FROM organizations WHERE id=$1",[orgId]);
  }
});
after(()=>pool.end());
