import {test} from "node:test";
import assert from "node:assert/strict";
import {hasDocumentedDate,validateEvidence,type Revision} from "./projects";
import {isWhopCheckoutUrl,membershipState} from "./billing";
import {SubmitProjectBody} from "@workspace/api-zod";

test("checkout validates the exact Whop domain boundary and HTTPS",()=>{
  for(const url of ["https://whop.com/checkout/x","https://checkout.whop.com/x"])assert.equal(isWhopCheckoutUrl(url),true);
  for(const url of ["https://evilwhop.com","http://whop.com","https://whop.com.evil.example","https://user:pass@whop.com",null])assert.equal(isWhopCheckoutUrl(url),false);
});
test("submission requires permission confirmation and limits additional sources",()=>{
  assert.equal(SubmitProjectBody.safeParse({sourceUrl:"https://example.org"}).success,false);
  assert.equal(SubmitProjectBody.safeParse({sourceUrl:"https://example.org",permissionsConfirmed:true,extraSourceUrls:Array(6).fill("https://example.org")}).success,false);
  assert.equal(SubmitProjectBody.safeParse({sourceUrl:"https://example.org",permissionsConfirmed:true}).success,true);
});
test("literal dated evidence supports ISO and named months but not guessed dates",()=>{
  for(const quote of ["Reported on September 15, 2025.","Reported on 15 September 2025.","Reported on 2025-09-15."])assert.equal(hasDocumentedDate(quote,"2025-09-15"),true);
  assert.equal(hasDocumentedDate("Reported during September 2025.","2025-09-15"),false);
  assert.equal(hasDocumentedDate("2025-02-31","2025-02-31"),false);
  assert.equal(hasDocumentedDate("15 September 2025","2025-09-16"),false);
});
test("supplementary evidence cannot be falsely attributed to the primary source",()=>{
  const primary="SAMPLE project describes its purpose.",extra="SAMPLE 10 items documented on 2025-09-15.";
  const r:Revision={title:"SAMPLE project",overview:primary,cause:"",locationName:"",latitude:null,longitude:null,claims:[{id:"sample-claim",text:extra,quote:extra,sourceUrl:"https://example.org/extra",label:"Organization Reported",reviews:[]}],statistics:[],updates:[],media:[]};
  assert.doesNotThrow(()=>validateEvidence(r,primary,"https://example.org/main",{"https://example.org/extra":extra}));
  assert.throws(()=>validateEvidence({...r,claims:r.claims.map(c=>({...c,sourceUrl:"https://example.org/main"}))},primary,"https://example.org/main",{"https://example.org/extra":extra}));
});
test("incomplete membership and expired trial never unlock access",()=>{
  for(const m of [{status:"active"},{status:"trialing",renewal_period_end:"2020-01-01"},{status:"active",valid:false,renewal_period_end:"2099-01-01"}])assert.equal(membershipState(m).active,false);
});
