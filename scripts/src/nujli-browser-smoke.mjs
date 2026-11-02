import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage();
const base=process.env.REPLIT_DEV_DOMAIN?`https://${process.env.REPLIT_DEV_DOMAIN}`:"http://localhost:80";
const results=[];
for(const width of [375,430,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of ["/","/choose","/explore","/visual-build","/billing"]){
    try{
      await page.goto(base+route,{waitUntil:"networkidle",timeout:45000});
      await page.waitForTimeout(500);
      assert.equal(await page.getByText("Something went wrong",{exact:true}).count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),true);
      if(route==="/")assert.equal(await page.getByRole("heading",{name:"Prove that you deserve more donations."}).count(),1);
      results.push({check:`${route} at ${width}`,status:"PASS"});
    }catch(e){results.push({check:`${route} at ${width}`,status:"FAIL",reason:e.message.slice(0,150)});}
  }
}
try{
  await page.goto(base+"/");
  await page.getByRole("link",{name:"Show the Evidence",exact:false}).first().click();
  await page.waitForURL("**/choose");
  await page.getByRole("link",{name:/I'm a Donor|I’m a Donor/}).click();
  await page.waitForURL("**/explore");
  await page.getByRole("button",{name:"Zoom in",exact:true}).click();
  await page.getByRole("button",{name:"Reset view",exact:true}).click();
  results.push({check:"landing role donor navigation and map controls",status:"PASS"});
}catch(e){results.push({check:"landing role donor navigation and map controls",status:"FAIL",reason:e.message.slice(0,150)});}
try{
  await page.goto(base+"/visual-build");
  await page.getByTestId("slider-simulation").fill("100");
  assert.equal(await page.getByTestId("slider-simulation").inputValue(),"100");
  await page.getByTestId("slider-simulation").fill("0");
  assert.equal(await page.getByTestId("slider-simulation").inputValue(),"0");
  results.push({check:"Visual Build funding slider 0–100",status:"PASS"});
}catch(e){results.push({check:"Visual Build funding slider 0–100",status:"FAIL",reason:e.message.slice(0,150)});}
console.log(JSON.stringify(results,null,2));
await browser.close();
if(results.some(r=>r.status==="FAIL"))process.exitCode=1;
