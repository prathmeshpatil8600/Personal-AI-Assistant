import { db } from "hatchable";
import { governTools } from "./tool-governance.js";
import { googleFetch } from "./google-oauth.js";
import { githubFetch } from "./github-oauth.js";

export function createAssistantTools(userId,{conversationId=null}={}) {
  const tools={
    search_workspace: {
      description:"Search the user's tasks, notes, reminders, calendar events, conversations, documents and memories by keyword.",
      inputSchema:{type:"object",properties:{query:{type:"string"}},required:["query"]},
      execute:async({query})=>{
        const like="%"+String(query||"").trim()+"%"; if(like==="%%")return{results:[]};
        const r=await db.query(`SELECT * FROM (
          SELECT 'task' type,id,title,description snippet,updated_at date FROM tasks WHERE user_id=$1 AND (title ILIKE $2 OR description ILIKE $2)
          UNION ALL SELECT 'note',id,title,content,updated_at FROM notes WHERE user_id=$1 AND deleted_at IS NULL AND (title ILIKE $2 OR content ILIKE $2)
          UNION ALL SELECT 'reminder',id,title,message,updated_at FROM reminders WHERE user_id=$1 AND (title ILIKE $2 OR message ILIKE $2)
          UNION ALL SELECT 'event',id,title,description,start_at FROM calendar_events WHERE user_id=$1 AND (title ILIKE $2 OR description ILIKE $2 OR location ILIKE $2)
          UNION ALL SELECT 'conversation',cm.id,c.title,cm.content,cm.created_at FROM conversation_messages cm JOIN conversations c ON c.id=cm.conversation_id WHERE cm.user_id=$1 AND c.user_id=$1 AND cm.content ILIKE $2
          UNION ALL SELECT 'document',d.id,d.title,dc.content,dc.created_at FROM documents d JOIN document_chunks dc ON dc.document_id=d.id WHERE d.user_id=$1 AND dc.user_id=$1 AND (d.title ILIKE $2 OR d.filename ILIKE $2 OR dc.content ILIKE $2)
          UNION ALL SELECT 'memory',id,memory_key,memory_value,updated_at FROM memories WHERE user_id=$1 AND (memory_key ILIKE $2 OR memory_value ILIKE $2 OR category ILIKE $2)
        ) s ORDER BY date DESC NULLS LAST LIMIT 30`,[userId,like]);
        return{results:r.rows};
      }
    },
    list_memory:{description:"List the user's saved long-term memories.",inputSchema:{type:"object",properties:{category:{type:"string"}},required:[]},execute:async({category})=>{
      const sql=category?"SELECT category,memory_key,memory_value,importance FROM memories WHERE user_id=$1 AND category=$2 ORDER BY importance DESC,updated_at DESC":"SELECT category,memory_key,memory_value,importance FROM memories WHERE user_id=$1 ORDER BY importance DESC,updated_at DESC";
      const r=await db.query(sql,category?[userId,category]:[userId]);return{memories:r.rows};
    }},
    save_memory:{description:"Save or update a durable user preference or fact only when the user explicitly asks you to remember it.",inputSchema:{type:"object",properties:{memory_key:{type:"string"},memory_value:{type:"string"},category:{type:"string"},importance:{type:"integer"}},required:["memory_key","memory_value"]},execute:async({memory_key,memory_value,category="general",importance=3})=>{
      const r=await db.query(`INSERT INTO memories(user_id,category,memory_key,memory_value,source,importance,confidence,source_conversation_id) VALUES($1,$2,$3,$4,'assistant',LEAST(5,GREATEST(1,$5)),0.85,$6) ON CONFLICT(user_id,memory_key) DO UPDATE SET category=EXCLUDED.category,memory_value=EXCLUDED.memory_value,source='assistant',importance=EXCLUDED.importance,confidence=0.85,source_conversation_id=COALESCE(EXCLUDED.source_conversation_id,memories.source_conversation_id),updated_at=now() RETURNING id,memory_key,memory_value,category,importance,confidence,source_conversation_id`,[userId,String(category).slice(0,80),String(memory_key).trim(),String(memory_value).trim(),Number(importance)||3,conversationId||null]);
      return{saved:r.rows[0]};
    }},
    list_calendar:{description:"List the user's calendar events in a date range. Use ISO timestamps.",inputSchema:{type:"object",properties:{from:{type:"string"},to:{type:"string"}},required:["from","to"]},execute:async({from,to})=>{
      const a=new Date(from),b=new Date(to);if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return{error:"Invalid date range."};
      const r=await db.query("SELECT id,title,description,start_at,end_at,all_day,location,status FROM calendar_events WHERE user_id=$1 AND start_at >= $2 AND start_at < $3 ORDER BY start_at LIMIT 50",[userId,a,b]);return{events:r.rows};
    }},
    list_tasks:{description:"List the signed-in user's tasks.",inputSchema:{type:"object",properties:{status:{type:"string",enum:["TODO","IN_PROGRESS","COMPLETED","CANCELLED"]}},required:[]},execute:async({status})=>{
      const q=status?"SELECT id,title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status=$2 ORDER BY due_at NULLS LAST LIMIT 20":"SELECT id,title,priority,status,due_at FROM tasks WHERE user_id=$1 AND status<>'CANCELLED' ORDER BY due_at NULLS LAST LIMIT 20";
      const r=await db.query(q,status?[userId,status]:[userId]);return{tasks:r.rows};
    }},
    create_task:{description:"Create a task when the user explicitly asks for one.",inputSchema:{type:"object",properties:{title:{type:"string"},description:{type:"string"},priority:{type:"string",enum:["LOW","MEDIUM","HIGH","URGENT"]},due_at:{type:"string"}},required:["title"]},execute:async({title,description="",priority="MEDIUM",due_at=null})=>{
      const due=due_at?new Date(due_at):null;if(due&&Number.isNaN(due.getTime()))return{error:"Invalid due date."};
      const r=await db.query("INSERT INTO tasks(user_id,title,description,priority,due_at) VALUES($1,$2,$3,$4,$5) RETURNING id,title,priority,status,due_at",[userId,String(title).trim(),description,priority,due]);return{created:r.rows[0]};
    }},
    list_notes:{description:"Search the user's notes.",inputSchema:{type:"object",properties:{query:{type:"string"}},required:[]},execute:async({query=""})=>{
      const r=await db.query("SELECT id,title,content,category,pinned,updated_at FROM notes WHERE user_id=$1 AND deleted_at IS NULL AND (title ILIKE $2 OR content ILIKE $2) ORDER BY pinned DESC,updated_at DESC LIMIT 20",[userId,"%"+query+"%"]);return{notes:r.rows};
    }},
    create_reminder:{description:"Create a reminder when the user explicitly asks for one at a specific time.",inputSchema:{type:"object",properties:{title:{type:"string"},remind_at:{type:"string"},message:{type:"string"},recurrence:{type:"string"}},required:["title","remind_at"]},execute:async({title,remind_at,message="",recurrence=null})=>{
      const at=new Date(remind_at);if(Number.isNaN(at.getTime()))return{error:"Invalid reminder time."};
      const r=await db.query("INSERT INTO reminders(user_id,title,message,remind_at,recurrence) VALUES($1,$2,$3,$4,$5) RETURNING id,title,remind_at,recurrence,status",[userId,String(title).trim(),message,at,recurrence]);return{created:r.rows[0]};
    }},
    google_search_gmail:{description:"Search the connected Gmail mailbox read-only. Use Gmail search syntax in q.",inputSchema:{type:"object",properties:{q:{type:"string"},max_results:{type:"integer"}},required:["q"]},execute:async({q,max_results=10})=>{
      const n=Math.max(1,Math.min(20,Number(max_results)||10));
      const list=await googleFetch(userId,"https://gmail.googleapis.com/gmail/v1/users/me/messages?q="+encodeURIComponent(String(q||""))+"&maxResults="+n);
      const ids=Array.isArray(list.messages)?list.messages:[]; const messages=[];
      for(const x of ids.slice(0,n)){
        const m=await googleFetch(userId,"https://gmail.googleapis.com/gmail/v1/users/me/messages/"+encodeURIComponent(x.id)+"?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date");
        const headers=Object.fromEntries((m.payload?.headers||[]).map(h=>[String(h.name||"").toLowerCase(),h.value]));
        messages.push({id:m.id,thread_id:m.threadId,from:headers.from||"",to:headers.to||"",subject:headers.subject||"",date:headers.date||"",snippet:m.snippet||""});
      }
      return{messages};
    }},
    google_list_calendar:{description:"List upcoming events from the connected Google Calendar read-only.",inputSchema:{type:"object",properties:{from:{type:"string"},to:{type:"string"},max_results:{type:"integer"}},required:["from","to"]},execute:async({from,to,max_results=20})=>{
      const a=new Date(from),b=new Date(to);if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return{error:"Invalid date range."};
      const n=Math.max(1,Math.min(50,Number(max_results)||20));
      const url="https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin="+encodeURIComponent(a.toISOString())+"&timeMax="+encodeURIComponent(b.toISOString())+"&maxResults="+n;
      const data=await googleFetch(userId,url);
      return{events:(data.items||[]).map(e=>({id:e.id,summary:e.summary||"",description:e.description||"",location:e.location||"",start:e.start||null,end:e.end||null,status:e.status||"",html_link:e.htmlLink||""}))};
    }},
    google_search_drive:{description:"Search file metadata in the connected Google Drive read-only. Returns names, types, timestamps and links, not file contents.",inputSchema:{type:"object",properties:{query:{type:"string"},max_results:{type:"integer"}},required:["query"]},execute:async({query,max_results=20})=>{
      const n=Math.max(1,Math.min(50,Number(max_results)||20)); const term=String(query||"").trim().replace(/'/g,"\\'");
      const q="trashed = false and name contains '"+term+"'";
      const url="https://www.googleapis.com/drive/v3/files?q="+encodeURIComponent(q)+"&pageSize="+n+"&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,createdTime,webViewLink,owners(displayName,emailAddress))";
      const data=await googleFetch(userId,url);
      return{files:data.files||[]};
    }},
    github_list_repositories:{description:"List repositories available through the connected GitHub App.",inputSchema:{type:"object",properties:{visibility:{type:"string",enum:["all","public","private"]},max_results:{type:"integer"}},required:[]},execute:async({visibility="all",max_results=30})=>{
      const n=Math.max(1,Math.min(100,Number(max_results)||30));
      const data=await githubFetch(userId,"/user/repos?per_page="+n+"&sort=updated&visibility="+encodeURIComponent(visibility));
      return{repositories:(Array.isArray(data)?data:[]).map(r=>({id:r.id,full_name:r.full_name,private:Boolean(r.private),description:r.description||"",default_branch:r.default_branch||"",updated_at:r.updated_at,html_url:r.html_url,permissions:r.permissions||null}))};
    }},
    github_list_issues:{description:"List open or closed issues and pull requests for a connected GitHub repository.",inputSchema:{type:"object",properties:{owner:{type:"string"},repo:{type:"string"},state:{type:"string",enum:["open","closed","all"]},max_results:{type:"integer"}},required:["owner","repo"]},execute:async({owner,repo,state="open",max_results=30})=>{
      const n=Math.max(1,Math.min(100,Number(max_results)||30));
      const data=await githubFetch(userId,"/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo)+"/issues?state="+encodeURIComponent(state)+"&per_page="+n+"&sort=updated");
      return{items:(Array.isArray(data)?data:[]).map(x=>({number:x.number,title:x.title,state:x.state,is_pull_request:Boolean(x.pull_request),user:x.user?.login||"",labels:(x.labels||[]).map(l=>l.name||String(l)),updated_at:x.updated_at,html_url:x.html_url}))};
    }},
    github_get_repository_content:{description:"Read a file or directory from a connected GitHub repository when the GitHub App has Contents read permission.",inputSchema:{type:"object",properties:{owner:{type:"string"},repo:{type:"string"},path:{type:"string"},ref:{type:"string"}},required:["owner","repo","path"]},execute:async({owner,repo,path,ref})=>{
      const suffix=ref?"?ref="+encodeURIComponent(ref):"";
      const data=await githubFetch(userId,"/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo)+"/contents/"+String(path).split('/').map(encodeURIComponent).join('/')+suffix);
      if(Array.isArray(data))return{entries:data.map(x=>({name:x.name,path:x.path,type:x.type,size:x.size,sha:x.sha,html_url:x.html_url,download_url:x.download_url||null}))};
      let content=null;if(data.type==="file"&&typeof data.content==="string"&&data.encoding==="base64"){try{content=decodeURIComponent(escape(atob(data.content.replace(/\n/g,""))))}catch{content=null}}
      return{entry:{name:data.name,path:data.path,type:data.type,size:data.size,sha:data.sha,html_url:data.html_url,download_url:data.download_url||null,content}};
    }}
  };
  return governTools(tools,{userId,conversationId});
}