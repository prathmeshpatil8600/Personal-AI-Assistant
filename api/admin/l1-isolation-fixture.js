import { db } from "hatchable";
export const access="admin";
export const methods=["POST","DELETE"];

export default async function(req,res){
 if(req.method==="DELETE"){
  await db.query("DELETE FROM tasks WHERE user_id=$1 AND title=$2",["l1-other-user","L1 foreign isolation task"]);
  await db.query("DELETE FROM organizations WHERE slug=$1",["l1-foreign-org"]);
  await db.query("DELETE FROM organizations WHERE slug=$1",["l1-isolation-test"]);
  await db.query("DELETE FROM conversations WHERE title=$1",["Show my tasks"]);
  return res.json({ok:true,cleaned:true});
 }
 const task=(await db.query(
  "INSERT INTO tasks(user_id,title,description,priority,status) VALUES($1,$2,$3,'HIGH','PENDING') RETURNING id",
  ["l1-other-user","L1 foreign isolation task","Synthetic cross-user isolation record"]
 )).rows[0];

 const org=(await db.query(
  "INSERT INTO organizations(name,slug,owner_user_id,status,seat_limit,business_tier,billing_status) VALUES($1,$2,$3,'ACTIVE',5,'BUSINESS_TRIAL','TRIAL') ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",
  ["L1 Foreign Organization","l1-foreign-org","l1-other-user"]
 )).rows[0];

 await db.query(
  "INSERT INTO organization_memberships(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE') ON CONFLICT(organization_id,user_id) DO UPDATE SET status='ACTIVE',role='OWNER'",
  [org.id,"l1-other-user"]
 );
 await db.query(
  "INSERT INTO organization_workspaces(organization_id,name) VALUES($1,$2) ON CONFLICT(organization_id) DO NOTHING",
  [org.id,"L1 Foreign workspace"]
 );
 res.json({ok:true,task_id:task.id,organization_id:org.id});
}