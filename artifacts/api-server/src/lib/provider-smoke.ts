import { extractWithAI } from "./generation";
import { fetchPublic, extractSource } from "./safe-fetch";
import { pool } from "@workspace/db";
async function main(){
  try {
    const source=await fetchPublic("https://example.org/");
    const parsed=extractSource(source.html,source.url);
    process.stdout.write(JSON.stringify({check:"public-source-fetch",status:parsed.text.length?"PASS":"FAIL"})+"\n");
  }catch{process.stdout.write(JSON.stringify({check:"public-source-fetch",status:"FAIL"})+"\n");}
  try{
    const result=await extractWithAI("SAMPLE TEST FIXTURE. Not a real humanitarian project. Test Organization publishes this test only. Test project overview. On 2026-01-01, 20 sample units were documented. This is synthetic test data, not donor evidence. No geographic location or media is documented.");
    process.stdout.write(JSON.stringify({check:"genuine-AI-structured-response",status:result.title?"PASS":"FAIL",savedToDatabase:false})+"\n");
  }catch(e){process.stdout.write(JSON.stringify({check:"genuine-AI-structured-response",status:"FAIL",errorType:(e as any)?.name,httpStatus:(e as any)?.status,issues:(e as any)?.issues,savedToDatabase:false})+"\n");}
  await pool.end();
}
void main();
