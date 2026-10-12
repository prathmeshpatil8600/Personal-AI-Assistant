import { db } from "hatchable";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const userId=req.user.id, now=new Date(), horizon=new Date(now); horizon.setDate(horizon.getDate()+7);
 const {rows}=await db.query("SELECT id,title,description,priority,status,due_at FROM tasks WHERE user_id=$1 AND status NOT IN ('COMPLETED','CANCELLED') AND (due_at IS NULL OR due_at <= $2) ORDER BY due_at NULLS LAST,created_at",[userId,horizon]);
 const score=t=>{let s={URGENT:100,HIGH:70,MEDIUM:40,LOW:20}[t.priority]||20;if(t.due_at){const d=new Date(t.due_at);if(d<now)s+=60;else if(d.toDateString()===now.toDateString())s+=40;else if((d-now)<172800000)s+=25;}return s};
 const plan=rows.map(t=>({...t,focus_score:score(t)})).sort((a,b)=>b.focus_score-a.focus_score).slice(0,10);
 res.json({generated_at:now.toISOString(),horizon_days:7,plan});
}