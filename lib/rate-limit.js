import { db } from "hatchable";

export async function enforceUserRateLimit(userId,key,{limit=30,windowSeconds=60}={}){
  const safeLimit=Math.max(1,Math.min(10000,Number(limit)||30));
  const safeWindow=Math.max(10,Math.min(86400,Number(windowSeconds)||60));
  const nowSec=Math.floor(Date.now()/1000);
  const bucketSec=Math.floor(nowSec/safeWindow)*safeWindow;
  const windowStart=new Date(bucketSec*1000);
  const row=(await db.query(`
    INSERT INTO user_rate_limits(user_id,bucket_key,window_start,request_count)
    VALUES($1,$2,$3,1)
    ON CONFLICT(user_id,bucket_key,window_start)
    DO UPDATE SET request_count=user_rate_limits.request_count+1
    RETURNING request_count
  `,[String(userId),String(key),windowStart])).rows[0];
  const count=Number(row?.request_count||0);
  return {
    ok:count<=safeLimit,
    limit:safeLimit,
    count,
    retry_after_seconds:Math.max(1,bucketSec+safeWindow-nowSec)
  };
}

export function rateLimitError(res,state){
  if(state?.retry_after_seconds)res.setHeader?.("Retry-After",String(state.retry_after_seconds));
  return res.status(429).json({
    error:"rate_limit",
    message:"Too many requests. Please try again shortly.",
    limit:state?.limit||null,
    retry_after_seconds:state?.retry_after_seconds||null
  });
}