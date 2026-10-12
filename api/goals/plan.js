import { db } from "hatchable";
import { generateText } from "../../lib/ai-router.js";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const {id}=req.body||{}; if(!id)return res.status(400).json({error:"Goal id is required"});
 const g=(await db.query("SELECT * FROM goals WHERE id=$1 AND user_id=$2",[id,req.user.id])).rows[0];
 if(!g)return res.status(404).json({error:"Goal not found"});
 const fallback=[
  {title:"Define the outcome and success criteria",priority:"HIGH"},
  {title:"Break the goal into 2–3 concrete milestones",priority:"HIGH"},
  {title:"Complete the first milestone",priority:"MEDIUM"},
  {title:"Review progress and adjust the next steps",priority:"MEDIUM"}
 ];
 let tasks=fallback, aiAvailable=false, provider=null;
 try{
  const r=await generateText({
   model:"google.gemini",
   purpose:"goal_planning",
   userId:req.user.id,
   maxSteps:2,
   responseStyle:"concise",
   cacheTtlSeconds:900,
   system:"Create a short practical task plan for the user's goal. Return JSON array only with objects containing title and priority (HIGH, MEDIUM, LOW). Maximum 6 tasks.",
   prompt:JSON.stringify({title:g.title,description:g.description,category:g.category,target_date:g.target_date,progress:g.progress_percent})
  });
  const parsed=JSON.parse(r.text.replace(/^[\\s\\S]*?\[/,"[").replace(/\][\\s\\S]*$/," ]"));
  if(Array.isArray(parsed)&&parsed.length){tasks=parsed.slice(0,6);aiAvailable=true;provider=r.provider;}
 }catch(e){}
 res.json({goal:g,tasks,ai_available:aiAvailable,provider});
}