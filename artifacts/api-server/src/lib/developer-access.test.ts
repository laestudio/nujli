import test from "node:test";
import assert from "node:assert/strict";
import { eligibleDemoUser } from "./developer-access";

test("production demo requires the configured verified primary owner email", () => {
  const priorMode = process.env.NODE_ENV;
  const priorOwner = process.env.NUJLI_DEMO_OWNER_EMAIL;
  try {
    process.env.NODE_ENV = "production";
    process.env.NUJLI_DEMO_OWNER_EMAIL = "owner@example.test";
    const owner = {
      publicMetadata: {} as Record<string, unknown>, primaryEmailAddressId: "email-owner",
      emailAddresses: [{id:"email-owner",emailAddress:"owner@example.test",verification:{status:"verified"}}],
    };
    assert.equal(eligibleDemoUser(owner), true);
    assert.equal(eligibleDemoUser({...owner,publicMetadata:{role:"reviewer"}}), false);
    assert.equal(eligibleDemoUser({...owner,primaryEmailAddressId:null}), false);
    assert.equal(eligibleDemoUser({...owner,emailAddresses:[{...owner.emailAddresses[0],verification:{status:"unverified"}}]}), false);
    assert.equal(eligibleDemoUser({...owner,publicMetadata:{developerAccess:true},emailAddresses:[{...owner.emailAddresses[0],emailAddress:"someone-else@example.test"}]}), false);
    delete process.env.NUJLI_DEMO_OWNER_EMAIL;
    assert.equal(eligibleDemoUser({...owner,publicMetadata:{developerAccess:true}}), false);
  } finally {
    if (priorMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorMode;
    if (priorOwner === undefined) delete process.env.NUJLI_DEMO_OWNER_EMAIL; else process.env.NUJLI_DEMO_OWNER_EMAIL = priorOwner;
  }
});
