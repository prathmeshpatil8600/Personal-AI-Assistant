import { db } from "hatchable";
export const access="public";
export const methods=["GET"];
export default async function(req,res){
 const started=Date.now();
 try{
  await db.query("SELECT 1 AS ok");
  res.json({ok:true,service:"secondbrain",database:"ok",timestamp:new Date().toISOString(),latency_ms:Date.now()-started});
 }catch(error){
  res.status(503).json({ok:false,service:"secondbrain",database:"unavailable",timestamp:new Date().toISOString()});
 }
}