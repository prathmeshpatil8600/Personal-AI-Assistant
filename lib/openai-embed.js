export async function embedText(input){
 const key=process.env.OPENAI_API_KEY;
 if(!key) throw new Error("OPENAI_API_KEY is not available to the embedding runtime.");
 const r=await fetch("https://api.openai.com/v1/embeddings",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+key},body:JSON.stringify({model:"text-embedding-3-small",input})});
 if(!r.ok){const t=await r.text();throw new Error("OpenAI embeddings request failed ("+r.status+"): "+t.slice(0,300));}
 const data=await r.json();
 if(!data?.data?.[0]?.embedding) throw new Error("OpenAI embeddings response did not contain an embedding.");
 return data.data[0].embedding;
}