import { db } from "hatchable";
import { markOnboardingStep } from "../../lib/pilot.js";

export const access="user";
export const methods = ["POST"];

export default async function (req, res) {
  const body = req.body || {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200) return res.status(400).json({success:false,error:{code:"INVALID_TITLE",message:"Title is required and must be 200 characters or fewer."}});
  const priority = ["LOW","MEDIUM","HIGH","URGENT"].includes(body.priority) ? body.priority : "MEDIUM";
  const description = typeof body.description === "string" ? body.description.slice(0,5000) : "";
  const dueAt = body.due_at ? new Date(body.due_at) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({success:false,error:{code:"INVALID_DUE_DATE",message:"Invalid due date."}});
  const { rows } = await db.query(
    "INSERT INTO tasks (user_id,title,description,priority,due_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,title,description,priority,status,due_at,created_at,updated_at",
    [req.user.id,title,description,priority,dueAt]
  );
  await markOnboardingStep(req.user.id,"task");
  res.status(201).json(rows[0]);
}