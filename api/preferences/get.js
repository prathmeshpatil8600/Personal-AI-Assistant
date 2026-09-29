import { db } from "hatchable";
export const access="member";
export const methods=["GET"];
export default async function(req,res){
  const {rows}=await db.query("SELECT preferred_language,response_style,theme FROM user_preferences LIMIT 1");
  res.json(rows[0]||{preferred_language:"English",response_style:"concise",theme:"system"});
}