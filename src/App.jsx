import { useState, useCallback } from "react";

const initialTeams = {
  A: ["Team A1", "Team A2", "Team A3"],
  B: ["Team B1", "Team B2", "Team B3"],
  C: ["Team C1", "Team C2", "Team C3", "Team C4"],
};

function generateMatches(teams, group) {
  const matches = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      matches.push({ id: `${group}-${i}-${j}`, home: teams[i], away: teams[j], homeScore: "", awayScore: "", wo: "none", yellowHome: 0, yellowAway: 0, redHome: 0, redAway: 0 });
  return matches;
}

const initMatches = {
  A: generateMatches(initialTeams.A, "A"),
  B: generateMatches(initialTeams.B, "B"),
  C: generateMatches(initialTeams.C, "C"),
};

function calcStats(teams, matches) {
  const stats = {};
  teams.forEach(t => stats[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, yc: 0, rc: 0, cards: 0 });

  matches.forEach(m => {
    if (m.wo === "none" && (m.homeScore === "" || m.awayScore === "")) return;
    let hs, as_, hw, hd, hl, aw, ad, al;
    if (m.wo === "home_wo") { hs = 3; as_ = 0; hw = 1; hd = 0; hl = 0; aw = 0; ad = 0; al = 1; }
    else if (m.wo === "away_wo") { hs = 0; as_ = 3; hw = 0; hd = 0; hl = 1; aw = 1; ad = 0; al = 0; }
    else {
      hs = parseInt(m.homeScore); as_ = parseInt(m.awayScore);
      if (hs > as_) { hw=1;hd=0;hl=0;aw=0;ad=0;al=1; }
      else if (hs < as_) { hw=0;hd=0;hl=1;aw=1;ad=0;al=0; }
      else { hw=0;hd=1;hl=0;aw=0;ad=1;al=0; }
    }
    const h = stats[m.home], a = stats[m.away];
    h.p++; h.w+=hw; h.d+=hd; h.l+=hl; h.gf+=hs; h.ga+=as_; h.gd+=hs-as_; h.pts+=hw*3+hd;
    a.p++; a.w+=aw; a.d+=ad; a.l+=al; a.gf+=as_; a.ga+=hs; a.gd+=as_-hs; a.pts+=aw*3+ad;
    h.yc += parseInt(m.yellowHome)||0; h.rc += parseInt(m.redHome)||0;
    a.yc += parseInt(m.yellowAway)||0; a.rc += parseInt(m.redAway)||0;
  });

  Object.values(stats).forEach(s => s.cards = s.yc + s.rc * 2);

  const arr = Object.values(stats);
  arr.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    // head to head
    const h2h = matches.find(m => (m.home===a.team&&m.away===b.team)||(m.home===b.team&&m.away===a.team));
    if (h2h && h2h.homeScore !== "" && h2h.awayScore !== "") {
      const hs = parseInt(h2h.homeScore), as_ = parseInt(h2h.awayScore);
      const aWin = (h2h.home===a.team && hs>as_)||(h2h.away===a.team && as_>hs);
      const bWin = (h2h.home===b.team && hs>as_)||(h2h.away===b.team && as_>hs);
      if (aWin) return -1; if (bWin) return 1;
    }
    return a.cards - b.cards;
  });
  return arr;
}

const COLORS = { A: "#3b82f6", B: "#10b981", C: "#f59e0b" };
const BG = { A: "#eff6ff", B: "#ecfdf5", C: "#fffbeb" };

export default function App() {
  const [teams, setTeams] = useState(initialTeams);
  const [matches, setMatches] = useState(initMatches);
  const [tab, setTab] = useState("group");
  const [editingTeam, setEditingTeam] = useState(null);

  const updateMatch = (grp, id, field, val) => {
    setMatches(prev => ({
      ...prev,
      [grp]: prev[grp].map(m => m.id === id ? { ...m, [field]: val } : m)
    }));
  };

  const updateTeamName = (grp, idx, val) => {
    setTeams(prev => {
      const newTeams = { ...prev, [grp]: prev[grp].map((t, i) => i === idx ? val : t) };
      setMatches(old => ({
        ...old,
        [grp]: generateMatches(newTeams[grp], grp)
      }));
      return newTeams;
    });
  };

  const statsA = calcStats(teams.A, matches.A);
  const statsB = calcStats(teams.B, matches.B);
  const statsC = calcStats(teams.C, matches.C);

  const advanceTeams = [statsA[0], statsB[0], ...statsC.slice(0, 2)];
  const runners = [statsA[1], statsB[1]];
  runners.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return a.cards - b.cards;
  });
  const bestRunner = runners[0];
  const semifinalists = [...advanceTeams, bestRunner];

  return (
    <div style={{ fontFamily: "Inter,sans-serif", background: "#f8fafc", minHeight: "100vh", padding: "16px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius: 16, padding: "20px 24px", marginBottom: 20, color: "#fff" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>⚽ Sistem Pertandingan Futsal</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.8, fontSize: 13 }}>10 Tim · 3 Grup · Fase Knockout</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["group","📋 Grup & Jadwal"],["standings","📊 Klasemen"],["advance","🏆 Lolos Fase Berikutnya"]].map(([k,v]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: tab===k ? "#2563eb" : "#fff", color: tab===k ? "#fff" : "#64748b", boxShadow: tab===k ? "0 2px 8px #2563eb44" : "0 1px 3px #0001" }}>
              {v}
            </button>
          ))}
        </div>

        {tab === "group" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {["A","B","C"].map(grp => (
              <div key={grp} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 6px #0001" }}>
                <div style={{ background: COLORS[grp], color: "#fff", padding: "12px 20px", fontWeight: 700, fontSize: 15, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Grup {grp} {grp==="C"?"(4 Tim)":"(3 Tim)"}</span>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>{grp==="C"?"Top 2 lolos":"Juara lolos"}</span>
                </div>
                {/* Team names */}
                <div style={{ padding: "12px 20px", background: BG[grp], display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {teams[grp].map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>Tim {i+1}:</span>
                      <input value={t} onChange={e => updateTeamName(grp, i, e.target.value)}
                        style={{ border: `1px solid ${COLORS[grp]}44`, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, width: 90, color: "#1e293b" }} />
                    </div>
                  ))}
                </div>
                {/* Matches */}
                <div style={{ padding: "0 20px 16px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th style={{ padding: "6px 8px", textAlign: "left", color: "#64748b" }}>Home</th>
                        <th style={{ padding: "6px 4px", textAlign: "center", color: "#64748b" }}>Skor</th>
                        <th style={{ padding: "6px 8px", textAlign: "left", color: "#64748b" }}>Away</th>
                        <th style={{ padding: "6px 4px", textAlign: "center", color: "#64748b" }}>WO</th>
                        <th style={{ padding: "6px 4px", textAlign: "center", color: "#fbbf24" }}>🟡H</th>
                        <th style={{ padding: "6px 4px", textAlign: "center", color: "#ef4444" }}>🔴H</th>
                        <th style={{ padding: "6px 4px", textAlign: "center", color: "#fbbf24" }}>🟡A</th>
                        <th style={{ padding: "6px 4px", textAlign: "center", color: "#ef4444" }}>🔴A</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches[grp].map((m, idx) => (
                        <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9", background: idx%2===0?"#fff":"#fafafa" }}>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: "#1e293b" }}>{m.home}</td>
                          <td style={{ padding: "6px 4px", textAlign: "center" }}>
                            {m.wo !== "none" ? (
                              <span style={{ color: "#7c3aed", fontWeight: 700 }}>{m.wo==="home_wo"?"3 - 0":"0 - 3"}</span>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
                                <input type="number" min="0" value={m.homeScore} onChange={e => updateMatch(grp, m.id, "homeScore", e.target.value)}
                                  style={{ width: 34, textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px" }} />
                                <span>-</span>
                                <input type="number" min="0" value={m.awayScore} onChange={e => updateMatch(grp, m.id, "awayScore", e.target.value)}
                                  style={{ width: 34, textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px" }} />
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: "#1e293b" }}>{m.away}</td>
                          <td style={{ padding: "6px 4px", textAlign: "center" }}>
                            <select value={m.wo} onChange={e => updateMatch(grp, m.id, "wo", e.target.value)}
                              style={{ fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 4px" }}>
                              <option value="none">-</option>
                              <option value="home_wo">Home WO</option>
                              <option value="away_wo">Away WO</option>
                            </select>
                          </td>
                          {["yellowHome","redHome","yellowAway","redAway"].map(f => (
                            <td key={f} style={{ padding: "4px 2px", textAlign: "center" }}>
                              <input type="number" min="0" value={m[f]} onChange={e => updateMatch(grp, m.id, f, e.target.value)}
                                style={{ width: 30, textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px", fontSize: 11 }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "standings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[["A", statsA], ["B", statsB], ["C", statsC]].map(([grp, stats]) => (
              <div key={grp} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 6px #0001" }}>
                <div style={{ background: COLORS[grp], color: "#fff", padding: "12px 20px", fontWeight: 700, fontSize: 14 }}>
                  Klasemen Grup {grp}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["#","Tim","M","M","S","K","GM","GK","SG","🟡","🔴","Poin"].map((h,i) => (
                          <th key={i} style={{ padding: "8px 6px", color: "#64748b", textAlign: i<2?"left":"center", fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((s, i) => {
                        const isAdvance = (grp==="C" && i<2) || (grp!=="C" && i===0);
                        const isRunner = grp!=="C" && i===1;
                        return (
                          <tr key={s.team} style={{ borderBottom: "1px solid #f1f5f9", background: isAdvance ? `${BG[grp]}` : "#fff" }}>
                            <td style={{ padding: "8px 6px", fontWeight: 700, color: isAdvance ? COLORS[grp] : "#94a3b8" }}>
                              {i+1}{isAdvance?"✓":""}
                            </td>
                            <td style={{ padding: "8px 6px", fontWeight: 600, color: "#1e293b" }}>
                              {s.team}
                              {isAdvance && <span style={{ fontSize: 10, background: COLORS[grp], color: "#fff", borderRadius: 4, padding: "1px 4px", marginLeft: 4 }}>Lolos</span>}
                              {isRunner && <span style={{ fontSize: 10, background: "#f59e0b", color: "#fff", borderRadius: 4, padding: "1px 4px", marginLeft: 4 }}>RU</span>}
                            </td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>{s.p}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center", color: "#10b981" }}>{s.w}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center", color: "#f59e0b" }}>{s.d}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center", color: "#ef4444" }}>{s.l}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>{s.gf}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>{s.ga}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, color: s.gd>0?"#10b981":s.gd<0?"#ef4444":"#64748b" }}>{s.gd>0?"+":""}{s.gd}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>{s.yc}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>{s.rc}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: COLORS[grp], fontSize: 14 }}>{s.pts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <div style={{ background: "#fef9c3", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
              <b>📌 Keterangan Kolom:</b> M=Main · M(hijau)=Menang · S=Seri · K=Kalah · GM=Gol Masuk · GK=Gol Kemasukan · SG=Selisih Gol · 🟡=Kartu Kuning · 🔴=Kartu Merah<br/>
              <b>Prioritas Ranking:</b> Poin → Selisih Gol → Head-to-Head → Akumulasi Kartu
            </div>
          </div>
        )}

        {tab === "advance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 6px #0001" }}>
              <div style={{ background: "#1e3a5f", color: "#fff", padding: "12px 20px", fontWeight: 700, fontSize: 14 }}>
                🏆 Tim Lolos ke Fase Berikutnya (5 Tim)
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Juara Grup */}
                {[["A", statsA[0], COLORS.A],["B", statsB[0], COLORS.B]].map(([grp, s, c]) => (
                  <div key={grp} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 10, background: BG[grp], border: `2px solid ${c}22` }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>🥇</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{s.team}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Juara Grup {grp} · {s.pts} poin · SG {s.gd>0?"+":""}{s.gd}</div>
                    </div>
                    <div style={{ marginLeft: "auto", background: c, color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>LOLOS ✓</div>
                  </div>
                ))}
                {/* Group C top 2 */}
                {statsC.slice(0,2).map((s, i) => (
                  <div key={s.team} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 10, background: BG.C, border: `2px solid ${COLORS.C}22` }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.C, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{i===0?"🥇":"🥈"}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{s.team}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>#{i+1} Grup C · {s.pts} poin · SG {s.gd>0?"+":""}{s.gd}</div>
                    </div>
                    <div style={{ marginLeft: "auto", background: COLORS.C, color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>LOLOS ✓</div>
                  </div>
                ))}
                {/* Best runner up */}
                <div style={{ borderTop: "2px dashed #e2e8f0", paddingTop: 10 }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>🔍 Runner Up Terbaik (dari Grup A & B)</div>
                  {runners.map((s, i) => {
                    const grp = teams.A.includes(s.team) ? "A" : "B";
                    const isBest = i === 0;
                    return (
                      <div key={s.team} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 10, background: isBest ? "#f0fdf4" : "#fff", border: `2px solid ${isBest?"#10b981":"#e2e8f0"}`, marginBottom: 6 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: isBest?"#10b981":"#94a3b8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>🥈</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{s.team}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>Runner Up Grup {grp} · {s.pts} poin · SG {s.gd>0?"+":""}{s.gd} · Kartu: {s.cards}</div>
                        </div>
                        {isBest && <div style={{ marginLeft: "auto", background: "#10b981", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>LOLOS ✓</div>}
                        {!isBest && runners[0].pts===s.pts && runners[0].gd===s.gd && runners[0].cards===s.cards && (
                          <div style={{ marginLeft: "auto", background: "#f59e0b", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>ADU PENALTI</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Semifinal bracket */}
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 6px #0001" }}>
              <div style={{ background: "#7c3aed", color: "#fff", padding: "12px 20px", fontWeight: 700, fontSize: 14 }}>
                🎯 Bagan Semifinal (5 Tim)
              </div>
              <div style={{ padding: 16, fontSize: 12, color: "#64748b" }}>
                <div style={{ marginBottom: 8, fontWeight: 600, color: "#1e293b" }}>Susunan 5 Tim yang Lolos:</div>
                {semifinalists.map((s, i) => (
                  <div key={s?.team || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: i%2===0?"#f8fafc":"#fff", marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, color: "#7c3aed", width: 20 }}>{i+1}.</span>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{s?.team || "-"}</span>
                    <span style={{ color: "#94a3b8" }}>· {s?.pts ?? 0} poin</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: "10px 12px", background: "#faf5ff", borderRadius: 8, border: "1px solid #e9d5ff", color: "#6b21a8", fontSize: 11, lineHeight: 1.7 }}>
                  💡 <b>Catatan:</b> Pengaturan bracket semifinal disesuaikan oleh panitia. Jika runner up terbaik masih seri setelah poin, selisih gol, dan kartu → <b>adu penalti 3 penendang</b>.
                </div>
              </div>
            </div>
            {/* Rules summary */}
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 6px #0001" }}>
              <div style={{ background: "#334155", color: "#fff", padding: "12px 20px", fontWeight: 700, fontSize: 14 }}>📜 Ringkasan Peraturan</div>
              <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                {[
                  ["🏅 Sistem Poin","Menang: 3 · Seri: 1 · Kalah: 0"],
                  ["📋 WO","Menang WO: 3 poin (skor 3-0) · Kalah WO: 0 poin (skor 0-3)"],
                  ["📊 Ranking","Poin → Selisih Gol → H2H → Kartu"],
                  ["🏆 Lolos","Juara A,B + Top 2 Grup C + 1 Runner Up Terbaik"],
                  ["🥈 Runner Up Terbaik","Poin → Selisih Gol → Kartu → Adu Penalti 3 penendang"],
                  ["⚽ Total Lolos","5 tim masuk fase berikutnya"],
                ].map(([k,v]) => (
                  <div key={k} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{k}</div>
                    <div style={{ color: "#64748b" }}>{v}</div>
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
