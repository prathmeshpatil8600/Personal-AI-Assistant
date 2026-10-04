import { db } from "hatchable";
import { randomState, authorizationUrl } from "../../lib/google-oauth.js";
export const access="member"; export const methods=["GET"];
export default async function(req,res){
 const proto=(req.headers?.["x-forwarded-proto"]||"https").split(",")[0].trim();
 const host=(req.headers?.["x-forwarded-host"]||req.headers?.host||"personal-ai-5c3q-draft.hatchable.site").split(",")[0].trim();
 const redirectUri=proto+"://"+host+"/api/google/callback";
 if(!process.env.GOOGLE_OAUTH_CLIENT_ID||!process.env.GOOGLE_OAUTH_CLIENT_SECRET||!process.env.GOOGLE_OAUTH_ENCRYPTION_KEY){
  return res.status(503).json({error:"Google OAuth is not configured yet.",setup_required:["GOOGLE_OAUTH_CLIENT_ID","GOOGLE_OAUTH_CLIENT_SECRET","GOOGLE_OAUTH_ENCRYPTION_KEY"],redirect_uri:redirectUri});
 }
 const state=randomState();
 await db.query("DELETE FROM google_oauth_states WHERE user_id=$1 OR expires_at<=now()",[req.member.id]);
 await db.query("INSERT INTO google_oauth_states(state,user_id,redirect_uri) VALUES($1,$2,$3)",[state,req.member.id,redirectUri]);
 res.json({authorization_url:authorizationUrl({state,redirectUri}),redirect_uri:redirectUri});
}