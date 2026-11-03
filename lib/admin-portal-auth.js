export const ADMIN_PORTAL_EMAILS=new Set(["patilprathmesh999@gmail.com"]);

export function requireAdminPortal(req,res){
 const email=String(req.user?.email||"").trim().toLowerCase();
 if(!req.user?.id){res.status(401).json({error:"authentication_required"});return null}
 if(!ADMIN_PORTAL_EMAILS.has(email)){res.status(403).json({error:"admin_access_denied"});return null}
 return {id:req.user.id,email,name:req.user.name||null};
}