(async function(){
  UI.initTopbar();

  // PWA SW
  if("serviceWorker" in navigator){
    try{ await navigator.serviceWorker.register("sw.js"); }catch(e){}
  }

  // Load tournament config
  const cfg = await fetch("data/tournament.json", {cache:"no-store"}).then(r=>r.json());

  function findMatch(id){
    return cfg.schedule.matches.find(x=>x.id===id);
  }

  // Routes
  R.on("/home", async ({mount})=>{
    const html = await R.loadPage("pages/home.html");
    mount.innerHTML = html;

    const wrap = mount.querySelector("#homeMatches");
    const list = cfg.schedule.matches.map(m=>{
      const st = DB.getMatchState(m.id);
      return UI.cardMatch(m, st.status);
    }).join("");
    wrap.innerHTML = `<div class="grid">${list}</div>`;
  });

  R.on("/match", async ({mount, params})=>{
    const html = await R.loadPage("pages/match.html");
    mount.innerHTML = html;

    const id = params.get("id") || "A1";
    const meta = findMatch(id);
    const st = DB.getMatchState(id);

    mount.querySelector("#matchTitle").textContent = `${meta.teamA} vs ${meta.teamB}`;
    mount.querySelector("#matchMeta").textContent = `Group ${meta.group} • ${meta.time} • Match ${meta.id}`;

    const render = ()=>{
      const s = DB.getMatchState(id);
      const inn = s.innings[s.currentInnings];
      mount.querySelector("#liveScore").innerHTML =
        `<div class="h1">${inn.runs}/${inn.wickets} <span class="muted">(${U.fmtOvers(inn.balls)})</span></div>
         <div class="muted small">Status: ${s.status} • Innings: ${s.currentInnings===0 ? "1st" : "2nd"}</div>`;
      mount.querySelector("#lastBalls").innerHTML =
        (s.ballLog.slice(-12).reverse().map(b=>`<span class="badge">${U.esc(b.label||b.type||"BALL")}</span>`).join(" ")) || `<span class="muted small">No balls yet</span>`;
    };

    const addBall = (ball)=>{ DB.pushBall(id, ball); render(); };

    mount.querySelectorAll("[data-run]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const r = parseInt(btn.getAttribute("data-run"),10);
        addBall({ type:"RUN", runs:r, label: String(r) });
      });
    });
    mount.querySelector("#btnW").addEventListener("click", ()=> addBall({ type:"RUN", runs:0, wicket:true, label:"W" }));
    mount.querySelector("#btnWD").addEventListener("click", ()=> addBall({ type:"WD", runs:0, label:"WD" }));
    mount.querySelector("#btnNB").addEventListener("click", ()=> addBall({ type:"NB", runs:0, label:"NB" }));
    mount.querySelector("#btnUndo").addEventListener("click", ()=>{ DB.undoBall(id); render(); });

    mount.querySelector("#btnToScorecard").href = `#/scorecard?id=${encodeURIComponent(id)}`;

    render();
  });

  R.on("/scorecard", async ({mount, params})=>{
    const html = await R.loadPage("pages/scorecard.html");
    mount.innerHTML = html;

    const id = params.get("id") || "A1";
    const meta = findMatch(id);
    const st = DB.getMatchState(id);

    mount.querySelector("#scTitle").textContent = `${meta.teamA} vs ${meta.teamB}`;
    mount.querySelector("#scMeta").textContent = `Group ${meta.group} • Match ${meta.id}`;

    const innA = st.innings[0];
    const innB = st.innings[1];

    mount.querySelector("#innA").innerHTML =
      `<div class="h2">${meta.teamA} Innings</div>
       <div class="kpi">
         <div class="pill">Runs: <b>${innA.runs}</b></div>
         <div class="pill">Wkts: <b>${innA.wickets}</b></div>
         <div class="pill">Overs: <b>${U.fmtOvers(innA.balls)}</b></div>
       </div>
       <div class="muted small">Extras: WD ${innA.extras.wd}, NB ${innA.extras.nb}, B ${innA.extras.b}, LB ${innA.extras.lb}</div>
       <hr class="sep"/>
       <div class="muted small">FOW: ${innA.fow.map(x=>`${x.atRuns} (${x.atOver})`).join(" • ") || "-"}</div>`;

    mount.querySelector("#innB").innerHTML =
      `<div class="h2">${meta.teamB} Innings</div>
       <div class="kpi">
         <div class="pill">Runs: <b>${innB.runs}</b></div>
         <div class="pill">Wkts: <b>${innB.wickets}</b></div>
         <div class="pill">Overs: <b>${U.fmtOvers(innB.balls)}</b></div>
       </div>
       <div class="muted small">Extras: WD ${innB.extras.wd}, NB ${innB.extras.nb}, B ${innB.extras.b}, LB ${innB.extras.lb}</div>
       <hr class="sep"/>
       <div class="muted small">FOW: ${innB.fow.map(x=>`${x.atRuns} (${x.atOver})`).join(" • ") || "-"}</div>`;

    mount.querySelector("#btnBackMatch").href = `#/match?id=${encodeURIComponent(id)}`;
  });

  R.on("/points", async ({mount})=>{
    const html = await R.loadPage("pages/points.html");
    mount.innerHTML = html;

    // Phase 2 demo: points table from scheduled teams only (Phase 3 में results-based auto update)
    const groups = cfg.groups.map(g=>{
      return {
        id: g.id,
        teams: g.teams.map(t=>({ team:t, played:0, won:0, lost:0, points:0 }))
      };
    });

    const wrap = mount.querySelector("#pointsWrap");
    wrap.innerHTML = groups.map(g=>{
      const rows = g.teams.map(r=>`
        <tr><td><b>${U.esc(r.team)}</b></td><td>${r.played}</td><td>${r.won}</td><td>${r.lost}</td><td><b>${r.points}</b></td></tr>
      `).join("");
      return `
        <div class="card">
          <div class="row">
            <div class="h2">Group ${g.id}</div>
            <div class="badge">Venue: ${U.esc(cfg.venues.find(v=>v.group===g.id)?.name || "-")}</div>
          </div>
          <table class="table">
            <thead><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="muted small" style="margin-top:8px">
            Note: PDF में tie-break NRR नहीं, “Decider Match” है. (Phase 3 में results के अनुसार points update होंगे)
          </div>
        </div>`;
    }).join("");
  });

  R.on("/teams", async ({mount})=>{
    const html = await R.loadPage("pages/teams.html");
    mount.innerHTML = html;

    const wrap = mount.querySelector("#teamsWrap");
    wrap.innerHTML = cfg.groups.map(g=>{
      const items = g.teams.map(t=>`<div class="badge">${U.esc(t)}</div>`).join("");
      return `<div class="card"><div class="row"><div class="h2">Group ${g.id}</div><div class="muted small">${U.esc(cfg.venues.find(v=>v.id===g.venue)?.name || "")}</div></div><div class="badges" style="margin-top:10px">${items}</div></div>`;
    }).join("");
  });

  R.on("/knockouts", async ({mount})=>{
    const html = await R.loadPage("pages/knockouts.html");
    mount.innerHTML = html;

    mount.querySelector("#koWrap").innerHTML = `
      <div class="card">
        <div class="h2">Semi Final 1</div>
        <div class="kpi">
          <div class="pill"><b>${U.esc(cfg.knockouts.semi_final_1.a)}</b></div>
          <div class="pill">vs</div>
          <div class="pill"><b>${U.esc(cfg.knockouts.semi_final_1.b)}</b></div>
        </div>
        <div class="muted small">Date: TBA (as per PDF)</div>
      </div>
      <div class="card">
        <div class="h2">Semi Final 2</div>
        <div class="kpi">
          <div class="pill"><b>${U.esc(cfg.knockouts.semi_final_2.a)}</b></div>
          <div class="pill">vs</div>
          <div class="pill"><b>${U.esc(cfg.knockouts.semi_final_2.b)}</b></div>
        </div>
        <div class="muted small">Date: TBA (as per PDF)</div>
      </div>
      <div class="card">
        <div class="h2">Final</div>
        <div class="kpi">
          <div class="pill"><b>${U.esc(cfg.knockouts.final.a)}</b></div>
          <div class="pill">vs</div>
          <div class="pill"><b>${U.esc(cfg.knockouts.final.b)}</b></div>
        </div>
        <div class="muted small">Date: TBA (as per PDF)</div>
      </div>
    `;
  });

  R.on("/rules", async ({mount})=>{
    const html = await R.loadPage("pages/rules.html");
    mount.innerHTML = html;

    mount.querySelector("#rulesWrap").innerHTML = `
      <div class="card">
        <div class="h2">Match Format</div>
        <div class="muted">10 overs per innings • Powerplay 3 overs • Max 2 overs per bowler • SIXIT tennis ball (Yellow)</div>
        <hr class="sep"/>
        <div class="h2">Key Rules (PDF)</div>
        <ul class="muted">
          <li>LBW लागू नहीं होगा</li>
          <li>Throw bowling prohibited; umpire can call No-ball</li>
          <li>Tie → Super Over (repeat until result)</li>
          <li>Substitution only if player absent + umpire permission + opponent captain consent</li>
          <li>Umpire decision final</li>
        </ul>
      </div>
      <div class="card">
        <div class="h2">Awards</div>
        <div class="badges" style="margin-top:10px">
          ${cfg.awards.map(a=>`<span class="badge">${U.esc(a.name)}</span>`).join("")}
        </div>
      </div>
    `;
  });

  // Admin route = separate folder entry page (Phase 3 में proper auth)
  R.on("/admin", async ({mount})=>{
    mount.innerHTML = `
      <div class="card">
        <div class="h2">Admin / Scorer Panel</div>
        <div class="muted">Open admin panel in new page:</div>
        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap">
          <a class="btn primary" href="admin/index.html">Admin Login</a>
          <a class="btn" href="admin/scorer.html">Scorer Console</a>
        </div>
        <div class="muted small" style="margin-top:10px">
          Phase 3 में Firebase login + role-based access enforce होगा.
        </div>
      </div>
    `;
  });

  R.on("/404", async ({mount})=>{
    mount.innerHTML = `<div class="card"><div class="h2">Page not found</div><div class="muted">Go to <a href="#/home">Home</a></div></div>`;
  });

  // Start router
  if(!location.hash) location.hash = "#/home";
  R.start();
})();
