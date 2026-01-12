(function(){
  const escMap = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  function esc(s){ return (s??"").toString().replace(/[&<>"']/g, c=>escMap[c]); }

  function uid(prefix="id"){ return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`; }

  function readJSON(key, fallback){
    try{ const v = localStorage.getItem(key); return v? JSON.parse(v): fallback; }catch{ return fallback; }
  }
  function writeJSON(key, obj){ localStorage.setItem(key, JSON.stringify(obj)); }

  function fmtOvers(balls){
    const o = Math.floor(balls/6);
    const b = balls%6;
    return `${o}.${b}`;
  }

  window.U = { esc, uid, readJSON, writeJSON, fmtOvers };
})();
