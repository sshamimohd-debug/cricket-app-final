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

  // --- Local session (PIN fallback / demo) ---
  const SESSION_KEY = "mpl_session";
  function getSession(){
    const s = readJSON(SESSION_KEY, null);
    if(!s) return null;
    if(s.exp && Date.now() > s.exp){
      try{ localStorage.removeItem(SESSION_KEY); }catch{}
      return null;
    }
    return s;
  }
  function getSessionRole(){
    return getSession()?.role || null;
  }
  function setSession(role, hours=12){
    const exp = Date.now() + hours*60*60*1000;
    writeJSON(SESSION_KEY, { role, exp });
  }
  function clearSession(){
    try{ localStorage.removeItem(SESSION_KEY); }catch{}
  }

  window.U = { esc, uid, readJSON, writeJSON, fmtOvers, getSessionRole, setSession, clearSession };
})();
