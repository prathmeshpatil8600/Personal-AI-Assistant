import { db } from "hatchable";
import { exchangeGithubCode,encryptGithubSecret } from "../../lib/github-oauth.js";
export const access="member"; export const methods=["GET"];
export default async function(req,res){
 const code=String(req.query?.code||"");const state=String(req.query?.state||"");
 if(!code||!state)return res.status(400).send("Missing GitHub OAuth code or state.");
 const s=(await db.query("SELECT * FROM github_oauth_states WHERE state=$1 AND user_id=$2 AND expires_at>now() LIMIT 1",[state,req.member.id])).rows[0];
 if(!s)return res.status(400).send("GitHub OAuth state is invalid or expired.");
 try{
  const token=await exchangeGithubCode({code,redirectUri:s.redirect_uri});
  if(!token.access_token)throw new Error("GitHub did not return an access token.");
  const access=await encryptGithubSecret(token.access_token);let refreshCipher=null,refreshIv=null;
  if(token.refresh_token){const r=await encryptGithubSecret(token.refresh_token);refreshCipher=r.ciphertext;refreshIv=r.iv}
  const profileRes=await fetch("https://api.github.com/user",{headers:{Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2026-03-10",Authorization:"Bearer "+token.access_token}});const profile=await profileRes.json().catch(()=>({}));if(!profileRes.ok)throw new Error(profile?.message||"Unable to read GitHub profile.");
  const accessExp=token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000):null;const refreshExp=token.refresh_token_expires_in?new Date(Date.now()+Number(token.refresh_token_expires_in)*1000):null;
  await db.query(`INSERT INTO github_connections(user_id,github_user_id,login,encrypted_access_token,access_token_iv,encrypted_refresh_token,refresh_token_iv,access_token_expires_at,refresh_token_expires_at,status,last_error)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'CONNECTED',NULL)
   ON CONFLICT(user_id) DO UPDATE SET github_user_id=EXCLUDED.github_user_id,login=EXCLUDED.login,encrypted_access_token=EXCLUDED.encrypted_access_token,access_token_iv=EXCLUDED.access_token_iv,encrypted_refresh_token=COALESCE(EXCLUDED.encrypted_refresh_token,github_connections.encrypted_refresh_token),refresh_token_iv=COALESCE(EXCLUDED.refresh_token_iv,github_connections.refresh_token_iv),access_token_expires_at=EXCLUDED.access_token_expires_at,refresh_token_expires_at=COALESCE(EXCLUDED.refresh_token_expires_at,github_connections.refresh_token_expires_at),status='CONNECTED',last_error=NULL,updated_at=now()`,[req.member.id,String(profile.id||""),profile.login||"",access.ciphertext,access.iv,refreshCipher,refreshIv,accessExp,refreshExp]);
  const conn=(await db.query(`INSERT INTO mcp_connections(user_id,provider,server_name,server_url,auth_type,status,enabled,scopes,metadata,last_checked_at,last_success_at)
   VALUES($1,'github','github_app','https://api.github.com','GITHUB_APP','CONNECTED',true,'["metadata:read","contents:read","issues:write","pull_requests:read"]'::jsonb,$2::jsonb,now(),now())
   ON CONFLICT(user_id,provider,server_name) DO UPDATE SET status='CONNECTED',enabled=true,metadata=EXCLUDED.metadata,last_checked_at=now(),last_success_at=now(),last_error=NULL,updated_at=now() RETURNING id`,[req.member.id,JSON.stringify({login:profile.login||"",github_user_id:String(profile.id||"")})])).rows[0];
  for(const [name,desc,risk] of [["github_list_repositories","List repositories available through the connected GitHub App.","READ"],["github_list_issues","List issues and pull requests for a repository.","READ"],["github_get_repository_content","Read repository file/directory metadata and file content when permitted.","READ"],["github_create_issue","Create a GitHub issue after explicit approval.","SENSITIVE"],["github_add_issue_comment","Add a comment to a GitHub issue or pull request after explicit approval.","SENSITIVE"]]){
   await db.query(`INSERT INTO mcp_tool_registry(user_id,connection_id,tool_name,provider,description,risk_level,enabled,metadata)
    VALUES($1,$2,$3,'github',$4,$5,true,'{}'::jsonb)
    ON CONFLICT(user_id,provider,tool_name) DO UPDATE SET connection_id=EXCLUDED.connection_id,description=EXCLUDED.description,risk_level=EXCLUDED.risk_level,enabled=true,last_seen_at=now(),updated_at=now()`,[req.member.id,conn.id,name,desc,risk]);
  }
  await db.query("DELETE FROM github_oauth_states WHERE state=$1",[state]);
  res.send("GitHub connected successfully. You can close this window and return to SecondBrain.");
 }catch(e){await db.query("DELETE FROM github_oauth_states WHERE state=$1",[state]);res.status(500).send("GitHub connection failed: "+String(e.message||e).slice(0,500))}
}