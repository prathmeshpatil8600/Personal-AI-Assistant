import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
  const {rows}=await db.query("SELECT preferred_language,response_style,theme,timezone FROM user_preferences WHERE user_id=$1 LIMIT 1",[req.member.id]);
  res.json(rows[0]||{preferred_language:"English",response_style:"concise",theme:"system",timezone:"UTC"});
}