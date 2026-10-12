import { config } from "hatchable";
import { priceInr } from "./commercial-pricing.js";

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

function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
export async function verifyRazorpayPaymentSignature({orderId,paymentId,signature}){
 const {keySecret}=await credentials();
 if(!orderId||!paymentId||!signature)return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(keySecret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(String(orderId)+"|"+String(paymentId))));
 const expected=hex(sig),actual=String(signature).toLowerCase();
 if(expected.length!==actual.length)return false;
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);
 return diff===0;
}
export function razorpayPlanEnv(planCode,cycle){
 const key="RAZORPAY_PLAN_"+planCode+"_"+cycle;
 return {key,value:process.env[key]||null};
}

export async function validateRazorpayPlan(planCode,cycle,planId){
 const expectedInr=priceInr(planCode,cycle);
 if(expectedInr===null)throw new Error("Commercial price is not configured.");
 const entity=await razorpayRequest("/plans/"+encodeURIComponent(planId));
 const amount=Number(entity?.item?.amount),currency=String(entity?.item?.currency||"").toUpperCase();
 const period=String(entity?.period||"").toLowerCase(),interval=Number(entity?.interval||1);
 const expectedPeriod=String(cycle).toUpperCase()==="ANNUAL"?"yearly":"monthly";
 const ok=amount===Math.round(expectedInr*100)&&currency==="INR"&&period===expectedPeriod&&interval===1;
 return {ok,expected:{amount_paise:Math.round(expectedInr*100),currency:"INR",period:expectedPeriod,interval:1},actual:{amount_paise:amount,currency,period,interval}};
}