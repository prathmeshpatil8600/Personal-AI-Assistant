import { db } from "hatchable";
export const access="admin";
export const methods=["GET","POST"];
const meters=new Set(["ai_generation","tool_execution","document_ingest","embedding_query"]);
function text(v,max){const s=String(v??"").trim();return s?s.slice(0,max):null}
function rate(v){const n=Number(v??0);return Number.isSafeInteger(n)&&n>=0&&n<=1000000000000?n:null}
export default async function(req,res){
 if(req.method==="GET"){
  const rows=(await db.query("SELECT id,provider,meter_key,model,input_microusd_per_million,output_microusd_per_million,fixed_microusd_per_event,microusd_per_mb,microusd_per_item,active,effective_from,effective_to,created_at,updated_at FROM usage_rate_cards ORDER BY provider,meter_key,model NULLS FIRST,effective_from DESC")).rows;
  return res.json(rows);
 }
 const b=req.body||{},provider=text(b.provider,80),meter=text(b.meter_key,80),model=text(b.model,160);
 if(!provider||!meters.has(meter))return res.status(400).json({error:"Valid provider and meter_key are required."});
 const input=rate(b.input_microusd_per_million),output=rate(b.output_microusd_per_million),fixed=rate(b.fixed_microusd_per_event),perMb=rate(b.microusd_per_mb),perItem=rate(b.microusd_per_item);
 if([input,output,fixed,perMb,perItem].some(x=>x===null))return res.status(400).json({error:"Rate values must be safe non-negative integers."});
 const from=b.effective_from?new Date(b.effective_from):new Date();
 if(Number.isNaN(from.getTime()))return res.status(400).json({error:"effective_from is invalid."});
 await db.query("UPDATE usage_rate_cards SET active=false,effective_to=$1,updated_at=now() WHERE provider=$2 AND meter_key=$3 AND model IS NOT DISTINCT FROM $4 AND active=true AND effective_from < $1",[from,provider,meter,model]);
 const row=(await db.query(`
  INSERT INTO usage_rate_cards(provider,meter_key,model,input_microusd_per_million,output_microusd_per_million,fixed_microusd_per_event,microusd_per_mb,microusd_per_item,effective_from)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
  RETURNING id,provider,meter_key,model,input_microusd_per_million,output_microusd_per_million,fixed_microusd_per_event,microusd_per_mb,microusd_per_item,active,effective_from
 `,[provider,meter,model,input,output,fixed,perMb,perItem,from])).rows[0];
 res.status(201).json(row);
}