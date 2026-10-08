import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];
const plans=new Set(["FREE","PLUS","PRO"]);
const statuses=new Set(["ACTIVE","GRACE","PAUSED","CANCELLED"]);
export default async function(req,res){
 const b=req.body||{},userId=String(b.user_id||"").trim(),planCode=String(b.plan_code||"").toUpperCase(),status=String(b.status||"ACTIVE").toUpperCase();
 if(!userId||!plans.has(planCode)||!statuses.has(status))return res.status(400).json({error:"Valid user_id, plan_code and status are required."});
 const bonus=Number.parseInt(b.unit_bonus,10)||0;
 if(!Number.isSafeInteger(bonus)||bonus<0||bonus>1000000)return res.status(400).json({error:"unit_bonus must be between 0 and 1,000,000."});
 const row=(await db.query(`
  INSERT INTO user_plan_assignments(user_id,plan_code,status,period_start,period_end,unit_bonus,assigned_by)
  VALUES($1,$2,$3,date_trunc('month',now()),date_trunc('month',now())+interval '1 month',$4,$5)
  ON CONFLICT(user_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status=EXCLUDED.status,
    period_start=CASE WHEN user_plan_assignments.period_end<=now() THEN date_trunc('month',now()) ELSE user_plan_assignments.period_start END,
    period_end=CASE WHEN user_plan_assignments.period_end<=now() THEN date_trunc('month',now())+interval '1 month' ELSE user_plan_assignments.period_end END,
    unit_bonus=EXCLUDED.unit_bonus,assigned_by=EXCLUDED.assigned_by,updated_at=now()
  RETURNING user_id,plan_code,status,period_start,period_end,unit_bonus,updated_at
 `,[userId,planCode,status,bonus,req.member.id])).rows[0];
 res.json(row);
}