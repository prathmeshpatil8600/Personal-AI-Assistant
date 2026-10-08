import { db } from "hatchable";
import { generateText } from "../../lib/ai-router.js";
import { requireFeature,requireUnits } from "../../lib/entitlements.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 if(req.headers["x-hatchable-trigger"]!=="cron")return res.status(403).json({error:"Scheduler only"});
 const users=(await db.query("SELECT DISTINCT user_id FROM goals UNION SELECT DISTINCT user_id FROM tasks")).rows;
 let created=0;
 for(const u of users){
  const featureGate=await requireFeature(u.user_id,"scheduled_briefings");const unitGate=await requireUnits(u.user_id,1);if(!featureGate.ok||!unitGate.ok)continue;
  const s=(await db.query("SELECT COALESCE(SUM(tasks_completed),0)::int completed,COALESCE(SUM(tasks_overdue),0)::int overdue FROM productivity_daily WHERE user_id=$1 AND stat_date>=CURRENT_DATE-6",[u.user_id])).rows[0];
  let message="Weekly review: "+s.completed+" tasks completed; "+s.overdue+" overdue.";
  try{
   const r=await generateText({model:"google.gemini",purpose:"weekly_briefing_job",userId:u.user_id,maxSteps:2,system:"Write one concise weekly productivity notification from supplied stats only.",prompt:JSON.stringify(s)});
   if(r.text)message=r.text.trim();
  }catch(e){}
  await db.query("INSERT INTO assistant_notifications(user_id,type,title,message,source_key) VALUES($1,'WEEKLY_REVIEW','Weekly review',$2,$3) ON CONFLICT(user_id,source_key) DO UPDATE SET message=EXCLUDED.message,read_at=NULL",[u.user_id,message,"weekly-review:"+new Date().toISOString().slice(0,10)]);
  created++;
 }
 res.json({ok:true,users:created});
}