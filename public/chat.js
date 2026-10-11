let activeConversation=null;
let pendingAttachment=null;

async function chatApi(path,opts={}){
 const r=await fetch("/api"+path,{headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts});
 if(!r.ok){const e=await r.json().catch(()=>({}));if(e?.error==="entitlement_limit")window.dispatchEvent(new CustomEvent("secondbrain:entitlement",{detail:e}));throw new Error(e.message||e.error||"Request failed")}
 return r.json()
}

function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function inlineFormat(s){
 let x=escapeHtml(s);
 x=x.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
 x=x.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
 return x;
}
function renderRichText(text){
 const src=String(text||"");
 const blocks=[];
 const fenceRe=new RegExp("`{3}([\\w-]*)\\n?([\\s\\S]*?)`{3}","g");
 const tokenized=src.replace(fenceRe,(_,lang,code)=>{
  const i=blocks.length;
  blocks.push('<div class="code-card"><div class="code-head"><span>'+escapeHtml(lang||"code")+'</span><button class="message-action copy-code" type="button">Copy</button></div><pre><code>'+escapeHtml(code.trim())+'</code></pre></div>');
  return "\n@@CODE"+i+"@@\n";
 });
 const lines=tokenized.split(/\n/);
 let out="",i=0;
 while(i<lines.length){
  const line=lines[i];
  if(/^@@CODE\d+@@$/.test(line.trim())){out+=blocks[Number(line.trim().match(/\d+/)[0])];i++;continue}
  if(line.includes("|")&&i+1<lines.length&&/^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i+1])){
   const headers=line.split("|").map(x=>x.trim()).filter(Boolean);i+=2;const rows=[];
   while(i<lines.length&&lines[i].includes("|")&&lines[i].trim()){rows.push(lines[i].split("|").map(x=>x.trim()).filter(Boolean));i++}
   out+='<div class="table-wrap"><table><thead><tr>'+headers.map(h=>"<th>"+inlineFormat(h)+"</th>").join("")+'</tr></thead><tbody>'+rows.map(r=>"<tr>"+headers.map((_,j)=>"<td>"+inlineFormat(r[j]||"")+"</td>").join("")+"</tr>").join("")+"</tbody></table></div>";continue
  }
  if(/^#{1,3}\s+/.test(line)){const n=(line.match(/^#+/)||["#"])[0].length;out+="<h"+n+">"+inlineFormat(line.replace(/^#{1,3}\s+/,""))+"</h"+n+">";i++;continue}
  if(/^\s*[-*]\s+/.test(line)){let items="";while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i])){items+="<li>"+inlineFormat(lines[i].replace(/^\s*[-*]\s+/,""))+"</li>";i++}out+="<ul>"+items+"</ul>";continue}
  if(/^\s*\d+\.\s+/.test(line)){let items="";while(i<lines.length&&/^\s*\d+\.\s+/.test(lines[i])){items+="<li>"+inlineFormat(lines[i].replace(/^\s*\d+\.\s+/,""))+"</li>";i++}out+="<ol>"+items+"</ol>";continue}
  if(!line.trim()){i++;continue}
  let para=line;i++;while(i<lines.length&&lines[i].trim()&&!/^(@@CODE\d+@@|#{1,3}\s+|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])){para+="\n"+lines[i];i++}
  out+="<p>"+inlineFormat(para).replace(/\n/g,"<br>")+"</p>";
 }
 return out||"<p></p>";
}

function toolSummary(steps){
 const calls=[];
 for(const step of (Array.isArray(steps)?steps:[]))for(const call of (step?.toolCalls||[]))calls.push(call);
 if(!calls.length)return"";
 return '<div class="tool-activity">'+calls.map(call=>{
  const result=call.result||{};
  const approval=result.approval_required;
  const provider=(call.name||"").split("_")[0];
  if(approval)return '<div class="approval-inline"><div><span class="tool-dot warn"></span><b>Approval required</b><small>'+escapeHtml(call.name.replaceAll("_"," "))+'</small></div><button class="ghost" type="button" data-open-approvals>Review</button></div>';
  return '<div class="tool-row"><span class="tool-dot ok"></span><div><b>'+escapeHtml(call.name.replaceAll("_"," "))+'</b><small>'+escapeHtml(provider==="google"?"Google":provider==="github"?"GitHub":"Workspace")+' tool completed</small></div></div>';
 }).join("")+'</div>';
}

function assistantMessageHTML(text,steps,{id=""}={}){
 return '<article class="message assistant-message" '+(id?'data-message-id="'+escapeHtml(id)+'"':'')+'><div class="assistant-avatar" aria-hidden="true"><span></span></div><div class="message-body">'+toolSummary(steps)+'<div class="rich-response">'+renderRichText(text)+'</div><div class="message-actions"><button class="message-action" type="button" data-copy-message>Copy</button><button class="message-action" type="button" data-shorter>Make shorter</button><button class="message-action" type="button" data-save-memory>Save</button><span class="message-spacer"></span><button class="message-action icon-only" type="button" data-feedback="up" aria-label="Helpful">♡</button><button class="message-action icon-only" type="button" data-feedback="down" aria-label="Not helpful">⌁</button></div></div></article>';
}
function userMessageHTML(text){return '<article class="message user-message"><div class="message-body"><div class="user-content">'+escapeHtml(text).replace(/\n/g,"<br>")+'</div></div></article>'}
function thinkingHTML(){return '<article class="message assistant-message thinking-message"><div class="assistant-avatar thinking" aria-hidden="true"><span></span></div><div class="message-body"><div class="thinking-line"><span></span><span>Thinking</span></div><div class="thinking-sub">Checking context and deciding whether tools are needed…</div></div></article>'}

async function renderChat(root){
 const pendingPrompt=sessionStorage.getItem("secondbrain.pendingPrompt")||"";
 sessionStorage.removeItem("secondbrain.pendingPrompt");
 root.innerHTML='<div class="chat-top"><div><div class="eyebrow">SecondBrain</div><h1>Chat</h1><div class="label">Ask, plan, search, create, or continue your work.</div></div><button class="primary" id="newChat">New chat</button></div>'+
 '<div class="chat-layout chat-v2"><aside class="card chat-list-panel"><div class="chat-list-head"><b>Conversations</b><button class="icon-btn" id="collapseChats" aria-label="Toggle conversation list">‹</button></div><div id="chatList" class="chat-list">Loading…</div></aside>'+
 '<section class="chat-panel-v2"><div id="messages" class="messages chat-messages"><div class="chat-empty"><div class="assistant-orb large"><span></span></div><h2>What can I help you move forward?</h2><p>I can work with your tasks, calendar, memory, documents, Google, GitHub, and connected tools.</p><div class="quick-actions"><button class="chip action" data-quick="Plan my day">Plan my day</button><button class="chip action" data-quick="Review my priorities">Review priorities</button><button class="chip action" data-quick="Search my workspace">Search workspace</button><button class="chip action" data-quick="Summarize my recent work">Recent work</button></div></div></div>'+
 '<div class="composer-wrap" id="composerWrap"><div id="attachmentBar" class="attachment-bar" hidden></div><div id="slashMenu" class="slash-menu" hidden></div><form id="chatForm" class="composer"><div class="composer-actions"><button type="button" class="composer-icon" id="attachBtn" aria-label="Attach a document">＋</button><input id="chatFile" type="file" accept=".pdf,.txt,.md,.csv,.json,.html,application/pdf,text/plain,text/markdown,text/csv,application/json,text/html" hidden><button type="button" class="composer-icon" id="voiceBtn" aria-label="Voice input">🎙</button></div><textarea id="chatInput" rows="1" placeholder="Message SecondBrain…" autocomplete="off" aria-label="Message SecondBrain"></textarea><button class="send-btn" id="sendBtn" aria-label="Send message">↑</button></form><div class="composer-meta"><span>Enter to send · Shift+Enter for new line · / for commands</span><span id="composerStatus">Ready</span></div></div></section></div>';
 await loadConversations();
 bindChatUI(pendingPrompt);
 window.SecondBrainShell?.setContext("Chat");
}

function bindChatUI(pendingPrompt){
 document.querySelectorAll("[data-quick]").forEach(b=>b.onclick=()=>quickChat(b.dataset.quick));
 document.getElementById("newChat").onclick=()=>{activeConversation=null;pendingAttachment=null;document.getElementById("messages").innerHTML='<div class="chat-empty"><div class="assistant-orb large"><span></span></div><h2>New conversation</h2><p>What would you like to work on?</p></div>';renderAttachment()};
 document.getElementById("chatForm").onsubmit=sendChat;
 document.getElementById("voiceBtn").onclick=()=>startVoiceInput("chatInput");
 document.getElementById("attachBtn").onclick=()=>document.getElementById("chatFile").click();
 document.getElementById("chatFile").onchange=e=>uploadChatDocument(e.target.files?.[0]);
 const input=document.getElementById("chatInput");
 input.addEventListener("input",()=>{autoGrow(input);renderSlashMenu(input.value)});
 input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();document.getElementById("chatForm").requestSubmit()}});
 const wrap=document.getElementById("composerWrap");
 wrap.addEventListener("dragover",e=>{e.preventDefault();wrap.classList.add("dragging")});
 wrap.addEventListener("dragleave",()=>wrap.classList.remove("dragging"));
 wrap.addEventListener("drop",e=>{e.preventDefault();wrap.classList.remove("dragging");uploadChatDocument(e.dataTransfer.files?.[0])});
 document.getElementById("messages").addEventListener("click",handleMessageAction);
 if(pendingPrompt){input.value=pendingPrompt;autoGrow(input);input.focus()}
}

function autoGrow(el){el.style.height="auto";el.style.height=Math.min(180,el.scrollHeight)+"px"}

function renderSlashMenu(value){
 const box=document.getElementById("slashMenu");if(!box)return;
 const q=value.trim();if(!q.startsWith("/")){box.hidden=true;return}
 const cmds=[
  ["/task","Create a task","Create a task: "],
  ["/remind","Create a reminder","Remind me to "],
  ["/calendar","Check calendar","Show me my calendar for "],
  ["/search","Search workspace","Search my workspace for "],
  ["/memory","Use memory","What do you remember about "],
  ["/github","Use GitHub","Check GitHub for "]
 ];
 const filtered=cmds.filter(c=>c[0].startsWith(q.split(/\s/)[0].toLowerCase()));
 box.innerHTML=filtered.map((c,i)=>'<button type="button" class="slash-item" data-slash="'+i+'"><b>'+c[0]+'</b><span>'+c[1]+'</span></button>').join("");
 box.hidden=!filtered.length;
 box.querySelectorAll(".slash-item").forEach((b,i)=>b.onclick=()=>{const cmd=filtered[i];document.getElementById("chatInput").value=cmd[2];box.hidden=true;document.getElementById("chatInput").focus()});
}

async function uploadChatDocument(file){
 if(!file)return;
 const status=document.getElementById("composerStatus");status.textContent="Uploading "+file.name+"…";
 const fd=new FormData();fd.append("file",file);
 try{
  const r=await fetch("/api/documents/upload",{method:"POST",body:fd});const d=await r.json();
  if(!r.ok)throw new Error(d.error||d.detail||"Upload failed");
  pendingAttachment={id:d.id,title:d.title||file.name,filename:d.filename||file.name};
  renderAttachment();status.textContent="Document ready";
 }catch(e){status.textContent="Upload failed";showToast(e.message)}
}
function renderAttachment(){
 const bar=document.getElementById("attachmentBar");if(!bar)return;
 if(!pendingAttachment){bar.hidden=true;bar.innerHTML="";return}
 bar.hidden=false;bar.innerHTML='<span class="attachment-chip">▧ <span>'+escapeHtml(pendingAttachment.filename)+'</span><button type="button" id="removeAttachment" aria-label="Remove attachment">×</button></span>';
 document.getElementById("removeAttachment").onclick=()=>{pendingAttachment=null;renderAttachment()};
}

async function loadConversations(){
 const list=await chatApi("/conversations/list");
 const box=document.getElementById("chatList");if(!box)return;
 box.innerHTML=list.length?list.map(c=>'<button class="conversation '+(c.id===activeConversation?"active":"")+'" data-id="'+c.id+'"><span>'+escapeHtml(c.title)+'</span><small>'+new Date(c.updated_at).toLocaleDateString([],{month:"short",day:"numeric"})+'</small></button>').join(""):'<div class="daily-empty compact">No conversations yet.</div>';
 box.querySelectorAll(".conversation").forEach(b=>b.onclick=()=>loadConversation(b.dataset.id));
}

async function loadConversation(id){
 activeConversation=id;pendingAttachment=null;renderAttachment();
 const d=await chatApi("/conversations/messages?id="+encodeURIComponent(id));
 const box=document.getElementById("messages");
 box.innerHTML=d.messages.map(m=>m.role==="user"?userMessageHTML(m.content):assistantMessageHTML(m.content,m.tool_calls||[],{id:m.id})).join("");
 box.scrollTop=box.scrollHeight;await loadConversations();
}

async function sendChat(e){
 e.preventDefault();
 const input=document.getElementById("chatInput"),send=document.getElementById("sendBtn"),status=document.getElementById("composerStatus");
 let message=input.value.trim();if(!message)return;
 if(pendingAttachment)message+='\n\nI uploaded "'+pendingAttachment.filename+'" to my Documents knowledge base. Use it when relevant to this request.';
 input.value="";autoGrow(input);document.getElementById("slashMenu").hidden=true;
 appendUser(message);appendThinking();send.disabled=true;status.textContent="Thinking…";window.SecondBrainLiving?.setPresence?.("thinking","thinking");
 try{
  const d=await chatApi("/chat",{method:"POST",body:JSON.stringify({message,conversation_id:activeConversation})});
  activeConversation=d.conversation_id;pendingAttachment=null;renderAttachment();
  document.querySelector(".thinking-message")?.remove();
  appendAssistant(d.message,d.steps||[]);
  const needsApproval=(d.steps||[]).some(s=>(s.toolCalls||[]).some(c=>c?.result?.approval_required));
  window.SecondBrainLiving?.setPresence?.(needsApproval?"attention":"calm",needsApproval?"approval needed":"ready");
  status.textContent=(d.provider||"AI")+" · "+(d.model||"ready");
  loadConversations();window.SecondBrainShell?.refreshApprovals?.();
 }catch(err){document.querySelector(".thinking-message")?.remove();appendAssistant("I couldn't complete that request. "+err.message,[]);status.textContent="Error";window.SecondBrainLiving?.setPresence?.("attention","needs attention")}
 finally{send.disabled=false;input.focus()}
}

function appendUser(text){const box=document.getElementById("messages");box.querySelector(".chat-empty")?.remove();box.insertAdjacentHTML("beforeend",userMessageHTML(text));box.scrollTop=box.scrollHeight}
function appendThinking(){const box=document.getElementById("messages");box.insertAdjacentHTML("beforeend",thinkingHTML());box.scrollTop=box.scrollHeight}
function appendAssistant(text,steps){const box=document.getElementById("messages");box.insertAdjacentHTML("beforeend",assistantMessageHTML(text,steps));box.scrollTop=box.scrollHeight}

async function handleMessageAction(e){
 const btn=e.target.closest("button");if(!btn)return;
 const msg=btn.closest(".assistant-message");const rich=msg?.querySelector(".rich-response");const plain=rich?.innerText.trim()||"";
 if(btn.matches("[data-copy-message]")){await navigator.clipboard.writeText(plain);btn.textContent="Copied";setTimeout(()=>btn.textContent="Copy",1200)}
 else if(btn.matches(".copy-code")){await navigator.clipboard.writeText(btn.closest(".code-card")?.querySelector("code")?.innerText||"");btn.textContent="Copied";setTimeout(()=>btn.textContent="Copy",1200)}
 else if(btn.matches("[data-shorter]")){quickChat("Make your previous answer shorter and keep only the key points.")}
 else if(btn.matches("[data-save-memory]")){await saveAssistantMemory(plain,btn)}
 else if(btn.matches("[data-feedback]")){btn.classList.toggle("selected");showToast(btn.dataset.feedback==="up"?"Marked helpful":"Feedback noted")}
 else if(btn.matches("[data-open-approvals]")){openSection("approvals")}
}

async function saveAssistantMemory(text,btn){
 if(!text)return;
 btn.disabled=true;
 try{
  await chatApi("/memories/save",{method:"POST",body:JSON.stringify({category:"chat",memory_key:"Saved chat · "+new Date().toISOString(),memory_value:text.slice(0,4000),source:"user",importance:3,confidence:1,source_conversation_id:activeConversation})});
  btn.textContent="Saved";showToast("Saved to Memory")
 }catch(e){showToast(e.message)}
 finally{setTimeout(()=>{btn.disabled=false;btn.textContent="Save"},1500)}
}

function quickChat(text){const input=document.getElementById("chatInput");if(input){input.value=text;autoGrow(input);input.focus();renderSlashMenu(text)}}
function showToast(text){let t=document.getElementById("chatToast");if(!t){t=document.createElement("div");t.id="chatToast";t.className="chat-toast";document.body.appendChild(t)}t.textContent=text;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}