import { test } from "node:test";
import assert from "node:assert/strict";
import { safeUrl, publicAddress, fetchPublic } from "./safe-fetch";
import { membershipState } from "./billing";
import { publicationErrors, validateEvidence, type Revision } from "./projects";

test("SSRF URL policy blocks private, metadata, credential and non-HTTPS targets",()=>{
  for(const url of ["http://example.com","https://127.0.0.1","https://169.254.169.254","https://10.0.0.1","https://[::1]","https://localhost","https://example.com:444","https://user:pass@example.com"])
    assert.throws(()=>safeUrl(url));
  assert.equal(safeUrl("https://example.org/project#section").toString(),"https://example.org/project");
});
test("address policy blocks IPv4, IPv6 and mapped private addresses",()=>{
  for(const address of ["127.0.0.1","10.1.1.1","172.16.0.1","192.168.1.1","169.254.169.254","::1","fc00::1","::ffff:127.0.0.1","0.0.0.0","224.0.0.1"])
    assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress("8.8.8.8"),true);
});
test("canceled, expired, failed and expired trial memberships fail closed",()=>{
  const future=new Date(Date.now()+86400000).toISOString();
  const past=new Date(Date.now()-86400000).toISOString();
  assert.equal(membershipState({status:"active",valid:true,renewal_period_end:future}).active,true);
  for(const m of [
    {status:"canceled",renewal_period_end:future},
    {status:"past_due",renewal_period_end:future},
    {status:"trialing",renewal_period_end:past},
    {status:"active",renewal_period_end:future,cancel_at_period_end:true},
    {status:"active",valid:false,renewal_period_end:future},
    {status:"active"},
  ])assert.equal(membershipState(m).active,false);
});
test("unsupported claims and dates are rejected",()=>{
  const source="SAMPLE fixture only. Test project. 2026-01-01: 20 sample units were documented.";
  const quote="2026-01-01: 20 sample units were documented.";
  const revision:Revision={title:"Test project",overview:"20 sample units were documented.",cause:"Testing",locationName:"",latitude:null,longitude:null,
    claims:[{id:"c1",text:quote,quote,sourceUrl:"https://example.org/",label:"Organization Reported",reviews:[]}],
    statistics:[{id:"s1",claimId:"c1",label:"sample units",value:"20",unit:"units",quote,sourceUrl:"https://example.org/",asOf:"2026-01-01"}],updates:[],media:[]};
  assert.doesNotThrow(()=>validateEvidence(revision,source,"https://example.org/"));
  assert.throws(()=>validateEvidence({...revision,claims:[{...revision.claims[0]!,text:"Invented claim"}]},source,"https://example.org/"));
  assert.throws(()=>validateEvidence({...revision,statistics:[{...revision.statistics[0]!,value:"2000"}]},source,"https://example.org/"));
  assert.throws(()=>validateEvidence({...revision,statistics:[{...revision.statistics[0]!,asOf:"2026-09-01"}]},source,"https://example.org/"));
});
test("missing evidence and unapproved media prevent publication",()=>{
  const errors=publicationErrors({title:"",overview:"",cause:"",locationName:"",latitude:null,longitude:null,claims:[],media:[{permissionStatus:"pending"}]} as any);
  assert.equal(errors.length,4);
});
test("inaccessible source produces an error rather than a success",async()=>{
  await assert.rejects(fetchPublic("https://nujli-source-does-not-exist.invalid/project"));
});
