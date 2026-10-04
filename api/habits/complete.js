import { db } from "hatchable";
export const access="member";
export const methods=["POST"];
function localDate(timeZone){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const get=t=>parts.find(p=>p.type===t)?.value;
 return get("year")+"-"+get("month")+"-"+get("day");
}
function dayDiff(a,b){return Math.round((new Date(a+"T00:00:00Z")-new Date(b+"T00:00:00Z"))/86400000)}
export default async function(req,res){
 const {id}=req.body||{};if(!id)return res.status(400).json({error:"Habit id is required"});
 const h=(await db.query("SELECT * FROM habits WHERE id=$1 AND user_id=$2",[id,req.member.id])).rows[0];if(!h)return res.status(404).json({error:"Habit not found"});
 const pref=(await db.query("SELECT timezone FROM user_preferences WHERE user_id=$1",[req.member.id])).rows[0]||{timezone:"UTC"};
 const completedOn=localDate(pref.timezone||"UTC");
 const inserted=await db.query("INSERT INTO habit_completions(habit_id,user_id,completed_on) VALUES($1,$2,$3) ON CONFLICT(user_id,habit_id,completed_on) DO NOTHING RETURNING id",[id,req.member.id,completedOn]);
 const hist=await db.query("SELECT completed_on FROM habit_completions WHERE habit_id=$1 AND user_id=$2 ORDER BY completed_on DESC LIMIT 366",[id,req.member.id]);
 let streak=hist.rows.length?1:0;
 for(let i=1;i<hist.rows.length;i++){if(dayDiff(hist.rows[i-1].completed_on,hist.rows[i].completed_on)===1)streak++;else break}
 const {rows}=await db.query("UPDATE habits SET current_streak=$1,last_completed_at=CASE WHEN $2 THEN now() ELSE last_completed_at END,updated_at=now() WHERE id=$3 AND user_id=$4 RETURNING *",[streak,inserted.rowCount>0,id,req.member.id]);
 res.json({...rows[0],completed_today:true,new_completion:inserted.rowCount>0,completed_on:completedOn});
}