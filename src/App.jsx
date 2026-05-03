import { useState, useCallback, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

const initialTeams = {
  A: ["Tim A1", "Tim A2", "Tim A3", "Tim A4"],
  B: ["Tim B1", "Tim B2", "Tim B3", "Tim B4"],
};

// Urutan matchday: [homeIdx, awayIdx, note]
const MATCH_ORDER = [
  [0, 1, (g, t) => `Pembuka Grup ${g}`],
  [2, 3, (g, t) => `Jeda untuk ${t[0]} & ${t[1]}`],
  [0, 2, (g, t) => `Matchday 2 Grup ${g}`],
  [1, 3, (g, t) => ``],
  [3, 0, (g, t) => `Matchday 3 (Penentuan)`],
  [1, 2, (g, t) => ``],
];

function generateMatches(teams, group) {
  return MATCH_ORDER.map(([i, j, noteFn], idx) => ({
    id: `${group}-${i}-${j}`,
    home: teams[i], away: teams[j],
    homeScore: "", awayScore: "", wo: "none",
    yellowHome: 0, yellowAway: 0, redHome: 0, redAway: 0,
    scorers: [], date: "", time: "",
    note: noteFn(group, teams),
    matchNo: 0, // diset saat initMatches
  }));
}

// Rekonstruksi matches dari MATCH_ORDER, pertahankan skor lama by team pair
function normalizeMatches(fbMatches, teams, group) {
  const fresh = generateMatches(teams, group);
  fresh.forEach((nm, i) => {
    nm.matchNo = i * 2 + (group === "A" ? 1 : 2);
    const old = (fbMatches || []).find(m =>
      (m.home === nm.home && m.away === nm.away) ||
      (m.home === nm.away && m.away === nm.home)
    );
    if (!old) return;
    const rev = old.home === nm.away;
    nm.homeScore   = rev ? old.awayScore   : old.homeScore;
    nm.awayScore   = rev ? old.homeScore   : old.awayScore;
    nm.wo          = old.wo === "home_wo" ? (rev ? "away_wo" : "home_wo")
                   : old.wo === "away_wo" ? (rev ? "home_wo" : "away_wo")
                   : "none";
    nm.yellowHome  = rev ? (old.yellowAway||0) : (old.yellowHome||0);
    nm.redHome     = rev ? (old.redAway||0)    : (old.redHome||0);
    nm.yellowAway  = rev ? (old.yellowHome||0) : (old.yellowAway||0);
    nm.redAway     = rev ? (old.redHome||0)    : (old.redAway||0);
    nm.scorers     = (old.scorers||[]).map(s => ({ ...s, side: rev ? (s.side==="home"?"away":"home") : s.side }));
    nm.date        = old.date  || "";
    nm.time        = old.time  || "";
  });
  return fresh;
}

// roster: { [teamName]: { players: [{name,number,pos}], officials: [{name,role}] } }
const initRoster = {};

const _mA = generateMatches(initialTeams.A, "A");
const _mB = generateMatches(initialTeams.B, "B");
// matchNo interleaved: A→1,3,5,7,9,11 · B→2,4,6,8,10,12
_mA.forEach((m, i) => m.matchNo = i * 2 + 1);
_mB.forEach((m, i) => m.matchNo = i * 2 + 2);
const initMatches = { A: _mA, B: _mB };

const initKnockout = {
  semi1: { homeScore: "", awayScore: "", wo: "none" }, // Juara A vs Runner Up B
  semi2: { homeScore: "", awayScore: "", wo: "none" }, // Runner Up A vs Juara B
  final: { homeScore: "", awayScore: "", wo: "none" },
  third: { homeScore: "", awayScore: "", wo: "none" }, // Perebutan juara 3
};

const initSponsors = []; // { name, logoUrl }

// ─── SPONSOR SECTION ─────────────────────────────────────────────
function SponsorSection({ sponsors }) {
  if (!sponsors || sponsors.length === 0) return null;
  return (
    <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001", marginTop:20 }}>
      <div style={{ background:"linear-gradient(135deg,#1e3a5f,#2563eb)", color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14, textAlign:"center", letterSpacing:1 }}>
        ✨ Sponsor & Pendukung
      </div>
      <div style={{ padding:"20px 16px", display:"flex", flexWrap:"wrap", gap:16, justifyContent:"center", alignItems:"center" }}>
        {sponsors.map((s, i) => (
          <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:"12px 20px", borderRadius:10, border:"1px solid #e2e8f0", background:"#f8fafc", minWidth:100 }}>
            {s.logoUrl ? (
              <img src={s.logoUrl} alt={s.name} style={{ height:48, objectFit:"contain", maxWidth:120 }} />
            ) : (
              <div style={{ width:48, height:48, borderRadius:10, background:"linear-gradient(135deg,#2563eb,#1d4ed8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, color:"#fff", fontWeight:800 }}>
                {s.name.charAt(0)}
              </div>
            )}
            <span style={{ fontSize:12, fontWeight:700, color:"#1e293b", textAlign:"center" }}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FOOTER ──────────────────────────────────────────────────────
function Footer() {
  return (
    <div style={{ marginTop:24, padding:"20px 0 8px", textAlign:"center" }}>
      <div style={{ fontSize:13, color:"#64748b", lineHeight:2 }}>
        <span style={{ fontWeight:700, color:"#1e293b" }}>Turnamen Futsal For Unity Karang Taruna Kelurahan Kalisari</span><br/>
        <span>Karang Taruna Kelurahan Kalisari 2026</span><br/>
        <span style={{ fontSize:11 }}>Dibuat oleh <b>Rahmat Mulyana</b> — Panitia FFU 2026</span>
      </div>
      <div style={{ marginTop:8, fontSize:10, color:"#cbd5e1" }}>
        © 2026 FFU Kalisari · All rights reserved
      </div>
    </div>
  );
}

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

const COLORS={A:"#3b82f6",B:"#10b981"};

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
  const s1a = semifinalists[3]?.team; // Runner Up B
  const s2h = semifinalists[1]?.team; // Runner Up A
  const s2a = semifinalists[2]?.team; // Juara B

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
          <MatchCard label={`${s1h||"Juara A"} vs ${s1a||"Runner Up B"}`} home={s1h} away={s1a}
            match={knockout.semi1} isAdmin={isAdmin} onUpdate={v=>onUpdate("semi1",v)} />
        </div>
        <div style={{ flex:"1 1 220px" }}>
          <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4, textAlign:"center" }}>Semi 2</div>
          <MatchCard label={`${s2h||"Runner Up A"} vs ${s2a||"Juara B"}`} home={s2h} away={s2a}
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
const BG={A:"#eff6ff",B:"#ecfdf5"};

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
            const isAdv=i<2;
            const isRu=i===1;
            return(
              <tr key={s.team} style={{ borderBottom:"1px solid #f1f5f9", background:isAdv?BG[grp]:"#fff" }}>
                <td style={{ padding:"8px 6px", fontWeight:700, color:isAdv?COLORS[grp]:"#94a3b8" }}>{i+1}{isAdv?"✓":""}</td>
                <td style={{ padding:"8px 6px", fontWeight:600, color:"#1e293b" }}>
                  {s.team}
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

// ─── ROSTER VIEW (publik) ────────────────────────────────────────
function RosterView({ teams, roster }) {
  const allTeams = [...teams.A, ...teams.B];
  const [selected, setSelected] = useState(allTeams[0] || "");
  const data = roster[selected] || { players: [], officials: [] };

  const posColor = { GK:"#7c3aed", FP:"#2563eb", CF:"#10b981" };
  const posLabel = { GK:"Kiper", FP:"Pemain Lapangan", CF:"Pivot" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Pilih Tim */}
      <div style={{ background:"#fff", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 6px #0001" }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:8 }}>Pilih Tim:</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {["A","B"].map(grp => teams[grp].map(t => (
            <button key={t} onClick={()=>setSelected(t)}
              style={{ padding:"6px 14px", borderRadius:8, border:`2px solid ${selected===t?COLORS[grp]:"#e2e8f0"}`, background:selected===t?COLORS[grp]:"#fff", color:selected===t?"#fff":"#1e293b", fontWeight:600, fontSize:12, cursor:"pointer" }}>
              {t}
            </button>
          )))}
        </div>
      </div>

      {/* Data tim */}
      <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
        <div style={{ background:"#1e3a5f", color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>
          👥 {selected}
        </div>

        {/* Official */}
        <div style={{ padding:"12px 16px 0" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Official</div>
          {data.officials.length === 0
            ? <div style={{ fontSize:12, color:"#cbd5e1", paddingBottom:12 }}>Belum ada data official</div>
            : <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
                {data.officials.map((o,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, background:"#f1f5f9", border:"1px solid #e2e8f0" }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:"#1e3a5f", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800 }}>
                      {o.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:12, color:"#1e293b" }}>{o.name}</div>
                      <div style={{ fontSize:10, color:"#64748b" }}>{o.role}</div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Pemain */}
        <div style={{ padding:"0 16px 16px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Pemain</div>
          {data.players.length === 0
            ? <div style={{ fontSize:12, color:"#cbd5e1" }}>Belum ada data pemain</div>
            : <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["No","Nama","Posisi"].map((h,i)=>(
                      <th key={i} style={{ padding:"7px 8px", textAlign:i===0?"center":"left", color:"#64748b", fontWeight:600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.players.sort((a,b)=>(parseInt(a.number)||99)-(parseInt(b.number)||99)).map((p,i)=>(
                    <tr key={i} style={{ borderBottom:"1px solid #f1f5f9" }}>
                      <td style={{ padding:"8px", textAlign:"center", fontWeight:700, color:"#2563eb", width:36 }}>{p.number||"-"}</td>
                      <td style={{ padding:"8px", fontWeight:600, color:"#1e293b" }}>{p.name}</td>
                      <td style={{ padding:"8px" }}>
                        <span style={{ fontSize:10, background:(posColor[p.pos]||"#64748b")+"22", color:posColor[p.pos]||"#64748b", borderRadius:4, padding:"2px 6px", fontWeight:700 }}>
                          {posLabel[p.pos]||p.pos||"-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>
    </div>
  );
}

// ─── ROSTER ADMIN ────────────────────────────────────────────────
function RosterAdmin({ teams, roster, setRoster }) {
  const allTeams = [...teams.A, ...teams.B];
  const [selected, setSelected] = useState(allTeams[0] || "");
  const [newPlayer, setNewPlayer] = useState({ name:"", number:"", pos:"FP" });
  const [newOfficial, setNewOfficial] = useState({ name:"", role:"" });

  const data = roster[selected] || { players: [], officials: [] };
  const update = (patch) => setRoster(prev => ({ ...prev, [selected]: { ...data, ...patch } }));

  const addPlayer = () => {
    if (!newPlayer.name.trim()) return;
    update({ players: [...data.players, { ...newPlayer, name: newPlayer.name.trim() }] });
    setNewPlayer({ name:"", number:"", pos:"FP" });
  };
  const removePlayer = (i) => update({ players: data.players.filter((_,idx)=>idx!==i) });

  const addOfficial = () => {
    if (!newOfficial.name.trim()) return;
    update({ officials: [...data.officials, { ...newOfficial, name: newOfficial.name.trim() }] });
    setNewOfficial({ name:"", role:"" });
  };
  const removeOfficial = (i) => update({ officials: data.officials.filter((_,idx)=>idx!==i) });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Pilih Tim */}
      <div style={{ background:"#fff", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 6px #0001" }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:8 }}>Pilih Tim:</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {["A","B"].map(grp => teams[grp].map(t => (
            <button key={t} onClick={()=>setSelected(t)}
              style={{ padding:"6px 14px", borderRadius:8, border:`2px solid ${selected===t?COLORS[grp]:"#e2e8f0"}`, background:selected===t?COLORS[grp]:"#fff", color:selected===t?"#fff":"#1e293b", fontWeight:600, fontSize:12, cursor:"pointer" }}>
              {t}
            </button>
          )))}
        </div>
      </div>

      {/* Form Official */}
      <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
        <div style={{ background:"#1e3a5f", color:"#fff", padding:"10px 16px", fontWeight:700, fontSize:13 }}>👔 Official — {selected}</div>
        <div style={{ padding:12, display:"flex", flexDirection:"column", gap:8 }}>
          {data.officials.map((o,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:8, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
              <span style={{ flex:1, fontWeight:600, fontSize:12 }}>{o.name}</span>
              <span style={{ fontSize:11, color:"#64748b" }}>{o.role}</span>
              <button onClick={()=>removeOfficial(i)} style={{ background:"#fee2e2", border:"none", color:"#ef4444", borderRadius:5, padding:"2px 8px", cursor:"pointer", fontSize:11, fontWeight:700 }}>×</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <input placeholder="Nama official" value={newOfficial.name} onChange={e=>setNewOfficial(p=>({...p,name:e.target.value}))}
              style={{ flex:2, border:"1px solid #e2e8f0", borderRadius:6, padding:"6px 10px", fontSize:12, minWidth:120 }} />
            <input placeholder="Jabatan (misal: Pelatih)" value={newOfficial.role} onChange={e=>setNewOfficial(p=>({...p,role:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&addOfficial()}
              style={{ flex:2, border:"1px solid #e2e8f0", borderRadius:6, padding:"6px 10px", fontSize:12, minWidth:120 }} />
            <button onClick={addOfficial} style={{ background:"#1e3a5f", color:"#fff", border:"none", borderRadius:6, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Tambah</button>
          </div>
        </div>
      </div>

      {/* Form Pemain */}
      <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
        <div style={{ background:"#2563eb", color:"#fff", padding:"10px 16px", fontWeight:700, fontSize:13 }}>⚽ Pemain — {selected}</div>
        <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>
          {data.players.length > 0 && (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginBottom:6 }}>
              <thead><tr style={{ background:"#f8fafc" }}>
                {["No","Nama","Pos",""].map((h,i)=><th key={i} style={{ padding:"6px 8px", textAlign:i===0?"center":"left", color:"#64748b", fontWeight:600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.players.sort((a,b)=>(parseInt(a.number)||99)-(parseInt(b.number)||99)).map((p,i)=>(
                  <tr key={i} style={{ borderBottom:"1px solid #f1f5f9" }}>
                    <td style={{ padding:"6px 8px", textAlign:"center", fontWeight:700, color:"#2563eb", width:36 }}>{p.number||"-"}</td>
                    <td style={{ padding:"6px 8px", fontWeight:600 }}>{p.name}</td>
                    <td style={{ padding:"6px 8px", fontSize:11, color:"#64748b" }}>{p.pos||"-"}</td>
                    <td style={{ padding:"6px 8px" }}>
                      <button onClick={()=>removePlayer(data.players.indexOf(p))} style={{ background:"#fee2e2", border:"none", color:"#ef4444", borderRadius:5, padding:"2px 8px", cursor:"pointer", fontSize:11, fontWeight:700 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <input placeholder="Nama pemain" value={newPlayer.name} onChange={e=>setNewPlayer(p=>({...p,name:e.target.value}))}
              style={{ flex:3, border:"1px solid #e2e8f0", borderRadius:6, padding:"6px 10px", fontSize:12, minWidth:120 }} />
            <input type="number" placeholder="No" value={newPlayer.number} onChange={e=>setNewPlayer(p=>({...p,number:e.target.value}))}
              style={{ width:56, border:"1px solid #e2e8f0", borderRadius:6, padding:"6px 8px", fontSize:12, textAlign:"center" }} />
            <select value={newPlayer.pos} onChange={e=>setNewPlayer(p=>({...p,pos:e.target.value}))}
              style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"6px 8px", fontSize:12 }}>
              <option value="GK">Kiper (GK)</option>
              <option value="FP">Pemain (FP)</option>
              <option value="CF">Pivot (CF)</option>
            </select>
            <button onClick={addPlayer} onKeyDown={e=>e.key==="Enter"&&addPlayer()}
              style={{ background:"#2563eb", color:"#fff", border:"none", borderRadius:6, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Tambah</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PUBLIC VIEW ─────────────────────────────────────────────────
function PublicView({ teams, matches, knockout, sponsors, roster, onAdminClick }) {
  const [tab, setTab] = useState("standings");
  const statsA=calcStats(teams.A,matches.A);
  const statsB=calcStats(teams.B,matches.B);
  const semifinalists=[statsA[0],statsA[1],statsB[0],statsB[1]];

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
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Turnamen Futsal For Unity Kelurahan Kalisari 2026</h1>
            <p style={{ margin:"4px 0 0", opacity:0.8, fontSize:13 }}>8 Tim · 2 Grup · Live Standings</p>
            <p style={{ margin:"4px 0 0", opacity:0.8, fontSize:13 }}>Created by Rahmat Mulyana Panitia FFU 2026</p>
          </div>
          <button onClick={onAdminClick} style={{ background:"#ffffff22", border:"1px solid #ffffff44", color:"#fff", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
            🔐 Admin
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {[["standings","📊 Klasemen"],["schedule","📋 Jadwal & Hasil"],["topscorer","⚽ Top Skor"],["advance","Tim Lolos Semifinal"],["bracket","🏆 Bagan Semifinal"],["roster","👥 Tim & Pemain"]].map(([k,v])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, background:tab===k?"#2563eb":"#fff", color:tab===k?"#fff":"#64748b", boxShadow:tab===k?"0 2px 8px #2563eb44":"0 1px 3px #0001" }}>{v}</button>
          ))}
        </div>

        {tab==="standings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {[["A",statsA],["B",statsB]].map(([grp,stats])=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14, display:"flex", justifyContent:"space-between" }}>
                  <span>Grup {grp}</span>
                  <span style={{ fontSize:11, opacity:0.85 }}>{"Top 2 lolos"}</span>
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
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[...matches.A.map(m=>({...m,grp:"A"})), ...matches.B.map(m=>({...m,grp:"B"}))]
              .sort((a,b)=>(a.matchNo||0)-(b.matchNo||0))
              .map((m, i, arr)=>{
                const res=matchResult(m);
                const grp=m.grp;
                return(
                  <div key={m.id} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px #0001" }}>
                    {/* Header match */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", background:COLORS[grp]+"18", borderBottom:`2px solid ${COLORS[grp]}33` }}>
                      <span style={{ background:COLORS[grp], color:"#fff", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:800, minWidth:28, textAlign:"center" }}>
                        {String(m.matchNo||i+1).padStart(2,"0")}
                      </span>
                      <span style={{ fontSize:11, fontWeight:700, color:COLORS[grp] }}>Grup {grp}</span>
                      {m.note && <span style={{ fontSize:11, color:"#64748b", marginLeft:"auto" }}>{m.note}</span>}
                    </div>
                    <div style={{ padding:"10px 14px" }}>
                      {(m.date||m.time) && (
                        <div style={{ textAlign:"center", marginBottom:6 }}>
                          <span style={{ fontSize:11, background:"#f1f5f9", borderRadius:6, padding:"2px 10px", color:"#64748b", fontWeight:600 }}>
                            {m.date && new Date(m.date).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
                            {m.date && m.time && " · "}
                            {m.time && m.time+" WIB"}
                          </span>
                        </div>
                      )}
                      <div style={{ display:"flex", alignItems:"center" }}>
                        <div style={{ flex:1, textAlign:"right", fontWeight:700, fontSize:13, color:"#1e293b" }}>{m.home}</div>
                        <div style={{ width:90, textAlign:"center", margin:"0 12px" }}>
                          {res ? (
                            <div style={{ background:res.color==="#7c3aed"?"#f5f3ff":"#f1f5f9", borderRadius:8, padding:"4px 10px" }}>
                              <div style={{ fontWeight:700, color:res.color, fontSize:15 }}>{res.score}</div>
                              {res.label && <div style={{ fontSize:10, color:res.color }}>{res.label}</div>}
                            </div>
                          ) : (
                            <div style={{ background:"#f8fafc", borderRadius:8, padding:"4px 10px", color:"#cbd5e1", fontSize:12, fontWeight:600 }}>VS</div>
                          )}
                        </div>
                        <div style={{ flex:1, textAlign:"left", fontWeight:700, fontSize:13, color:"#1e293b" }}>{m.away}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {tab==="topscorer" && (
          <TopScorers allMatches={matches} />
        )}

        {tab==="roster" && (
          <RosterView teams={teams} roster={roster} />
        )}

        {tab==="bracket" && (
          <div style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 1px 6px #0001" }}>
            <Bracket
              semifinalists={[statsA[0],statsA[1],statsB[0],statsB[1]]}
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
                  [statsA[1],"Runner Up Grup A",COLORS.A],
                  [statsB[0],"Juara Grup B",COLORS.B],
                  [statsB[1],"Runner Up Grup B",COLORS.B],
                ].map(([s,label,c],i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, background:`${c}11`, border:`2px solid ${c}33` }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:c, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16 }}>
                      {i%2===0?"🥇":"🥈"}
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
              Semifinal: Juara A vs Runner Up B · Runner Up A vs Juara B
            </div>
          </div>
        )}
        <SponsorSection sponsors={sponsors} />
        <Footer />
      </div>
    </div>
  );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────
function AdminView({ teams, setTeams, matches, setMatches, knockout, setKnockout, sponsors, setSponsors, roster, setRoster, onSave, onLogout }) {
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
  const semifinalists=[statsA[0],statsA[1],statsB[0],statsB[1]];

  const updateMatch=(grp,id,field,val)=>{
    setMatches(prev=>({...prev,[grp]:prev[grp].map(m=>m.id===id?{...m,[field]:val}:m)}));
  };
  const updateTeamName=(grp,idx,val)=>{
    setTeams(prev=>{
      const newTeams={...prev,[grp]:prev[grp].map((t,i)=>i===idx?val:t)};
      setMatches(old=>{
        const newM = generateMatches(newTeams[grp], grp);
        // pertahankan skor & kartu yang sudah ada
        newM.forEach((nm, i) => {
          const old_ = old[grp][i];
          if (old_) Object.assign(nm, { homeScore:old_.homeScore, awayScore:old_.awayScore, wo:old_.wo, yellowHome:old_.yellowHome, redHome:old_.redHome, yellowAway:old_.yellowAway, redAway:old_.redAway, scorers:old_.scorers, date:old_.date, time:old_.time });
          nm.matchNo = i * 2 + (grp === "A" ? 1 : 2);
        });
        return {...old, [grp]: newM};
      });
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
          {[["group","📋 Grup & Jadwal"],["standings","📊 Klasemen"],["topscorer","⚽ Top Skor"],["bracket","🏆 Bagan"],["roster","👥 Tim & Pemain"],["advance","Tim Lolos"],["sponsor","✨ Sponsor"]].map(([k,v])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, background:tab===k?"#2563eb":"#fff", color:tab===k?"#fff":"#64748b", boxShadow:tab===k?"0 2px 8px #2563eb44":"0 1px 3px #0001" }}>{v}</button>
          ))}
        </div>

        {tab==="group" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {["A","B"].map(grp=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:15, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>Grup {grp} {"(4 Tim)"}</span>
                  <span style={{ fontSize:12, opacity:0.85 }}>{"Top 2 lolos"}</span>
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
                        {["Home","Skor","Away","WO","📅","⏰","🟡H","🔴H","🟡A","🔴A","⚽"].map((h,i)=>(
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
                            <td style={{ padding:"4px 2px", textAlign:"center" }}>
                              <input type="date" value={m.date||""} onChange={e=>updateMatch(grp,m.id,"date",e.target.value)}
                                style={{ border:"1px solid #e2e8f0", borderRadius:4, padding:"2px 3px", fontSize:10, width:110 }} />
                            </td>
                            <td style={{ padding:"4px 2px", textAlign:"center" }}>
                              <input type="time" value={m.time||""} onChange={e=>updateMatch(grp,m.id,"time",e.target.value)}
                                style={{ border:"1px solid #e2e8f0", borderRadius:4, padding:"2px 3px", fontSize:10, width:72 }} />
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
                              <td colSpan={11} style={{ padding:"10px 12px", background:"#fffbeb" }}>
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
                                {(()=>{
                                  const sidePlayers = (roster[newScorer.side==="home"?m.home:m.away]?.players||[]);
                                  const hasRoster = sidePlayers.length > 0;
                                  return (
                                    <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                                      <select value={newScorer.side} onChange={e=>setNewScorer(p=>({...p,side:e.target.value,name:""}))}
                                        style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 6px", fontSize:11 }}>
                                        <option value="home">{m.home}</option>
                                        <option value="away">{m.away}</option>
                                      </select>
                                      {hasRoster ? (
                                        <select value={newScorer.name} onChange={e=>setNewScorer(p=>({...p,name:e.target.value}))}
                                          style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 8px", fontSize:11, minWidth:140 }}>
                                          <option value="">— Pilih pemain —</option>
                                          {sidePlayers.sort((a,b)=>(parseInt(a.number)||99)-(parseInt(b.number)||99)).map((p,pi)=>(
                                            <option key={pi} value={p.name}>
                                              {p.number ? `#${p.number} ` : ""}{p.name}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          placeholder="Nama pemain"
                                          value={newScorer.name}
                                          onChange={e=>setNewScorer(p=>({...p,name:e.target.value}))}
                                          onKeyDown={e=>e.key==="Enter"&&addScorer(grp,m.id)}
                                          style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 8px", fontSize:11, width:130 }} />
                                      )}
                                      <input type="number" min="1" value={newScorer.goals}
                                        onChange={e=>setNewScorer(p=>({...p,goals:e.target.value}))}
                                        style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 6px", fontSize:11, width:44, textAlign:"center" }} />
                                      <button onClick={()=>addScorer(grp,m.id)}
                                        style={{ background:"#f59e0b", color:"#fff", border:"none", borderRadius:6, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                        + Tambah
                                      </button>
                                      {!hasRoster && (
                                        <span style={{ fontSize:10, color:"#94a3b8" }}>*Isi roster tim di tab "👥 Tim & Pemain" untuk pilih dari daftar</span>
                                      )}
                                    </div>
                                  );
                                })()}
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
            {[["A",statsA],["B",statsB]].map(([grp,stats])=>(
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
              semifinalists={[statsA[0],statsA[1],statsB[0],statsB[1]]}
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
                  [statsA[1],"Runner Up Grup A",COLORS.A],
                  [statsB[0],"Juara Grup B",COLORS.B],
                  [statsB[1],"Runner Up Grup B",COLORS.B],
                ].map(([s,label,c],i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, background:`${c}11`, border:`2px solid ${c}33` }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:c, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16 }}>
                      {i%2===0?"🥇":"🥈"}
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

        {tab==="roster" && (
          <RosterAdmin teams={teams} roster={roster} setRoster={setRoster} />
        )}

        {tab==="sponsor" && (
          <SponsorAdmin sponsors={sponsors} setSponsors={setSponsors} />
        )}
      </div>
    </div>
  );
}

// ─── SPONSOR ADMIN ────────────────────────────────────────────────
function SponsorAdmin({ sponsors, setSponsors }) {
  const [newName, setNewName] = useState("");
  const [newLogo, setNewLogo] = useState("");

  const add = () => {
    if (!newName.trim()) return;
    setSponsors(prev => [...prev, { name: newName.trim(), logoUrl: newLogo.trim() }]);
    setNewName(""); setNewLogo("");
  };

  const remove = (i) => setSponsors(prev => prev.filter((_,idx) => idx !== i));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
        <div style={{ background:"linear-gradient(135deg,#1e3a5f,#2563eb)", color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>✨ Kelola Sponsor</div>
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
          {sponsors.length === 0 && (
            <div style={{ textAlign:"center", color:"#94a3b8", padding:20, fontSize:13 }}>Belum ada sponsor. Tambahkan di bawah.</div>
          )}
          {sponsors.map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:10, border:"1px solid #e2e8f0", background:"#f8fafc" }}>
              {s.logoUrl
                ? <img src={s.logoUrl} alt={s.name} style={{ height:40, width:40, objectFit:"contain", borderRadius:6 }} />
                : <div style={{ width:40, height:40, borderRadius:8, background:"linear-gradient(135deg,#2563eb,#1d4ed8)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:18 }}>{s.name.charAt(0)}</div>
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13, color:"#1e293b" }}>{s.name}</div>
                {s.logoUrl && <div style={{ fontSize:10, color:"#94a3b8", wordBreak:"break-all" }}>{s.logoUrl}</div>}
              </div>
              <button onClick={() => remove(i)} style={{ background:"#fee2e2", border:"none", color:"#ef4444", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontWeight:700, fontSize:12 }}>Hapus</button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:"#fff", borderRadius:12, padding:16, boxShadow:"0 1px 6px #0001" }}>
        <div style={{ fontWeight:700, fontSize:13, color:"#1e293b", marginBottom:10 }}>+ Tambah Sponsor</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <input placeholder="Nama sponsor *" value={newName} onChange={e=>setNewName(e.target.value)}
            style={{ border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:13 }} />
          <input placeholder="URL logo (opsional) — misal: https://i.imgur.com/xxx.png" value={newLogo} onChange={e=>setNewLogo(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&add()}
            style={{ border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:13 }} />
          <button onClick={add} style={{ background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff", border:"none", borderRadius:8, padding:"10px", fontWeight:700, fontSize:13, cursor:"pointer" }}>
            + Tambah Sponsor
          </button>
        </div>
        <div style={{ marginTop:10, fontSize:11, color:"#94a3b8", lineHeight:1.6 }}>
          Jika tidak punya URL logo, inisial nama akan ditampilkan otomatis.<br/>
          Setelah menambah sponsor, klik <b>💾 Simpan</b> agar tersimpan ke semua perangkat.
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────
const DATA_DOC = doc(db, "tournament", "data");

export default function App() {
  const [teams, setTeams] = useState(initialTeams);
  const [matches, setMatches] = useState(initMatches);
  const [knockout, setKnockout] = useState(initKnockout);
  const [sponsors, setSponsors] = useState(initSponsors);
  const [roster, setRoster] = useState(initRoster);
  const [mode, setMode] = useState("public");
  const [loading, setLoading] = useState(true);

  // Sinkron real-time dari Firestore → semua perangkat update otomatis
  useEffect(() => {
    const unsub = onSnapshot(DATA_DOC, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.teams) setTeams(d.teams);
        if (d.matches) {
          const t = d.teams || {};
          setMatches({
            A: t.A ? normalizeMatches(d.matches.A, t.A, "A") : d.matches.A,
            B: t.B ? normalizeMatches(d.matches.B, t.B, "B") : d.matches.B,
          });
        }
        if (d.knockout) setKnockout(d.knockout);
        if (d.sponsors) setSponsors(d.sponsors);
        if (d.roster) setRoster(d.roster);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const handleSave = async () => {
    await setDoc(DATA_DOC, { teams, matches, knockout, sponsors, roster });
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,sans-serif", background:"#f8fafc" }}>
      <div style={{ textAlign:"center", color:"#64748b" }}>
        <div style={{ fontSize:36, marginBottom:12 }}>⚽</div>
        <div style={{ fontWeight:600 }}>Memuat data...</div>
      </div>
    </div>
  );

  if (mode === "login") return <LoginScreen onLogin={()=>setMode("admin")} onBack={()=>setMode("public")} />;
  if (mode === "admin") return <AdminView teams={teams} setTeams={setTeams} matches={matches} setMatches={setMatches} knockout={knockout} setKnockout={setKnockout} sponsors={sponsors} setSponsors={setSponsors} roster={roster} setRoster={setRoster} onSave={handleSave} onLogout={()=>setMode("public")} />;
  return <PublicView teams={teams} matches={matches} knockout={knockout} sponsors={sponsors} roster={roster} onAdminClick={()=>setMode("login")} />;
}
