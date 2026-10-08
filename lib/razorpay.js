import { config } from "hatchable";

async function credentials(){
 const keyId=process.env.RAZORPAY_KEY_ID||await config.get("RAZORPAY_KEY_ID");
 const keySecret=process.env.RAZORPAY_KEY_SECRET||await config.get("RAZORPAY_KEY_SECRET");
 if(!keyId||!keySecret){const e=new Error("Razorpay is not configured.");e.code="BILLING_SETUP_REQUIRED";throw e}
 return {keyId,keySecret};
}
function authHeader(keyId,keySecret){return "Basic "+btoa(keyId+":"+keySecret)}

export async function razorpayRequest(path,{method="GET",body}={}){
 const {keyId,keySecret}=await credentials();
 const r=await fetch("https://api.razorpay.com/v1"+path,{method,headers:{Authorization:authHeader(keyId,keySecret),"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(data?.error?.description||data?.error?.reason||"Razorpay request failed.");e.status=r.status;throw e}
 return data;
}

export async function razorpayPublicKey(){const {keyId}=await credentials();return keyId}
export function razorpayPlanEnv(planCode,cycle){
 const key="RAZORPAY_PLAN_"+planCode+"_"+cycle;
 return {key,value:process.env[key]||null};
}