import { db } from "hatchable";
import { randomGithubState,githubAuthorizationUrl } from "../../lib/github-oauth.js";
export const access="member"; export const methods=["GET"];
export default async function(req,res){
 const host=req.headers?.host||"personal-ai-5c3q-draft.hatchable.site";
 const proto=String(req.headers?.['x-forwarded-proto']||"https").split(',')[0].trim()||"https";
 const redirectUri=proto+"://"+host+"/api/github/callback";
 const missing=["GITHUB_CLIENT_ID","GITHUB_CLIENT_SECRET","GITHUB_OAUTH_ENCRYPTION_KEY"].filter(k=>!process.env[k]);
 if(missing.length)return res.status(503).json({error:"GitHub App OAuth is not configured yet.",setup_required:missing,redirect_uri:redirectUri});
 const state=randomGithubState();
 await db.query("DELETE FROM github_oauth_states WHERE user_id=$1 OR expires_at<=now()",[req.member.id]);
 await db.query("INSERT INTO github_oauth_states(state,user_id,redirect_uri) VALUES($1,$2,$3)",[state,req.member.id,redirectUri]);
 res.json({authorization_url:githubAuthorizationUrl({state,redirectUri}),redirect_uri:redirectUri});
}