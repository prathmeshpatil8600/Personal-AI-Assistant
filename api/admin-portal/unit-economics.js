import { requireAdminPortal } from "../../lib/admin-portal-auth.js";
import { computeUnitEconomics } from "../../lib/unit-economics.js";
export const access="user";
export const methods=["GET"];
export default async function(req,res){
 const admin=requireAdminPortal(req,res);if(!admin)return;
 res.json(await computeUnitEconomics());
}