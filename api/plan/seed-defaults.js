import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];

const plans=[
 {code:"FREE",name:"Free",units:200,entitlements:{chat:true,documents:true,max_documents:3,max_memory_items:25,google_integration:false,github_integration:false,scheduled_briefings:false,advanced_automation:false,premium_models:false},platform:{api_access:false,api_daily_requests:0}},
 {code:"PLUS",name:"Plus",units:2000,entitlements:{chat:true,documents:true,max_documents:50,max_memory_items:250,google_integration:true,github_integration:true,scheduled_briefings:true,advanced_automation:false,premium_models:false},platform:{api_access:false,api_daily_requests:0}},
 {code:"PRO",name:"Pro",units:10000,entitlements:{chat:true,documents:true,max_documents:250,max_memory_items:1000,google_integration:true,github_integration:true,scheduled_briefings:true,advanced_automation:true,premium_models:true},platform:{api_access:true,api_daily_requests:1000}}
];

export default async function(req,res){
 let created=0,existing=0;
 for(const p of plans){
  const row=(await db.query("SELECT code FROM plan_definitions WHERE code=$1",[p.code])).rows[0];
  if(row){existing++;continue}
  await db.query(
   "INSERT INTO plan_definitions(code,display_name,monthly_units,entitlements,active,platform_entitlements) VALUES($1,$2,$3,$4::jsonb,true,$5::jsonb)",
   [p.code,p.name,p.units,JSON.stringify(p.entitlements),JSON.stringify(p.platform)]
  );
  created++;
 }
 res.json({ok:true,created,existing,total:plans.length});
}