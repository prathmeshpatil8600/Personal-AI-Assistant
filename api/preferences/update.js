import { db } from "hatchable";
export const access="member";
export const methods=["POST"];
export default async function(req,res){
  const b=req.body||{};
  const language=String(b.preferred_language||"English").slice(0,40);
  const style=String(b.response_style||"concise").slice(0,40);
  const theme=String(b.theme||"system").slice(0,20);
  const timezone=String(b.timezone||"UTC").slice(0,80);
  try{new Intl.DateTimeFormat("en-US",{timeZone:timezone}).format(new Date())}catch{return res.status(400).json({error:"Invalid timezone."})}
  const {rows}=await db.query(`
    INSERT INTO user_preferences(user_id,preferred_language,response_style,theme,timezone)
    VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(user_id) DO UPDATE SET preferred_language=EXCLUDED.preferred_language,response_style=EXCLUDED.response_style,theme=EXCLUDED.theme,timezone=EXCLUDED.timezone,updated_at=now()
    RETURNING preferred_language,response_style,theme,timezone
  `,[req.member.id,language,style,theme,timezone]);
  res.json(rows[0]);
}