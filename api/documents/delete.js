import { db,storage } from "hatchable";
export const access="member"; export const methods=["DELETE"];
export default async function(req,res){
 const id=req.query?.id||req.params?.id;
 if(!id)return res.status(400).json({error:"Document id is required."});
 const d=await db.query("SELECT storage_key FROM documents WHERE id=$1 AND user_id=$2",[id,req.member.id]);
 if(!d.rows.length)return res.status(404).json({error:"Document not found."});
 const chunks=await db.query("SELECT chunk_index FROM document_chunks WHERE document_id=$1 AND user_id=$2 ORDER BY chunk_index",[id,req.member.id]);
 await storage.del(d.rows[0].storage_key);
 await db.query("DELETE FROM document_vectors WHERE document_id=$1 AND user_id=$2",[id,req.member.id]);
 await db.query("DELETE FROM documents WHERE id=$1 AND user_id=$2",[id,req.member.id]);
 res.json({success:true,deleted_chunks:chunks.rowCount});
}