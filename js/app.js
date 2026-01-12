/* MPGB PL - app.js (FINAL)
   - Hash router
   - Page loader (pages/*.html)
   - Role-gated scoring: scoring panel only for admin/scorer
   - Works on GitHub Pages
*/

(function(){
  const $ = (s, el=document)=> el.querySelector(s);

  const APP = {
    mount: null,
    role: "public",
    uid: null,
    fb: null,
  };

  // --------- ROUTING ----------
  function parseHash(){
    // supports:
    //  #/match?id=A1
    //  #/home
    //  #/scorecard?id=A1
    const h = location.hash || "#/home";
    const clean = h.startsWith("#") ? h.slice(1) : h;
    const [pathPart, qsPart=""] = clean.split("?");
    const path = (pathPart || "/home").replace(/^\/+/, "");
    const params = new URLSearchParams(qsPart);
    return { path, params };
  }

  async function loadPage(pageName){
    // pageName without extension
    const url = `pages/${pageName}.html?v=${Date.now()}`;
    const res = await fetch(url, { cache:"no-store" });
    if(!res.ok) throw new Error(`Failed to load ${url}`);
    return await res.text();
  }

  async function navigate(){
    const { path, params } = parseHash();

    // map routes -> pages
    const map = {
      "home": "home",
      "points": "points",
      "teams": "teams",
      "knockouts": "knockouts",
      "rules": "rules",
      "match": "match",
      "scorecard": "scorecard",
    };

    // default route
    const page = map[path] || "home";

    // render
    try{
      APP.mount.innerHTML = await loadPage(page);
      await runPageController(page, params);
      highlightNav(page);
    }catch(e){
      APP.mount.innerHTML = `
        <div class="card">
          <div class="h1">Page load error</div>
          <div class="muted small">${escapeHtml(e?.message || e)}</div>
        </div>`;
    }
  }

  function highlightNav(page){
    // optional: if nav buttons have data-nav="home" etc.
    document.querySelectorAll("[data-nav]").forEach(el=>{
      el.classList.toggle("active", el.getAttribute("data-nav")===page);
    });
  }

  function escapeHtml(s){
    return (s??"").toString().replace(/[&<>"']/g, c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // --------- FIREBASE ROLE ----------
  async function ensureFirebase(){
    if(APP.fb) return APP.fb;
    APP.fb = await FB.initFirebase();
    return APP.fb;
  }

  async function resolveRole(){
    const fb = await ensureFirebase();
    const { auth, au, getMyRole } = fb;

    // wait one tick for auth to settle (GitHub Pages + CDN)
    await new Promise(r=> setTimeout(r, 50));

    if(auth.currentUser){
      APP.uid = auth.currentUser.uid;
      APP.role = await getMyRole(APP.uid);
      return APP.role;
    }
    APP.uid = null;
    APP.role = "public";
    return "public";
  }

  function isScorerRole(){
    return APP.role === "admin" || APP.role === "scorer";
  }

  // --------- PAGE CONTROLLERS ----------
  async function runPageController(page, params){
    // ensure role for every page (so admin button / scoring gates work)
    await resolveRole();
    gateAdminButton();

    if(page === "match"){
      await initMatchPage(params);
    }else if(page === "scorecard"){
      await initScorecardPage(params);
    }else{
      // no-op for others
    }
  }

  function gateAdminButton(){
    // If topbar has Admin button link with id="btnAdmin" or class="btnAdmin"
    const btn = $("#btnAdmin") || $(".btnAdmin") || $("a[href*='admin/index.html']");
    if(!btn) return;
    // show for everyone (so scorer can login), but keep label clean
    btn.style.display = "";
  }

  // --------- MATCH PAGE (ROLE GATING + HOOKS) ----------
  function getMatchId(params){
    return params.get("id") || params.get("matchId") || "A1";
  }

  async function initMatchPage(params){
    const matchId = getMatchId(params);

    // keep scorecard link pinned
    const scoreA = $("#btnToScorecard");
    if(scoreA) scoreA.href = `#/scorecard?id=${encodeURIComponent(matchId)}`;

    // open admin button inside scoring panel (if exists)
    const btnOpenAdmin = $("#btnOpenAdmin");
    if(btnOpenAdmin){
      btnOpenAdmin.addEventListener("click", ()=>{
        location.href = `admin/index.html?v=${Date.now()}`;
      });
    }

    // ROLE HINT
    const roleHint = $("#roleHint");
    if(roleHint){
      if(isScorerRole()){
        roleHint.style.display = "block";
        roleHint.textContent = `Logged in as: ${APP.role}`;
      }else{
        roleHint.style.display = "block";
        roleHint.textContent = "Viewer mode (Public). Scoring केवल Admin/Scorer login के बाद उपलब्ध होगा.";
      }
    }

    // SCORING PANEL GATE
    const scoringPanel = $("#scoringPanel");
    if(scoringPanel){
      scoringPanel.style.display = isScorerRole() ? "block" : "none";
    }else{
      // fallback: if old template still has buttons directly
      hideLegacyScoringButtonsForPublic();
    }

    // Live score UI init (existing code in other modules can run too)
    // If your repo already has a live binding function, call it here if exposed.
    if(window.LiveMatch && typeof window.LiveMatch.init === "function"){
      window.LiveMatch.init({ matchId, role: APP.role });
    }else{
      // Minimal live binding (optional): show live from Firestore if exists
      await minimalLiveBind(matchId);
    }

    // Wire scoring buttons ONLY if scorer/admin
    if(isScorerRole()){
      wireScoringButtons(matchId);
    }else{
      // hard disable any clickable scoring buttons
      disableAllScoringClicks();
    }
  }

  function hideLegacyScoringButtonsForPublic(){
    // If old markup exists: .kpi buttons always visible
    const kpi = document.querySelector(".kpi");
    if(kpi && !isScorerRole()){
      kpi.style.display = "none";
    }
  }

  function disableAllScoringClicks(){
    // Defensive: remove pointer events for any scoring buttons if present
    const kpi = document.querySelector(".kpi");
    if(kpi && !isScorerRole()){
      kpi.style.pointerEvents = "none";
      kpi.style.opacity = "0.5";
    }
  }

  async function minimalLiveBind(matchId){
    try{
      const fb = await ensureFirebase();
      const { db, fs } = fb;

      const liveScoreEl = $("#liveScore");
      const lastBallsEl = $("#lastBalls");
      const titleEl = $("#matchTitle");
      const metaEl = $("#matchMeta");

      const ref = fs.doc(db, "matches", matchId);

      fs.onSnapshot(ref, (snap)=>{
        const d = snap.exists() ? snap.data() : null;

        // Title/meta may come from local tournament.json via your other code;
        // Keep stable if already set.
        if(titleEl && (!titleEl.textContent || titleEl.textContent==="Match")){
          titleEl.textContent = `Match ${matchId}`;
        }
        if(metaEl && (!metaEl.textContent || metaEl.textContent==="-")){
          metaEl.textContent = d?.meta || "";
        }

        // Basic score render
        const r = d?.innings?.[d?.currentInnings || 1]?.runs ?? 0;
        const w = d?.innings?.[d?.currentInnings || 1]?.wkts ?? 0;
        const balls = d?.innings?.[d?.currentInnings || 1]?.balls ?? 0;
        const ov = Math.floor(balls/6) + "." + (balls%6);

        if(liveScoreEl){
          liveScoreEl.innerHTML = `
            <div class="h2">${r}/${w} <span class="muted small">(${ov} ov)</span></div>
            <div class="muted small">Status: ${escapeHtml(d?.status || "UPCOMING")} • Innings: ${escapeHtml(String(d?.currentInnings || 1))}</div>
          `;
        }

        // Last balls badges
        if(lastBallsEl){
          const arr = Array.isArray(d?.lastBalls) ? d.lastBalls : [];
          lastBallsEl.innerHTML = arr.slice(-12).map(x=> `<span class="badge">${escapeHtml(x)}</span>`).join("");
        }
      });
    }catch(e){
      // ignore
    }
  }

  function wireScoringButtons(matchId){
    // Prefer existing scoring engine if present
    if(window.ScoreEngine && typeof window.ScoreEngine.bind === "function"){
      window.ScoreEngine.bind({ matchId, role: APP.role });
      return;
    }

    // Minimal scoring write (runs/wd/nb/w/undo) if you don't have engine wired
    const runBtns = document.querySelectorAll("[data-run]");
    runBtns.forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const v = parseInt(btn.getAttribute("data-run")||"0", 10);
        await pushEvent(matchId, { t:"RUN", v });
      });
    });

    const btnW = $("#btnW");
    if(btnW) btnW.addEventListener("click", ()=> pushEvent(matchId, { t:"W" }));

    const btnWD = $("#btnWD");
    if(btnWD) btnWD.addEventListener("click", ()=> pushEvent(matchId, { t:"WD" }));

    const btnNB = $("#btnNB");
    if(btnNB) btnNB.addEventListener("click", ()=> pushEvent(matchId, { t:"NB" }));

    const btnUndo = $("#btnUndo");
    if(btnUndo) btnUndo.addEventListener("click", ()=> pushEvent(matchId, { t:"UNDO" }));
  }

  async function pushEvent(matchId, evt){
    try{
      const fb = await ensureFirebase();
      const { db, fs } = fb;

      // Scorer/admin only (double safety)
      if(!isScorerRole()) return;

      const ref = fs.doc(db, "matches", matchId);
      const snap = await fs.getDoc(ref);
      const now = fs.serverTimestamp();

      // Initialize doc if missing
      if(!snap.exists()){
        await fs.setDoc(ref, {
          status: "LIVE",
          currentInnings: 1,
          innings: {
            1: { runs:0, wkts:0, balls:0 },
            2: { runs:0, wkts:0, balls:0 }
          },
          lastBalls: [],
          updatedAt: now,
          updatedBy: APP.uid || null
        }, { merge:true });
      }

      // Apply minimal update (NOT full cricket yet)
      const s2 = await fs.getDoc(ref);
      const d = s2.data() || {};
      const inn = d.currentInnings || 1;
      const innObj = (d.innings && d.innings[inn]) ? d.innings[inn] : { runs:0, wkts:0, balls:0 };

      let runs = innObj.runs || 0;
      let wkts = innObj.wkts || 0;
      let balls = innObj.balls || 0;

      const lastBalls = Array.isArray(d.lastBalls) ? d.lastBalls.slice() : [];

      if(evt.t === "UNDO"){
        // very simple undo: revert last badge only if exists
        const last = lastBalls.pop();
        // can't perfectly revert without full log; leave for next phase
        await fs.updateDoc(ref, { lastBalls, updatedAt: now, updatedBy: APP.uid || null });
        return;
      }

      if(evt.t === "RUN"){
        runs += (evt.v || 0);
        balls += 1;
        lastBalls.push(String(evt.v || 0));
      }else if(evt.t === "W"){
        wkts += 1;
        balls += 1;
        lastBalls.push("W");
      }else if(evt.t === "WD"){
        runs += 1;
        lastBalls.push("WD");
      }else if(evt.t === "NB"){
        runs += 1;
        lastBalls.push("NB");
      }

      // keep lastBalls small
      while(lastBalls.length > 24) lastBalls.shift();

      await fs.updateDoc(ref, {
        status: "LIVE",
        [`innings.${inn}.runs`]: runs,
        [`innings.${inn}.wkts`]: wkts,
        [`innings.${inn}.balls`]: balls,
        lastBalls,
        updatedAt: now,
        updatedBy: APP.uid || null
      });

    }catch(e){
      // ignore for now
      console.error(e);
    }
  }

  // --------- SCORECARD PAGE ----------
  async function initScorecardPage(params){
    const matchId = getMatchId(params);
    // If your repo already has scorecard renderer:
    if(window.Scorecard && typeof window.Scorecard.init === "function"){
      window.Scorecard.init({ matchId });
      return;
    }

    // Minimal fallback: show live innings in a card
    const el = $("#scorecard") || APP.mount;
    try{
      const fb = await ensureFirebase();
      const { db, fs } = fb;
      const ref = fs.doc(db, "matches", matchId);
      fs.onSnapshot(ref, (snap)=>{
        const d = snap.exists() ? snap.data() : null;
        const i1 = d?.innings?.[1] || {};
        const i2 = d?.innings?.[2] || {};
        el.innerHTML = `
          <div class="card">
            <div class="h1">Scorecard — ${escapeHtml(matchId)}</div>
            <div class="muted small">Live snapshot</div>
            <hr class="sep"/>
            <div class="h2">Innings 1: ${i1.runs||0}/${i1.wkts||0} (${Math.floor((i1.balls||0)/6)}.${(i1.balls||0)%6})</div>
            <div class="h2" style="margin-top:8px">Innings 2: ${i2.runs||0}/${i2.wkts||0} (${Math.floor((i2.balls||0)/6)}.${(i2.balls||0)%6})</div>
            <div style="margin-top:12px">
              <a class="btn" href="#/match?id=${encodeURIComponent(matchId)}">Back to Match</a>
            </div>
          </div>
        `;
      });
    }catch(e){
      el.innerHTML = `<div class="card"><div class="h1">Scorecard</div><div class="muted small">${escapeHtml(e?.message||e)}</div></div>`;
    }
  }

  // --------- BOOT ----------
  function boot(){
    APP.mount = $("#app") || document.body;

    window.addEventListener("hashchange", navigate);
    // first load
    if(!location.hash) location.hash = "#/home";
    navigate();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
