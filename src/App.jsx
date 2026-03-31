import { useState, useCallback } from "react";

const ADMIN_PASSWORD = "***REMOVED***";

const initialTeams = {
  A: ["Team A1", "Team A2", "Team A3"],
  B: ["Team B1", "Team B2", "Team B3"],
  C: ["Team C1", "Team C2", "Team C3", "Team C4"],
};

function generateMatches(teams, group) {
  const matches = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      matches.push({ id: `${group}-${i}-${j}`, home: teams[i], away: teams[j], homeScore: "", awayScore: "", wo: "none", yellowHome: 0, yellowAway: 0, redHome: 0, redAway: 0, scorers: [] });
  return matches;
}

const initMatches = {
  A: generateMatches(initialTeams.A, "A"),
  B: generateMatches(initialTeams.B, "B"),
  C: generateMatches(initialTeams.C, "C"),
};

const initKnockout = {
  semi1: { homeScore: "", awayScore: "", wo: "none" }, // Juara A vs Runner Up C
  semi2: { homeScore: "", awayScore: "", wo: "none" }, // Juara B vs Juara C
  final: { homeScore: "", awayScore: "", wo: "none" },
  third: { homeScore: "", awayScore: "", wo: "none" }, // Perebutan juara 3
};

function calcStats(teams, matches) {
  const stats = {};
  teams.forEach(t => stats[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, yc: 0, rc: 0, cards: 0 });
  matches.forEach(m => {
    if (m.wo === "none" && (m.homeScore === "" || m.awayScore === "")) return;
    let hs, as_, hw, hd, hl, aw, ad, al;
    if (m.wo === "home_wo") { hs=3;as_=0;hw=1;hd=0;hl=0;aw=0;ad=0;al=1; }
    else if (m.wo === "away_wo") { hs=0;as_=3;hw=0;hd=0;hl=1;aw=1;ad=0;al=0; }
    else {
      hs=parseInt(m.homeScore);as_=parseInt(m.awayScore);
      if(hs>as_){hw=1;hd=0;hl=0;aw=0;ad=0;al=1;}
      else if(hs<as_){hw=0;hd=0;hl=1;aw=1;ad=0;al=0;}
      else{hw=0;hd=1;hl=0;aw=0;ad=1;al=0;}
    }
    const h=stats[m.home],a=stats[m.away];
    h.p++;h.w+=hw;h.d+=hd;h.l+=hl;h.gf+=hs;h.ga+=as_;h.gd+=hs-as_;h.pts+=hw*3+hd;
    a.p++;a.w+=aw;a.d+=ad;a.l+=al;a.gf+=as_;a.ga+=hs;a.gd+=as_-hs;a.pts+=aw*3+ad;
    h.yc+=parseInt(m.yellowHome)||0;h.rc+=parseInt(m.redHome)||0;
    a.yc+=parseInt(m.yellowAway)||0;a.rc+=parseInt(m.redAway)||0;
  });
  Object.values(stats).forEach(s=>s.cards=s.yc+s.rc*2);
  const arr=Object.values(stats);

  function getH2H(teamA,teamB){
    const m=matches.find(m=>(m.home===teamA&&m.away===teamB)||(m.home===teamB&&m.away===teamA));
    if(!m||m.homeScore===""||m.awayScore==="")return 0;
    const hs=parseInt(m.homeScore),as_=parseInt(m.awayScore);
    if((m.home===teamA&&hs>as_)||(m.away===teamA&&as_>hs))return 1;
    if((m.home===teamB&&hs>as_)||(m.away===teamB&&as_>hs))return -1;
    return 0;
  }

  function isCircular(group){
    if(group.length<3)return false;
    const wins={};
    group.forEach(t=>wins[t]=0);
    for(let i=0;i<group.length;i++)
      for(let j=i+1;j<group.length;j++){
        const r=getH2H(group[i],group[j]);
        if(r===1)wins[group[i]]++;
        else if(r===-1)wins[group[j]]++;
      }
    const vals=Object.values(wins);
    return vals.every(w=>w===vals[0]);
  }

  // Tahap 1: Sort by poin, selisih gol, akumulasi kartu
  arr.sort((a,b)=>{
    if(b.pts!==a.pts)return b.pts-a.pts;
    if(b.gd!==a.gd)return b.gd-a.gd;
    return a.cards-b.cards;
  });

  // Tahap 2: Dalam grup yang sama poin+SG, terapkan h2h — kecuali circular (fallback ke kartu)
  let i=0;
  while(i<arr.length){
    let j=i+1;
    while(j<arr.length&&arr[j].pts===arr[i].pts&&arr[j].gd===arr[i].gd)j++;
    if(j-i>1){
      const group=arr.slice(i,j);
      if(!isCircular(group.map(t=>t.team))){
        group.sort((a,b)=>{const r=getH2H(a.team,b.team);return r!==0?-r:a.cards-b.cards;});
        for(let k=0;k<group.length;k++)arr[i+k]=group[k];
      }
    }
    i=j;
  }

  return arr;
}

function calcTopScorers(allMatches) {
  const map = {};
  Object.values(allMatches).flat().forEach(m => {
    (m.scorers || []).forEach(s => {
      const teamName = s.side === "home" ? m.home : m.away;
      const key = `${s.name}||${teamName}`;
      if (!map[key]) map[key] = { name: s.name, team: teamName, goals: 0 };
      map[key].goals += parseInt(s.goals) || 0;
    });
  });
  return Object.values(map).filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals);
}

const COLORS={A:"#3b82f6",B:"#10b981",C:"#f59e0b"};

// ─── KNOCKOUT HELPERS ────────────────────────────────────────────
function getKnockoutWinner(home, away, match) {
  if (!home || !away) return null;
  if (match.wo === "home_wo") return home;
  if (match.wo === "away_wo") return away;
  if (match.homeScore === "" || match.awayScore === "") return null;
  const hs = parseInt(match.homeScore), as_ = parseInt(match.awayScore);
  if (hs > as_) return home;
  if (as_ > hs) return away;
  return null;
}
function getKnockoutLoser(home, away, match) {
  const w = getKnockoutWinner(home, away, match);
  if (!w) return null;
  return w === home ? away : home;
}

// ─── MATCH CARD (untuk bagan) ────────────────────────────────────
function MatchCard({ label, home, away, match, isAdmin, onUpdate }) {
  const ph = "Belum ditentukan";
  const wo = match.wo;
  const scored = wo === "none" ? (match.homeScore !== "" && match.awayScore !== "") : true;
  const hs = wo === "home_wo" ? 3 : wo === "away_wo" ? 0 : parseInt(match.homeScore) || 0;
  const as_ = wo === "away_wo" ? 3 : wo === "home_wo" ? 0 : parseInt(match.awayScore) || 0;
  const winner = scored && home && away ? (hs > as_ ? home : as_ > hs ? away : null) : null;

  const teamRow = (team, score, isHome) => (
    <div style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:8,
      borderBottom: isHome ? "1px solid #f1f5f9" : "none",
      background: winner && winner === team ? "#f0fdf4" : "#fff" }}>
      <div style={{ flex:1, fontWeight:600, fontSize:13, color: team ? "#1e293b" : "#94a3b8" }}>
        {team || ph}
        {winner === team && <span style={{ marginLeft:6, fontSize:10, background:"#10b981", color:"#fff", borderRadius:4, padding:"1px 5px" }}>MENANG</span>}
      </div>
      {isAdmin ? (
        wo !== "none"
          ? <span style={{ fontWeight:700, color:"#7c3aed", fontSize:14 }}>{score}</span>
          : <input type="number" min="0" value={isHome ? match.homeScore : match.awayScore}
              onChange={e => onUpdate({ ...match, [isHome?"homeScore":"awayScore"]: e.target.value })}
              disabled={!home || !away}
              style={{ width:38, textAlign:"center", border:"1px solid #e2e8f0", borderRadius:6, padding:"3px 4px", fontSize:13, fontWeight:700, color:"#1e293b" }} />
      ) : (
        scored && home && away && <span style={{ fontWeight:800, fontSize:15, color: winner === team ? "#10b981" : "#64748b" }}>{score}</span>
      )}
    </div>
  );

  return (
    <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 2px 10px #0002" }}>
      <div style={{ background:"#1e3a5f", color:"#fff", padding:"7px 14px", fontSize:11, fontWeight:700, textAlign:"center", letterSpacing:1 }}>{label}</div>
      {teamRow(home, hs, true)}
      {teamRow(away, as_, false)}
      {isAdmin && home && away && (
        <div style={{ padding:"6px 14px 10px", background:"#f8fafc" }}>
          <select value={wo} onChange={e => onUpdate({ ...match, wo: e.target.value })}
            style={{ fontSize:11, border:"1px solid #e2e8f0", borderRadius:4, padding:"2px 6px", width:"100%", color:"#64748b" }}>
            <option value="none">— Normal —</option>
            <option value="home_wo">{home} WO</option>
            <option value="away_wo">{away} WO</option>
          </select>
        </div>
      )}
      {wo !== "none" && <div style={{ padding:"3px 14px 8px", background:"#f5f3ff", fontSize:11, color:"#7c3aed", fontWeight:700, textAlign:"center" }}>WO</div>}
    </div>
  );
}

// ─── BRACKET BAGAN ───────────────────────────────────────────────
function Bracket({ semifinalists, knockout, onUpdate, isAdmin }) {
  const s1h = semifinalists[0]?.team; // Juara A
  const s1a = semifinalists[3]?.team; // Runner Up C
  const s2h = semifinalists[1]?.team; // Juara B
  const s2a = semifinalists[2]?.team; // Juara C

  const w1 = getKnockoutWinner(s1h, s1a, knockout.semi1);
  const w2 = getKnockoutWinner(s2h, s2a, knockout.semi2);
  const l1 = getKnockoutLoser(s1h, s1a, knockout.semi1);
  const l2 = getKnockoutLoser(s2h, s2a, knockout.semi2);
  const champion = getKnockoutWinner(w1, w2, knockout.final);
  const third = getKnockoutWinner(l1, l2, knockout.third);

  const Arrow = () => (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:8, color:"#cbd5e1", fontSize:11, fontWeight:600, margin:"4px 0" }}>
      <div style={{ flex:1, height:1, background:"#e2e8f0" }} />
      <span>▼</span>
      <div style={{ flex:1, height:1, background:"#e2e8f0" }} />
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      {/* SEMIFINAL */}
      <div style={{ fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:2, marginBottom:8, textTransform:"uppercase", textAlign:"center" }}>Semifinal</div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <div style={{ flex:"1 1 220px" }}>
          <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4, textAlign:"center" }}>Semi 1</div>
          <MatchCard label={`${s1h||"Juara A"} vs ${s1a||"Runner Up C"}`} home={s1h} away={s1a}
            match={knockout.semi1} isAdmin={isAdmin} onUpdate={v=>onUpdate("semi1",v)} />
        </div>
        <div style={{ flex:"1 1 220px" }}>
          <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4, textAlign:"center" }}>Semi 2</div>
          <MatchCard label={`${s2h||"Juara B"} vs ${s2a||"Juara C"}`} home={s2h} away={s2a}
            match={knockout.semi2} isAdmin={isAdmin} onUpdate={v=>onUpdate("semi2",v)} />
        </div>
      </div>

      <Arrow />

      {/* FINAL */}
      <div style={{ fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:2, marginBottom:8, textTransform:"uppercase", textAlign:"center" }}>Final</div>
      <div style={{ maxWidth:360, margin:"0 auto", width:"100%" }}>
        <MatchCard label="🏆 GRAND FINAL" home={w1} away={w2}
          match={knockout.final} isAdmin={isAdmin} onUpdate={v=>onUpdate("final",v)} />
      </div>

      {/* CHAMPION */}
      {champion && (
        <>
          <Arrow />
          <div style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)", borderRadius:16, padding:"28px 20px", textAlign:"center", color:"#fff", boxShadow:"0 6px 24px #f59e0b55" }}>
            <div style={{ fontSize:48 }}>🏆</div>
            <div style={{ fontSize:24, fontWeight:800, marginTop:8 }}>{champion}</div>
            <div style={{ fontSize:13, opacity:0.85, marginTop:4 }}>Juara Turnamen Futsal</div>
          </div>
        </>
      )}

      {/* PEREBUTAN JUARA 3 */}
      {(l1 || l2) && (
        <div style={{ marginTop:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:2, marginBottom:8, textTransform:"uppercase", textAlign:"center" }}>Perebutan Juara 3</div>
          <div style={{ maxWidth:360, margin:"0 auto", width:"100%" }}>
            <MatchCard label={`${l1||"?"} vs ${l2||"?"}`} home={l1} away={l2}
              match={knockout.third} isAdmin={isAdmin} onUpdate={v=>onUpdate("third",v)} />
          </div>
          {third && (
            <div style={{ marginTop:12, textAlign:"center", background:"#f1f5f9", borderRadius:10, padding:"14px", color:"#64748b" }}>
              <span style={{ fontSize:20 }}>🥉</span>
              <span style={{ fontWeight:700, fontSize:15, color:"#1e293b", marginLeft:8 }}>{third}</span>
              <span style={{ fontSize:12, marginLeft:6 }}>— Juara 3</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
const BG={A:"#eff6ff",B:"#ecfdf5",C:"#fffbeb"};

// ─── LOGIN SCREEN ───────────────────────────────────────────────
function LoginScreen({ onLogin, onBack }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const submit = () => {
    if (pw === ADMIN_PASSWORD) { onLogin(); }
    else { setErr(true); setPw(""); }
  };
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e3a5f,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"40px 36px", width:340, boxShadow:"0 20px 60px #0004" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🔐</div>
          <div style={{ fontWeight:800, fontSize:20, color:"#1e293b" }}>Admin Login</div>
          <div style={{ color:"#94a3b8", fontSize:13, marginTop:4 }}>Masukkan password untuk mengedit data</div>
        </div>
        <input type="password" placeholder="Password admin..." value={pw}
          onChange={e=>{setPw(e.target.value);setErr(false);}}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{ width:"100%", padding:"12px 14px", border:`2px solid ${err?"#ef4444":"#e2e8f0"}`, borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:8 }} />
        {err && <div style={{ color:"#ef4444", fontSize:12, marginBottom:8 }}>❌ Password salah, coba lagi.</div>}
        <button onClick={submit} style={{ width:"100%", padding:"12px", background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:10 }}>
          Masuk sebagai Admin
        </button>
        <button onClick={onBack} style={{ width:"100%", padding:"10px", background:"#f1f5f9", color:"#64748b", border:"none", borderRadius:10, fontWeight:600, fontSize:13, cursor:"pointer" }}>
          ← Kembali ke Tampilan Publik
        </button>
      </div>
    </div>
  );
}

// ─── STANDINGS TABLE (shared) ────────────────────────────────────
function StandingsTable({ grp, stats, isAdmin }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ background:"#f8fafc" }}>
            {["#","Tim","M","M","S","K","GM","GK","SG","🟡","🔴","Poin"].map((h,i)=>(
              <th key={i} style={{ padding:"8px 6px", color:"#64748b", textAlign:i<2?"left":"center", fontWeight:600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s,i)=>{
            const isAdv=(grp==="C"&&i<2)||(grp!=="C"&&i===0);
            const isRu=grp==="C"&&i===1;
            return(
              <tr key={s.team} style={{ borderBottom:"1px solid #f1f5f9", background:isAdv?BG[grp]:"#fff" }}>
                <td style={{ padding:"8px 6px", fontWeight:700, color:isAdv?COLORS[grp]:"#94a3b8" }}>{i+1}{isAdv?"✓":""}</td>
                <td style={{ padding:"8px 6px", fontWeight:600, color:"#1e293b" }}>
                  {s.team}
                  {isAdv&&!isRu&&<span style={{ fontSize:10, background:COLORS[grp], color:"#fff", borderRadius:4, padding:"1px 4px", marginLeft:4 }}>Lolos</span>}
                  {isRu&&<span style={{ fontSize:10, background:"#f59e0b", color:"#fff", borderRadius:4, padding:"1px 4px", marginLeft:4 }}>Runner Up</span>}
                </td>
                {[s.p,s.w,s.d,s.l,s.gf,s.ga].map((v,j)=>(
                  <td key={j} style={{ padding:"8px 6px", textAlign:"center", color:j===1?"#10b981":j===2?"#f59e0b":j===3?"#ef4444":"#1e293b" }}>{v}</td>
                ))}
                <td style={{ padding:"8px 6px", textAlign:"center", fontWeight:600, color:s.gd>0?"#10b981":s.gd<0?"#ef4444":"#64748b" }}>{s.gd>0?"+":""}{s.gd}</td>
                <td style={{ padding:"8px 6px", textAlign:"center" }}>{s.yc}</td>
                <td style={{ padding:"8px 6px", textAlign:"center" }}>{s.rc}</td>
                <td style={{ padding:"8px 6px", textAlign:"center", fontWeight:700, color:COLORS[grp], fontSize:14 }}>{s.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── TOP SCORERS TABLE (shared) ──────────────────────────────────
function TopScorers({ allMatches }) {
  const scorers = calcTopScorers(allMatches);
  return (
    <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
      <div style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>
        ⚽ Pencetak Gol Terbanyak
      </div>
      {scorers.length === 0 ? (
        <div style={{ padding:32, textAlign:"center", color:"#94a3b8", fontSize:13 }}>
          Belum ada data pencetak gol
        </div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["#","Pemain","Tim","⚽ Gol"].map((h,i)=>(
                  <th key={i} style={{ padding:"8px 10px", color:"#64748b", textAlign:i<3?"left":"center", fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scorers.map((s,i)=>(
                <tr key={`${s.name}-${s.team}`} style={{ borderBottom:"1px solid #f1f5f9", background:i===0?"#fffbeb":i===1?"#f8fafc":i===2?"#fff7ed":"#fff" }}>
                  <td style={{ padding:"10px 10px", fontWeight:700, fontSize:15, color:i===0?"#d97706":i===1?"#64748b":i===2?"#92400e":"#94a3b8" }}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                  </td>
                  <td style={{ padding:"10px 10px", fontWeight:600, color:"#1e293b" }}>{s.name}</td>
                  <td style={{ padding:"10px 10px", color:"#64748b", fontSize:12 }}>{s.team}</td>
                  <td style={{ padding:"10px 10px", textAlign:"center", fontWeight:800, color:"#f59e0b", fontSize:18 }}>{s.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PUBLIC VIEW ─────────────────────────────────────────────────
function PublicView({ teams, matches, knockout, onAdminClick }) {
  const [tab, setTab] = useState("standings");
  const statsA=calcStats(teams.A,matches.A);
  const statsB=calcStats(teams.B,matches.B);
  const statsC=calcStats(teams.C,matches.C);
  const semifinalists=[statsA[0],statsB[0],statsC[0],statsC[1]];

  const matchResult = (m) => {
    if (m.wo==="home_wo") return { score:"3 - 0", label:"WO", color:"#7c3aed" };
    if (m.wo==="away_wo") return { score:"0 - 3", label:"WO", color:"#7c3aed" };
    if (m.homeScore===""||m.awayScore==="") return null;
    return { score:`${m.homeScore} - ${m.awayScore}`, label:"", color:"#1e293b" };
  };

  return (
    <div style={{ fontFamily:"Inter,sans-serif", background:"#f8fafc", minHeight:"100vh", padding:16 }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius:16, padding:"20px 24px", marginBottom:20, color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>⚽ Turnamen Futsal</h1>
            <p style={{ margin:"4px 0 0", opacity:0.8, fontSize:13 }}>10 Tim · 3 Grup · Live Standings</p>
          </div>
          <button onClick={onAdminClick} style={{ background:"#ffffff22", border:"1px solid #ffffff44", color:"#fff", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
            🔐 Admin
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {[["standings","📊 Klasemen"],["schedule","📋 Jadwal & Hasil"],["topscorer","⚽ Top Skor"],["bracket","🏆 Bagan"],["advance","Tim Lolos"]].map(([k,v])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, background:tab===k?"#2563eb":"#fff", color:tab===k?"#fff":"#64748b", boxShadow:tab===k?"0 2px 8px #2563eb44":"0 1px 3px #0001" }}>{v}</button>
          ))}
        </div>

        {tab==="standings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {[["A",statsA],["B",statsB],["C",statsC]].map(([grp,stats])=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14, display:"flex", justifyContent:"space-between" }}>
                  <span>Grup {grp}</span>
                  <span style={{ fontSize:11, opacity:0.85 }}>{grp==="C"?"Top 2 lolos":"Juara lolos"}</span>
                </div>
                <StandingsTable grp={grp} stats={stats} />
              </div>
            ))}
            <div style={{ background:"#fef9c3", borderRadius:10, padding:"12px 16px", fontSize:12, color:"#92400e", lineHeight:1.7 }}>
              <b>📌 Keterangan:</b> M=Main · Hijau=Menang · Kuning=Seri · Merah=Kalah · GM=Gol Masuk · GK=Gol Kemasukan · SG=Selisih Gol<br/>
              <b>Prioritas Ranking:</b> Poin → Selisih Gol → Head-to-Head → Akumulasi Kartu
            </div>
          </div>
        )}

        {tab==="schedule" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {["A","B","C"].map(grp=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>Grup {grp}</div>
                <div style={{ padding:"0 16px 12px" }}>
                  {matches[grp].map((m,i)=>{
                    const res=matchResult(m);
                    return(
                      <div key={m.id} style={{ display:"flex", alignItems:"center", padding:"10px 0", borderBottom:i<matches[grp].length-1?"1px solid #f1f5f9":"none" }}>
                        <div style={{ flex:1, textAlign:"right", fontWeight:600, fontSize:13, color:"#1e293b" }}>{m.home}</div>
                        <div style={{ width:90, textAlign:"center", margin:"0 12px" }}>
                          {res ? (
                            <div style={{ background:res.color==="#7c3aed"?"#f5f3ff":"#f1f5f9", borderRadius:8, padding:"4px 10px" }}>
                              <div style={{ fontWeight:700, color:res.color, fontSize:14 }}>{res.score}</div>
                              {res.label && <div style={{ fontSize:10, color:res.color }}>{res.label}</div>}
                            </div>
                          ) : (
                            <div style={{ background:"#f8fafc", borderRadius:8, padding:"4px 10px", color:"#cbd5e1", fontSize:12, fontWeight:600 }}>VS</div>
                          )}
                        </div>
                        <div style={{ flex:1, textAlign:"left", fontWeight:600, fontSize:13, color:"#1e293b" }}>{m.away}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="topscorer" && (
          <TopScorers allMatches={matches} />
        )}

        {tab==="bracket" && (
          <div style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 1px 6px #0001" }}>
            <Bracket
              semifinalists={[statsA[0],statsB[0],statsC[0],statsC[1]]}
              knockout={knockout}
              onUpdate={()=>{}}
              isAdmin={false}
            />
          </div>
        )}

        {tab==="advance" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
              <div style={{ background:"#1e3a5f", color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>🏆 4 Tim Lolos Semifinal</div>
              <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  [statsA[0],"Juara Grup A",COLORS.A],
                  [statsB[0],"Juara Grup B",COLORS.B],
                  [statsC[0],"Juara Grup C",COLORS.C],
                  [statsC[1],"Runner Up Grup C","#10b981"],
                ].map(([s,label,c],i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, background:`${c}11`, border:`2px solid ${c}33` }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:c, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16 }}>
                      {i<3?"🥇":"🥈"}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{s?.team || <span style={{ color:"#cbd5e1" }}>Belum ditentukan</span>}</div>
                      <div style={{ fontSize:12, color:"#64748b" }}>{label} · {s?.pts ?? 0} poin · SG {s?.gd>=0?"+":""}{s?.gd ?? 0}</div>
                    </div>
                    <div style={{ marginLeft:"auto", background:c, color:"#fff", borderRadius:8, padding:"4px 12px", fontSize:11, fontWeight:700 }}>LOLOS ✓</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:"#fff", borderRadius:12, padding:16, boxShadow:"0 1px 6px #0001", fontSize:12, color:"#64748b", lineHeight:1.8 }}>
              <b style={{ color:"#1e293b" }}>📜 Sistem Pertandingan</b><br/>
              Menang: 3 poin · Seri: 1 poin · Kalah: 0 poin · WO: Skor 3-0<br/>
              Ranking: Poin → Selisih Gol → Head-to-Head → Kartu<br/>
              Runner Up Terbaik: Poin → Selisih Gol → Kartu → Adu Penalti (3 penendang)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────
function AdminView({ teams, setTeams, matches, setMatches, knockout, setKnockout, onSave, onLogout }) {
  const [tab, setTab] = useState("group");
  const [openScorer, setOpenScorer] = useState(null); // matchId yang sedang dibuka
  const [newScorer, setNewScorer] = useState({ name: "", side: "home", goals: 1 });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const statsA=calcStats(teams.A,matches.A);
  const statsB=calcStats(teams.B,matches.B);
  const statsC=calcStats(teams.C,matches.C);
  const runnerC=statsC[1];
  const semifinalists=[statsA[0],statsB[0],statsC[0],runnerC];

  const updateMatch=(grp,id,field,val)=>{
    setMatches(prev=>({...prev,[grp]:prev[grp].map(m=>m.id===id?{...m,[field]:val}:m)}));
  };
  const updateTeamName=(grp,idx,val)=>{
    setTeams(prev=>{
      const newTeams={...prev,[grp]:prev[grp].map((t,i)=>i===idx?val:t)};
      setMatches(old=>({...old,[grp]:generateMatches(newTeams[grp],grp)}));
      return newTeams;
    });
  };

  const addScorer = (grp, matchId) => {
    if (!newScorer.name.trim()) return;
    setMatches(prev => ({
      ...prev,
      [grp]: prev[grp].map(m => m.id === matchId
        ? { ...m, scorers: [...(m.scorers||[]), { name: newScorer.name.trim(), side: newScorer.side, goals: parseInt(newScorer.goals)||1 }] }
        : m
      )
    }));
    setNewScorer({ name: "", side: "home", goals: 1 });
  };

  const removeScorer = (grp, matchId, idx) => {
    setMatches(prev => ({
      ...prev,
      [grp]: prev[grp].map(m => m.id === matchId
        ? { ...m, scorers: (m.scorers||[]).filter((_,i) => i !== idx) }
        : m
      )
    }));
  };

  return (
    <div style={{ fontFamily:"Inter,sans-serif", background:"#f8fafc", minHeight:"100vh", padding:16 }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ background:"linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius:16, padding:"20px 24px", marginBottom:20, color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>⚙️ Panel Admin</h1>
            <p style={{ margin:"4px 0 0", opacity:0.8, fontSize:13 }}>Edit data pertandingan futsal</p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={handleSave} style={{ background: saved ? "#10b98122" : "#ffffff22", border: `1px solid ${saved ? "#10b98166" : "#ffffff44"}`, color: saved ? "#6ee7b7" : "#fff", borderRadius:10, padding:"8px 16px", cursor:"pointer", fontSize:12, fontWeight:700, transition:"all 0.2s" }}>
              {saved ? "✅ Tersimpan!" : "💾 Simpan"}
            </button>
            <button onClick={onLogout} style={{ background:"#ef444422", border:"1px solid #ef444466", color:"#fca5a5", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
              🚪 Logout
            </button>
          </div>
        </div>

        <div style={{ background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:10, padding:"10px 16px", marginBottom:16, fontSize:12, color:"#92400e" }}>
          🔐 <b>Mode Admin Aktif</b> — Anda dapat mengedit nama tim, skor, kartu, status WO, dan pencetak gol.
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {[["group","📋 Grup & Jadwal"],["standings","📊 Klasemen"],["topscorer","⚽ Top Skor"],["bracket","🏆 Bagan"],["advance","Tim Lolos"]].map(([k,v])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, background:tab===k?"#2563eb":"#fff", color:tab===k?"#fff":"#64748b", boxShadow:tab===k?"0 2px 8px #2563eb44":"0 1px 3px #0001" }}>{v}</button>
          ))}
        </div>

        {tab==="group" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {["A","B","C"].map(grp=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:15, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>Grup {grp} {grp==="C"?"(4 Tim)":"(3 Tim)"}</span>
                  <span style={{ fontSize:12, opacity:0.85 }}>{grp==="C"?"Top 2 lolos":"Juara lolos"}</span>
                </div>
                <div style={{ padding:"12px 20px", background:BG[grp], display:"flex", gap:8, flexWrap:"wrap" }}>
                  {teams[grp].map((t,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:11, color:"#94a3b8" }}>Tim {i+1}:</span>
                      <input value={t} onChange={e=>updateTeamName(grp,i,e.target.value)}
                        style={{ border:`1px solid ${COLORS[grp]}44`, borderRadius:6, padding:"3px 8px", fontSize:12, fontWeight:600, width:90, color:"#1e293b" }} />
                    </div>
                  ))}
                </div>
                <div style={{ padding:"0 20px 16px" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr style={{ background:"#f1f5f9" }}>
                        {["Home","Skor","Away","WO","🟡H","🔴H","🟡A","🔴A","⚽"].map((h,i)=>(
                          <th key={i} style={{ padding:"6px 4px", textAlign:i<3?"left":"center", color:"#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matches[grp].map((m,idx)=>(
                        <>
                          <tr key={m.id} style={{ borderBottom: openScorer===m.id ? "none" : "1px solid #f1f5f9", background:idx%2===0?"#fff":"#fafafa" }}>
                            <td style={{ padding:"6px 8px", fontWeight:600, color:"#1e293b" }}>{m.home}</td>
                            <td style={{ padding:"6px 4px", textAlign:"center" }}>
                              {m.wo!=="none"?(
                                <span style={{ color:"#7c3aed", fontWeight:700 }}>{m.wo==="home_wo"?"3 - 0":"0 - 3"}</span>
                              ):(
                                <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"center" }}>
                                  <input type="number" min="0" value={m.homeScore} onChange={e=>updateMatch(grp,m.id,"homeScore",e.target.value)}
                                    style={{ width:34, textAlign:"center", border:"1px solid #e2e8f0", borderRadius:4, padding:"2px" }} />
                                  <span>-</span>
                                  <input type="number" min="0" value={m.awayScore} onChange={e=>updateMatch(grp,m.id,"awayScore",e.target.value)}
                                    style={{ width:34, textAlign:"center", border:"1px solid #e2e8f0", borderRadius:4, padding:"2px" }} />
                                </div>
                              )}
                            </td>
                            <td style={{ padding:"6px 8px", fontWeight:600, color:"#1e293b" }}>{m.away}</td>
                            <td style={{ padding:"6px 4px", textAlign:"center" }}>
                              <select value={m.wo} onChange={e=>updateMatch(grp,m.id,"wo",e.target.value)}
                                style={{ fontSize:11, border:"1px solid #e2e8f0", borderRadius:4, padding:"2px 4px" }}>
                                <option value="none">-</option>
                                <option value="home_wo">Home WO</option>
                                <option value="away_wo">Away WO</option>
                              </select>
                            </td>
                            {["yellowHome","redHome","yellowAway","redAway"].map(f=>(
                              <td key={f} style={{ padding:"4px 2px", textAlign:"center" }}>
                                <input type="number" min="0" value={m[f]} onChange={e=>updateMatch(grp,m.id,f,e.target.value)}
                                  style={{ width:30, textAlign:"center", border:"1px solid #e2e8f0", borderRadius:4, padding:"2px", fontSize:11 }} />
                              </td>
                            ))}
                            <td style={{ padding:"4px 2px", textAlign:"center" }}>
                              <button
                                onClick={()=>{ setOpenScorer(openScorer===m.id?null:m.id); setNewScorer({ name:"", side:"home", goals:1 }); }}
                                style={{ background: openScorer===m.id?"#f59e0b":"#f1f5f9", border:"none", borderRadius:4, padding:"3px 7px", cursor:"pointer", fontSize:11, fontWeight:600, color: openScorer===m.id?"#fff":"#64748b" }}>
                                {(m.scorers||[]).length > 0 ? `⚽${(m.scorers||[]).reduce((s,c)=>s+(parseInt(c.goals)||0),0)}` : "⚽"}
                              </button>
                            </td>
                          </tr>
                          {openScorer===m.id && (
                            <tr key={`${m.id}-scorer`} style={{ borderBottom:"1px solid #f1f5f9" }}>
                              <td colSpan={9} style={{ padding:"10px 12px", background:"#fffbeb" }}>
                                <div style={{ fontSize:11, fontWeight:700, color:"#92400e", marginBottom:8 }}>
                                  ⚽ Pencetak Gol: <span style={{ color:"#64748b", fontWeight:400 }}>{m.home}</span> vs <span style={{ color:"#64748b", fontWeight:400 }}>{m.away}</span>
                                </div>
                                {/* Daftar scorer yang sudah ditambahkan */}
                                {(m.scorers||[]).length > 0 && (
                                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                                    {(m.scorers||[]).map((s,si)=>(
                                      <div key={si} style={{ display:"flex", alignItems:"center", gap:4, background:"#fff", border:"1px solid #fcd34d", borderRadius:6, padding:"3px 8px", fontSize:11 }}>
                                        <span style={{ fontWeight:600, color:"#1e293b" }}>{s.name}</span>
                                        <span style={{ color:"#94a3b8" }}>({s.side==="home"?m.home:m.away})</span>
                                        <span style={{ color:"#f59e0b", fontWeight:700 }}>×{s.goals}</span>
                                        <button onClick={()=>removeScorer(grp,m.id,si)} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", padding:"0 2px", fontSize:12, lineHeight:1 }}>×</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Form tambah scorer */}
                                <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                                  <input
                                    placeholder="Nama pemain"
                                    value={newScorer.name}
                                    onChange={e=>setNewScorer(p=>({...p,name:e.target.value}))}
                                    onKeyDown={e=>e.key==="Enter"&&addScorer(grp,m.id)}
                                    style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 8px", fontSize:11, width:130 }} />
                                  <select value={newScorer.side} onChange={e=>setNewScorer(p=>({...p,side:e.target.value}))}
                                    style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 6px", fontSize:11 }}>
                                    <option value="home">{m.home}</option>
                                    <option value="away">{m.away}</option>
                                  </select>
                                  <input type="number" min="1" value={newScorer.goals}
                                    onChange={e=>setNewScorer(p=>({...p,goals:e.target.value}))}
                                    style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 6px", fontSize:11, width:44, textAlign:"center" }} />
                                  <button onClick={()=>addScorer(grp,m.id)}
                                    style={{ background:"#f59e0b", color:"#fff", border:"none", borderRadius:6, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                    + Tambah
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="standings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {[["A",statsA],["B",statsB],["C",statsC]].map(([grp,stats])=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>Klasemen Grup {grp}</div>
                <StandingsTable grp={grp} stats={stats} isAdmin />
              </div>
            ))}
          </div>
        )}

        {tab==="topscorer" && (
          <TopScorers allMatches={matches} />
        )}

        {tab==="bracket" && (
          <div style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 1px 6px #0001" }}>
            <div style={{ fontSize:12, color:"#92400e", background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:8, padding:"8px 14px", marginBottom:16 }}>
              ✏️ <b>Mode Admin:</b> Input skor semifinal, final, dan perebutan juara 3 di bawah.
            </div>
            <Bracket
              semifinalists={[statsA[0],statsB[0],statsC[0],statsC[1]]}
              knockout={knockout}
              onUpdate={(key,val)=>setKnockout(prev=>({...prev,[key]:val}))}
              isAdmin={true}
            />
          </div>
        )}

        {tab==="advance" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
              <div style={{ background:"#1e3a5f", color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>🏆 4 Tim Lolos Semifinal</div>
              <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  [statsA[0],"Juara Grup A",COLORS.A],
                  [statsB[0],"Juara Grup B",COLORS.B],
                  [statsC[0],"Juara Grup C",COLORS.C],
                  [statsC[1],"Runner Up Grup C","#10b981"],
                ].map(([s,label,c],i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, background:`${c}11`, border:`2px solid ${c}33` }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:c, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16 }}>
                      {i<3?"🥇":"🥈"}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{s?.team || <span style={{ color:"#cbd5e1" }}>Belum ditentukan</span>}</div>
                      <div style={{ fontSize:12, color:"#64748b" }}>{label} · {s?.pts??0} poin · SG {s?.gd>=0?"+":""}{s?.gd??0}</div>
                    </div>
                    <div style={{ marginLeft:"auto", background:c, color:"#fff", borderRadius:8, padding:"4px 12px", fontSize:11, fontWeight:700 }}>LOLOS ✓</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────
function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

export default function App() {
  const [teams, setTeams] = useState(() => loadLS("futsal_teams", initialTeams));
  const [matches, setMatches] = useState(() => loadLS("futsal_matches", initMatches));
  const [knockout, setKnockout] = useState(() => loadLS("futsal_knockout", initKnockout));
  const [mode, setMode] = useState("public"); // public | login | admin

  const handleSave = () => {
    localStorage.setItem("futsal_teams", JSON.stringify(teams));
    localStorage.setItem("futsal_matches", JSON.stringify(matches));
    localStorage.setItem("futsal_knockout", JSON.stringify(knockout));
  };

  if (mode === "login") return <LoginScreen onLogin={()=>setMode("admin")} onBack={()=>setMode("public")} />;
  if (mode === "admin") return <AdminView teams={teams} setTeams={setTeams} matches={matches} setMatches={setMatches} knockout={knockout} setKnockout={setKnockout} onSave={handleSave} onLogout={()=>setMode("public")} />;
  return <PublicView teams={teams} matches={matches} knockout={knockout} onAdminClick={()=>setMode("login")} />;
}
