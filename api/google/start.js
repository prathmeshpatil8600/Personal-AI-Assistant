import { db } from "hatchable";
import { randomState, authorizationUrl } from "../../lib/google-oauth.js";
export const access="member"; export const methods=["GET"];
export default async function(req,res){
 const proto=(req.headers?.["x-forwarded-proto"]||"https").split(",")[0].trim();
 const host=(req.headers?.["x-forwarded-host"]||req.headers?.host||"").split(",")[0].trim();
 if(!host)return res.status(400).json({error:"Unable to determine callback host."});
 const redirectUri=proto+"://"+host+"/api/google/callback";
 const state=randomState();
 await db.query("DELETE FROM google_oauth_states WHERE user_id=$1 OR expires_at<=now()",[req.member.id]);
 await db.query("INSERT INTO google_oauth_states(state,user_id,redirect_uri) VALUES($1,$2,$3)",[state,req.member.id,redirectUri]);
 res.json({authorization_url:authorizationUrl({state,redirectUri}),redirect_uri:redirectUri});
}