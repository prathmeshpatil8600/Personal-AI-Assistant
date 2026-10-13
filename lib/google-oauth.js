import { db } from "hatchable";

export const GOOGLE_SCOPES=[
 "openid",
 "email",
 "https://www.googleapis.com/auth/gmail.readonly",
 "https://www.googleapis.com/auth/gmail.send",
 "https://www.googleapis.com/auth/calendar.events",
 "https://www.googleapis.com/auth/drive.metadata.readonly"
];

function requireSecret(name){const v=process.env[name];if(!v)throw new Error(name+" is not configured.");return v}
function bytesToB64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}
function b64ToBytes(s){const raw=atob(s);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function key(){const material=new TextEncoder().encode(requireSecret("GOOGLE_OAUTH_ENCRYPTION_KEY"));const digest=await crypto.subtle.digest("SHA-256",material);return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"])}
export async function encryptSecret(value){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(value));return{ciphertext:bytesToB64(new Uint8Array(encrypted)),iv:bytesToB64(iv)}}
export async function decryptSecret(ciphertext,iv){const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64ToBytes(iv)},await key(),b64ToBytes(ciphertext));return new TextDecoder().decode(plain)}
export function randomState(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
export function authorizationUrl({state,redirectUri}){const q=new URLSearchParams({client_id:requireSecret("GOOGLE_OAUTH_CLIENT_ID"),redirect_uri:redirectUri,response_type:"code",scope:GOOGLE_SCOPES.join(" "),access_type:"offline",include_granted_scopes:"true",prompt:"consent",state});return "https://accounts.google.com/o/oauth2/v2/auth?"+q.toString()}
export async function exchangeCode({code,redirectUri}){const body=new URLSearchParams({code,client_id:requireSecret("GOOGLE_OAUTH_CLIENT_ID"),client_secret:requireSecret("GOOGLE_OAUTH_CLIENT_SECRET"),redirect_uri:redirectUri,grant_type:"authorization_code"});const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:body.toString()});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error_description||data?.error||("Google token exchange failed ("+r.status+")"));return data}
export async function refreshAccessToken(userId){const c=(await db.query("SELECT * FROM google_connections WHERE user_id=$1 AND status='CONNECTED' LIMIT 1",[userId])).rows[0];if(!c)throw new Error("Google account is not connected.");const refresh=await decryptSecret(c.encrypted_refresh_token,c.token_iv);const body=new URLSearchParams({client_id:requireSecret("GOOGLE_OAUTH_CLIENT_ID"),client_secret:requireSecret("GOOGLE_OAUTH_CLIENT_SECRET"),refresh_token:refresh,grant_type:"refresh_token"});const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:body.toString()});const data=await r.json().catch(()=>({}));if(!r.ok){await db.query("UPDATE google_connections SET last_error=$1,updated_at=now() WHERE user_id=$2",[String(data?.error_description||data?.error||"Token refresh failed").slice(0,500),userId]);throw new Error(data?.error_description||data?.error||"Google token refresh failed.")}await db.query("UPDATE google_connections SET last_used_at=now(),last_error=NULL,updated_at=now() WHERE user_id=$1",[userId]);return data.access_token}
export async function googleFetch(userId,url,options={}){const token=await refreshAccessToken(userId);const headers={...(options.headers||{}),Authorization:"Bearer "+token};const r=await fetch(url,{...options,headers});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error?.message||("Google API request failed ("+r.status+")"));return data}

export async function revokeGoogleAuthorization(userId){
 const row=(await db.query("SELECT encrypted_refresh_token,token_iv FROM google_connections WHERE user_id=$1 LIMIT 1",[userId])).rows[0];
 if(!row)return {revoked:false,reason:"not_connected"};
 const token=await decryptSecret(row.encrypted_refresh_token,row.token_iv);
 const body=new URLSearchParams({token});
 const r=await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:body.toString()});
 if(!r.ok&&r.status!==400)throw new Error("Google authorization revocation failed ("+r.status+").");
 return {revoked:r.ok||r.status===400};
}