import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 res.json({authorized:true,email:admin.email,name:admin.name});
}