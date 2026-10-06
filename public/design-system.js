(()=>{
  const root=document.documentElement;
  const THEME_KEY='secondbrain.theme';
  const ACCENT_KEY='secondbrain.accent';
  const accents={
    forest:['#2f6f61','#275d52','#dfece7'],
    indigo:['#4f5fa8','#414f8d','#e4e7f5'],
    ocean:['#2f6f7d','#275d68','#deebef'],
    amber:['#8a6826','#73571f','#f2ead7'],
    rose:['#8a5260','#72444f','#f1e2e6']
  };
  function resolvedTheme(value){
    if(value==='dark'||value==='light')return value;
    return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  }
  function applyTheme(value='system'){
    localStorage.setItem(THEME_KEY,value);
    root.dataset.theme=resolvedTheme(value);
    root.dataset.themePreference=value;
    window.dispatchEvent(new CustomEvent('secondbrain:theme',{detail:{preference:value,resolved:root.dataset.theme}}));
  }
  function applyAccent(name='forest'){
    const choice=accents[name]||accents.forest;
    localStorage.setItem(ACCENT_KEY,name);
    root.style.setProperty('--accent',choice[0]);
    root.style.setProperty('--accent-hover',choice[1]);
    root.style.setProperty('--accent-soft',choice[2]);
    root.dataset.accent=name;
    window.dispatchEvent(new CustomEvent('secondbrain:accent',{detail:{accent:name}}));
  }
  const storedTheme=localStorage.getItem(THEME_KEY)||'system';
  const storedAccent=localStorage.getItem(ACCENT_KEY)||'forest';
  applyTheme(storedTheme);
  applyAccent(storedAccent);
  const mq=matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change',()=>{if((localStorage.getItem(THEME_KEY)||'system')==='system')applyTheme('system')});
  window.SecondBrainDesign={
    setTheme:applyTheme,
    getTheme:()=>localStorage.getItem(THEME_KEY)||'system',
    setAccent:applyAccent,
    getAccent:()=>localStorage.getItem(ACCENT_KEY)||'forest',
    accents:Object.keys(accents)
  };
})();