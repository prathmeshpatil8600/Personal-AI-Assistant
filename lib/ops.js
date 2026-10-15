import { db } from "hatchable";

export async function markJobStarted(jobKey){
  await db.query(`
    INSERT INTO operational_job_heartbeats(job_key,last_started_at,updated_at)
    VALUES($1,now(),now())
    ON CONFLICT(job_key) DO UPDATE SET last_started_at=now(),updated_at=now()
  `,[jobKey]);
}

export async function markJobSucceeded(jobKey,result={}){
  await db.query(`
    INSERT INTO operational_job_heartbeats(job_key,last_started_at,last_succeeded_at,consecutive_failures,last_result,updated_at)
    VALUES($1,now(),now(),0,$2::jsonb,now())
    ON CONFLICT(job_key) DO UPDATE SET last_succeeded_at=now(),consecutive_failures=0,last_error=NULL,last_result=$2::jsonb,updated_at=now()
  `,[jobKey,JSON.stringify(result||{})]);
  await db.query("UPDATE operational_incidents SET resolved_at=now() WHERE source='scheduler' AND incident_key=$1 AND resolved_at IS NULL",["job:"+jobKey]).catch(()=>{});
}

export async function markJobFailed(jobKey,error){
  const message=String(error?.message||error||"Unknown job failure").slice(0,1000);
  await db.query(`
    INSERT INTO operational_job_heartbeats(job_key,last_started_at,last_failed_at,consecutive_failures,last_error,updated_at)
    VALUES($1,now(),now(),1,$2,now())
    ON CONFLICT(job_key) DO UPDATE SET last_failed_at=now(),consecutive_failures=operational_job_heartbeats.consecutive_failures+1,last_error=$2,updated_at=now()
  `,[jobKey,message]);
  await db.query(`
    INSERT INTO operational_incidents(source,severity,incident_key,message,metadata)
    VALUES('scheduler','ERROR',$1,$2,$3::jsonb)
  `,["job:"+jobKey,message,JSON.stringify({job_key:jobKey})]).catch(()=>{});
}

export async function runTrackedJob(jobKey,fn){
  await markJobStarted(jobKey);
  try{
    const result=await fn();
    await markJobSucceeded(jobKey,result);
    return result;
  }catch(error){
    await markJobFailed(jobKey,error).catch(()=>{});
    throw error;
  }
}