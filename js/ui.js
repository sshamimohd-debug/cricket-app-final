(function(){
  const $ = (s, el=document)=>el.querySelector(s);

  function setTheme(theme){
    document.body.setAttribute("data-theme", theme);
    const btn = $("#btnTheme");
    if(btn) btn.textContent = theme === "dark" ? "Dark" : "Light";
    localStorage.setItem("theme", theme);
  }

  function initTopbar(){
    const btnBack = $("#btnBack");
    btnBack.addEventListener("click", ()=>{
      if(history.length>1) history.back();
      else location.hash = "#/home";
    });

    const btnTheme = $("#btnTheme");
    btnTheme.addEventListener("click", ()=>{
      const cur = document.body.getAttribute("data-theme") || "dark";
      setTheme(cur === "dark" ? "light" : "dark");
    });

    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
  }

  function cardMatch(m, status){
    const badge = status==="LIVE" ? `<span class="badge live">LIVE</span>`
      : status==="DONE" ? `<span class="badge done">RESULT</span>`
      : `<span class="badge up">UPCOMING</span>`;

    return `
      <div class="card">
        <div class="row">
          <div>
            <div class="h2">${U.esc(m.teamA)} vs ${U.esc(m.teamB)}</div>
            <div class="muted small">Group ${U.esc(m.group)} • ${U.esc(m.time)} • Match ${U.esc(m.id)}</div>
          </div>
          <div class="badges">${badge}</div>
        </div>
        <div class="kpi">
          <div class="pill">Open: <b>${U.esc(m.teamA)}</b></div>
          <div class="pill">Vs: <b>${U.esc(m.teamB)}</b></div>
        </div>
        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap">
          <a class="btn primary" href="#/match?id=${encodeURIComponent(m.id)}">Open Match</a>
          <a class="btn" href="#/scorecard?id=${encodeURIComponent(m.id)}">Scorecard</a>
        </div>
      </div>
    `;
  }

  window.UI = { initTopbar, cardMatch, setTheme };
})();
