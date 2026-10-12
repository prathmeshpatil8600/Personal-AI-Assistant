import { db } from "hatchable";
import { generateText } from "../../lib/ai-router.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const uid=req.user.id;
 const [stats,tasks,goals]=await Promise.all([
  db.query("SELECT COALESCE(SUM(tasks_created),0)::int tasks_created,COALESCE(SUM(tasks_completed),0)::int tasks_completed,COALESCE(SUM(tasks_overdue),0)::int tasks_overdue,COALESCE(SUM(notes_created),0)::int notes_created,COALESCE(SUM(events_count),0)::int events_count FROM productivity_daily WHERE user_id=$1 AND stat_date>=CURRENT_DATE-6",[uid]),
  db.query("SELECT title,status,priority,due_at FROM tasks WHERE user_id=$1 AND created_at>=now()-interval '7 days' ORDER BY created_at DESC LIMIT 20",[uid]),
  db.query("SELECT title,progress_percent,status,target_date FROM goals WHERE user_id=$1 AND status <> 'ARCHIVED' ORDER BY target_date NULLS LAST",[uid])
 ]);
 const data={stats:stats.rows[0],tasks:tasks.rows,goals:goals.rows};
 let review={ai_available:false,summary:"Weekly activity summary",sections:[
  {title:"Progress",text:data.stats.tasks_completed+" tasks completed and "+data.stats.tasks_created+" created."},
  {title:"Attention",text:data.stats.tasks_overdue+" tasks are overdue. Review them before adding more work."},
  {title:"Goals",text:data.goals.length?data.goals.map(g=>g.title+" ("+g.progress_percent+"%)").join(", "):"No active goals yet."}
 ]};
 try{
  const r=await generateText({model:"google.gemini",purpose:"weekly_review",userId:uid,maxSteps:2,responseStyle:"concise",cacheTtlSeconds:900,system:"Review the supplied personal productivity data only. Return JSON object with summary and sections, where sections is an array of title/text objects. Be concise and actionable.",prompt:JSON.stringify(data)});
  const parsed=JSON.parse(r.text.replace(/^[\\s\\S]*?\{/,"{").replace(/\}[\\s\\S]*$/,"}"));
  if(parsed?.sections)review={...parsed,ai_available:true,provider:r.provider};
 }catch(e){}
 res.json({review,data});
}