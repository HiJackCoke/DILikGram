"""
Builds hand-crafted UI preview fixture data for each sample scenario.
Each scenario has 2 pages, each page is a self-contained React component string.

Run: python3 scripts/build-ui-previews.py
"""

import json
import os
from datetime import datetime

# ---------------------------------------------------------------------------
# FITNESS — Meal Logging + Progress Analytics
# ---------------------------------------------------------------------------

FITNESS_PAGE1 = r"""
function App() {
  const [meals, setMeals] = React.useState([
    { id: 1, emoji: '🥣', name: 'Oatmeal with berries', cal: 320, p: 12, c: 52, f: 8, time: '8:00 AM' },
    { id: 2, emoji: '🥗', name: 'Grilled chicken salad', cal: 450, p: 42, c: 18, f: 16, time: '12:30 PM' },
    { id: 3, emoji: '🍦', name: 'Greek yogurt', cal: 150, p: 15, c: 12, f: 4, time: '3:00 PM' },
  ]);
  const [showAdd, setShowAdd] = React.useState(false);
  const [newMeal, setNewMeal] = React.useState('');

  const totals = meals.reduce((acc, m) => ({ cal: acc.cal + m.cal, p: acc.p + m.p, c: acc.c + m.c, f: acc.f + m.f }), { cal: 0, p: 0, c: 0, f: 0 });
  const goals = { cal: 2000, p: 150, c: 200, f: 65 };

  const handleAdd = () => {
    if (!newMeal.trim()) return;
    setMeals([...meals, { id: Date.now(), emoji: '🍽️', name: newMeal, cal: 200, p: 10, c: 25, f: 8, time: 'Now' }]);
    setNewMeal('');
    setShowAdd(false);
  };

  const macros = [
    { label: 'Protein', value: totals.p, goal: goals.p, color: '#3b82f6' },
    { label: 'Carbs', value: totals.c, goal: goals.c, color: '#f97316' },
    { label: 'Fat', value: totals.f, goal: goals.f, color: '#eab308' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', maxWidth: 390, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Monday, March 24</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Meal Log</div>
      </div>

      {/* Calorie Summary Card */}
      <div style={{ margin: '16px 16px 0', background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{totals.cal}</span>
            <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 4 }}>/ {goals.cal} kcal</span>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', background: '#f1f5f9', borderRadius: 20, padding: '4px 12px' }}>
            {goals.cal - totals.cal} left
          </div>
        </div>
        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${Math.min((totals.cal / goals.cal) * 100, 100)}%`, background: 'linear-gradient(90deg, #3b82f6, #6366f1)', borderRadius: 99, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {macros.map(m => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.value}g</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{m.label}</div>
              <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99 }}>
                <div style={{ height: '100%', width: `${Math.min((m.value / m.goal) * 100, 100)}%`, background: m.color, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meal List */}
      <div style={{ padding: '16px 16px 100px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 10, paddingLeft: 4 }}>TODAY'S MEALS</div>
        {meals.map(meal => (
          <div key={meal.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 44, height: 44, background: '#f0f9ff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{meal.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meal.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{meal.time} · P {meal.p}g · C {meal.c}g · F {meal.f}g</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', flexShrink: 0 }}>{meal.cal}</div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: 24, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Add Meal</div>
            <input value={newMeal} onChange={e => setNewMeal(e.target.value)} placeholder="What did you eat?" autoFocus
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={handleAdd} style={{ width: '100%', marginTop: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              Log Meal
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setShowAdd(true)} style={{ position: 'fixed', bottom: 28, right: 28, width: 56, height: 56, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: 28, cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
    </div>
  );
}
""".strip()

FITNESS_PAGE2 = r"""
function App() {
  const [period, setPeriod] = React.useState('week');
  const [activeGoal, setActiveGoal] = React.useState(null);

  const weekData = [
    { day: 'Mon', cal: 1820, goal: 2000 },
    { day: 'Tue', cal: 2100, goal: 2000 },
    { day: 'Wed', cal: 1650, goal: 2000 },
    { day: 'Thu', cal: 1920, goal: 2000 },
    { day: 'Fri', cal: 2200, goal: 2000 },
    { day: 'Sat', cal: 1500, goal: 2000 },
    { day: 'Sun', cal: 920, goal: 2000 },
  ];
  const maxCal = Math.max(...weekData.map(d => d.cal));

  const goals = [
    { id: 1, label: 'Lose 5kg', progress: 62, color: '#3b82f6', detail: '3.1 kg lost' },
    { id: 2, label: 'Daily Protein', progress: 80, color: '#10b981', detail: '120g / 150g' },
    { id: 3, label: 'Calorie Deficit', progress: 45, color: '#f97316', detail: '5 of 7 days' },
  ];

  const stats = [
    { label: 'Avg Calories', value: '1,730', sub: 'kcal/day', emoji: '🔥' },
    { label: 'Best Day', value: 'Tuesday', sub: '2,100 kcal', emoji: '⭐' },
    { label: 'Logged Days', value: '6/7', sub: 'this week', emoji: '📅' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ background: '#fff', padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Progress</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {['week', 'month', '3m'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: '6px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: period === p ? '#3b82f6' : '#f1f5f9', color: period === p ? '#fff' : '#64748b' }}>
              {p === 'week' ? 'Week' : p === 'month' ? 'Month' : '3 Months'}
            </button>
          ))}
        </div>
      </div>

      {/* Bar Chart */}
      <div style={{ margin: '16px 16px 0', background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Calorie Intake</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
          {weekData.map(d => (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', background: d.cal >= d.goal ? '#fef3c7' : '#eff6ff', borderRadius: 6, display: 'flex', alignItems: 'flex-end', height: 80 }}>
                <div style={{ width: '100%', background: d.cal >= d.goal ? '#f59e0b' : '#3b82f6', borderRadius: 6, height: `${(d.cal / maxCal) * 80}px`, transition: 'height 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.day}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 12, color: '#64748b' }}>
          <span>🔵 Under goal</span>
          <span>🟡 Over goal</span>
          <span style={{ marginLeft: 'auto' }}>Goal: 2,000 kcal</span>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '12px 16px 0' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '14px 10px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 22 }}>{s.emoji}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.label}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Goals */}
      <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Goals</div>
          <button style={{ fontSize: 13, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add Goal</button>
        </div>
        {goals.map(g => (
          <div key={g.id} onClick={() => setActiveGoal(activeGoal === g.id ? null : g.id)} style={{ marginBottom: 16, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{g.label}</span>
              <span style={{ fontSize: 13, color: '#64748b' }}>{g.progress}% · {g.detail}</span>
            </div>
            <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${g.progress}%`, background: g.color, borderRadius: 99, transition: 'width 0.3s' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
""".strip()

# ---------------------------------------------------------------------------
# BASKETBALL — Court Discovery + Game Management
# ---------------------------------------------------------------------------

BASKETBALL_PAGE1 = r"""
function App() {
  const [filter, setFilter] = React.useState({ surface: 'all', lighting: 'all', crowd: 'all' });
  const [selected, setSelected] = React.useState(null);
  const [favorites, setFavorites] = React.useState([1]);

  const courts = [
    { id: 1, name: 'Riverside Park Court', distance: '0.3 km', surface: 'asphalt', lighting: true, crowd: 'low', rating: 4.2, reviews: 38, lat: 37.56, lng: 126.97 },
    { id: 2, name: 'Olympic Park Indoor', distance: '1.2 km', surface: 'hardwood', lighting: true, crowd: 'medium', rating: 4.7, reviews: 124, lat: 37.51, lng: 127.12 },
    { id: 3, name: 'Hangang Court B', distance: '2.1 km', surface: 'asphalt', lighting: false, crowd: 'high', rating: 3.8, reviews: 57, lat: 37.52, lng: 126.93 },
    { id: 4, name: 'Mapo Sports Complex', distance: '3.5 km', surface: 'hardwood', lighting: true, crowd: 'low', rating: 4.5, reviews: 89, lat: 37.55, lng: 126.90 },
  ];

  const filtered = courts.filter(c =>
    (filter.surface === 'all' || c.surface === filter.surface) &&
    (filter.lighting === 'all' || (filter.lighting === 'yes') === c.lighting) &&
    (filter.crowd === 'all' || c.crowd === filter.crowd)
  );

  const crowdColor = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
  const crowdLabel = { low: 'Quiet', medium: 'Busy', high: 'Crowded' };
  const toggleFav = (id) => setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', maxWidth: 390, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '16px 20px 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Courts Near You</div>
          <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>📍 Seoul</div>
        </div>
        {/* Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 12, padding: '10px 14px', marginBottom: 14, gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input placeholder="Search courts..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: '#374151', flex: 1 }} />
        </div>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
          {[
            { key: 'surface', label: 'Surface', options: ['all', 'asphalt', 'hardwood'] },
            { key: 'lighting', label: '💡 Lights', options: ['all', 'yes', 'no'] },
            { key: 'crowd', label: 'Crowd', options: ['all', 'low', 'medium', 'high'] },
          ].map(f => (
            <select key={f.key} value={filter[f.key]} onChange={e => setFilter(prev => ({ ...prev, [f.key]: e.target.value }))}
              style={{ flexShrink: 0, border: '1.5px solid #e2e8f0', borderRadius: 99, padding: '6px 12px', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}>
              {f.options.map(o => <option key={o} value={o}>{o === 'all' ? f.label + ' (all)' : o}</option>)}
            </select>
          ))}
        </div>
      </div>

      {/* Map placeholder */}
      <div style={{ height: 140, background: 'linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>🗺️ Map View</div>
        {courts.map((c, i) => (
          <div key={c.id} onClick={() => setSelected(selected === c.id ? null : c.id)}
            style={{ position: 'absolute', top: 20 + (i % 2) * 50, left: 60 + i * 65, width: 32, height: 32, background: selected === c.id ? '#3b82f6' : '#fff', border: '2px solid #3b82f6', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
            <div style={{ transform: 'rotate(45deg)', textAlign: 'center', fontSize: 14, lineHeight: '28px' }}>🏀</div>
          </div>
        ))}
      </div>

      {/* Court List */}
      <div style={{ padding: '12px 16px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>{filtered.length} COURTS FOUND</div>
        {filtered.map(court => (
          <div key={court.id} onClick={() => setSelected(selected === court.id ? null : court.id)}
            style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, boxShadow: selected === court.id ? '0 0 0 2px #3b82f6' : '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{court.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{court.distance} away · {court.surface}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); toggleFav(court.id); }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '0 0 0 8px' }}>
                {favorites.includes(court.id) ? '❤️' : '🤍'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <div style={{ fontSize: 12, background: '#f0fdf4', color: crowdColor[court.crowd], padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
                ● {crowdLabel[court.crowd]}
              </div>
              {court.lighting && <div style={{ fontSize: 12, color: '#f59e0b', background: '#fffbeb', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>💡 Lit</div>}
              <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>⭐ {court.rating}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>({court.reviews})</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
""".strip()

BASKETBALL_PAGE2 = r"""
function App() {
  const [tab, setTab] = React.useState('open');
  const [showCreate, setShowCreate] = React.useState(false);
  const [joined, setJoined] = React.useState([]);

  const games = [
    { id: 1, court: 'Riverside Park Court', host: 'Alex K.', time: '6:00 PM', date: 'Today', slots: 3, total: 10, level: 'Casual', hostAvatar: '🧑' },
    { id: 2, court: 'Olympic Park Indoor', host: 'Jason M.', time: '7:30 PM', date: 'Today', slots: 1, total: 8, level: 'Competitive', hostAvatar: '👨' },
    { id: 3, court: 'Mapo Sports Complex', host: 'Chris L.', time: '10:00 AM', date: 'Tomorrow', slots: 5, total: 10, level: 'Casual', hostAvatar: '🧔' },
    { id: 4, court: 'Hangang Court B', host: 'Sam P.', time: '4:00 PM', date: 'Tomorrow', slots: 2, total: 6, level: '3-on-3', hostAvatar: '👦' },
  ];

  const myGames = games.filter(g => joined.includes(g.id));
  const displayed = tab === 'open' ? games : myGames;

  const handleJoin = (id) => setJoined(prev => prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]);
  const levelColor = { Casual: '#10b981', Competitive: '#ef4444', '3-on-3': '#8b5cf6' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', maxWidth: 390, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '16px 20px 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Games</div>
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 0 }}>
          {[['open', 'Open Games'], ['mine', 'My Games']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#0f172a' : '#64748b', boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
              {label} {key === 'mine' && joined.length > 0 && `(${joined.length})`}
            </button>
          ))}
        </div>
        <div style={{ height: 14 }} />
      </div>

      {/* Game List */}
      <div style={{ padding: '12px 16px 100px' }}>
        {displayed.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏀</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No games yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Join a game or create one!</div>
          </div>
        )}
        {displayed.map(game => (
          <div key={game.id} style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{game.court}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{game.date} at {game.time}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: levelColor[game.level] || '#64748b', background: '#f8fafc', padding: '4px 10px', borderRadius: 99, border: `1px solid ${levelColor[game.level] || '#e2e8f0'}` }}>
                {game.level}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
                <span style={{ fontSize: 18 }}>{game.hostAvatar}</span>
                <span>{game.host}</span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, color: game.slots <= 1 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                  {game.slots} slot{game.slots !== 1 ? 's' : ''} left
                </div>
                <button onClick={() => handleJoin(game.id)} disabled={game.slots === 0 && !joined.includes(game.id)}
                  style={{ padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: joined.includes(game.id) ? '#fef2f2' : '#eff6ff', color: joined.includes(game.id) ? '#ef4444' : '#3b82f6', transition: 'all 0.15s' }}>
                  {joined.includes(game.id) ? 'Leave' : 'Join'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create FAB */}
      <button onClick={() => setShowCreate(true)}
        style={{ position: 'fixed', bottom: 28, right: 28, display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff', border: 'none', borderRadius: 99, padding: '14px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}>
        🏀 Create Game
      </button>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }} onClick={() => setShowCreate(false)}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px 32px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>🏀 Create Game</div>
            {[['Court', 'Riverside Park Court'], ['Date & Time', 'Today, 6:00 PM'], ['Max Players', '10'], ['Level', 'Casual']].map(([label, val]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>{label}</div>
                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#374151' }}>{val}</div>
              </div>
            ))}
            <button onClick={() => setShowCreate(false)} style={{ width: '100%', background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff', border: 'none', borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
              Create Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
""".strip()

# ---------------------------------------------------------------------------
# TRAVEL — Destination Discovery + Trip Planning
# ---------------------------------------------------------------------------

TRAVEL_PAGE1 = r"""
function App() {
  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState({ climate: 'all', budget: 'all' });
  const [wishlist, setWishlist] = React.useState([1]);
  const [selected, setSelected] = React.useState(null);

  const destinations = [
    { id: 1, name: 'Kyoto, Japan', country: 'Japan', emoji: '⛩️', rating: 4.8, reviews: 2341, avgCost: 2500, climate: 'temperate', tags: ['culture', 'temples', 'food'], desc: 'Ancient temples, bamboo groves, and world-class cuisine.' },
    { id: 2, name: 'Barcelona, Spain', country: 'Spain', emoji: '🏛️', rating: 4.7, reviews: 3892, avgCost: 2000, climate: 'mediterranean', tags: ['beach', 'art', 'nightlife'], desc: 'Gaudí architecture, beaches, and vibrant city life.' },
    { id: 3, name: 'Queenstown, NZ', country: 'New Zealand', emoji: '🏔️', rating: 4.9, reviews: 1567, avgCost: 3200, climate: 'temperate', tags: ['adventure', 'nature', 'skiing'], desc: 'Adventure capital with stunning mountain scenery.' },
    { id: 4, name: 'Bali, Indonesia', country: 'Indonesia', emoji: '🌺', rating: 4.6, reviews: 4211, avgCost: 1500, climate: 'tropical', tags: ['beach', 'culture', 'wellness'], desc: 'Spiritual retreats, rice terraces, and ocean sunsets.' },
  ];

  const filtered = destinations.filter(d =>
    (search === '' || d.name.toLowerCase().includes(search.toLowerCase())) &&
    (filters.climate === 'all' || d.climate === filters.climate) &&
    (filters.budget === 'all' || (filters.budget === 'budget' ? d.avgCost < 2000 : filters.budget === 'mid' ? d.avgCost < 3000 : d.avgCost >= 3000))
  );

  const toggleWishlist = (id) => setWishlist(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', maxWidth: 390, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', padding: '20px 20px 24px' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Where to next?</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 16 }}>Discover Destinations</div>
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 14, padding: '11px 16px', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search destinations..." style={{ border: 'none', outline: 'none', fontSize: 14, flex: 1, color: '#374151' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#94a3b8' }}>✕</button>}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <select value={filters.climate} onChange={e => setFilters(p => ({ ...p, climate: e.target.value }))}
          style={{ flexShrink: 0, border: '1.5px solid #e2e8f0', borderRadius: 99, padding: '7px 14px', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none', fontWeight: 600 }}>
          <option value="all">🌍 All Climates</option>
          <option value="temperate">🌤 Temperate</option>
          <option value="mediterranean">☀️ Mediterranean</option>
          <option value="tropical">🌴 Tropical</option>
        </select>
        <select value={filters.budget} onChange={e => setFilters(p => ({ ...p, budget: e.target.value }))}
          style={{ flexShrink: 0, border: '1.5px solid #e2e8f0', borderRadius: 99, padding: '7px 14px', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none', fontWeight: 600 }}>
          <option value="all">💰 Any Budget</option>
          <option value="budget">💚 Under $2k</option>
          <option value="mid">💛 $2k–$3k</option>
          <option value="premium">❤️ $3k+</option>
        </select>
      </div>

      {/* Cards */}
      <div style={{ padding: '0 16px 24px' }}>
        {filtered.map(dest => (
          <div key={dest.id} onClick={() => setSelected(selected === dest.id ? null : dest.id)}
            style={{ background: '#fff', borderRadius: 20, marginBottom: 14, overflow: 'hidden', boxShadow: selected === dest.id ? '0 0 0 2px #6366f1' : '0 1px 4px rgba(0,0,0,0.07)', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
            <div style={{ height: 110, background: `linear-gradient(135deg, ${['#dbeafe','#fce7f3','#dcfce7','#fef9c3'][dest.id-1]}, ${['#ede9fe','#fee2e2','#d1fae5','#ffedd5'][dest.id-1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, position: 'relative' }}>
              {dest.emoji}
              <button onClick={e => { e.stopPropagation(); toggleWishlist(dest.id); }}
                style={{ position: 'absolute', top: 12, right: 12, background: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 16, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                {wishlist.includes(dest.id) ? '❤️' : '🤍'}
              </button>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{dest.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>⭐ {dest.rating} · {dest.reviews.toLocaleString()} reviews</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>${dest.avgCost.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>avg trip cost</div>
                </div>
              </div>
              {selected === dest.id && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{dest.desc}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {dest.tags.map(tag => <span key={tag} style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>{tag}</span>)}
                  </div>
                  <button style={{ width: '100%', marginTop: 12, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    Plan a Trip →
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
            <div style={{ fontSize: 40 }}>🗺️</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 12 }}>No destinations found</div>
          </div>
        )}
      </div>
    </div>
  );
}
""".strip()

TRAVEL_PAGE2 = r"""
function App() {
  const [tab, setTab] = React.useState('itinerary');
  const [days, setDays] = React.useState([
    { day: 1, date: 'Apr 10', activities: ['Arrive Kyoto', 'Check-in hotel', 'Gion district walk'], budget: 200 },
    { day: 2, date: 'Apr 11', activities: ['Fushimi Inari hike', 'Nishiki Market lunch', 'Tea ceremony'], budget: 150 },
    { day: 3, date: 'Apr 12', activities: ['Arashiyama bamboo grove', 'Kinkakuji temple', 'Farewell dinner'], budget: 180 },
  ]);
  const [expenses, setExpenses] = React.useState([
    { id: 1, cat: '🏨', label: 'Hotel (3 nights)', amount: 540 },
    { id: 2, cat: '✈️', label: 'Flight tickets', amount: 680 },
    { id: 3, cat: '🎫', label: 'Activities & Entrance', amount: 125 },
    { id: 4, cat: '🍜', label: 'Food & Dining', amount: 210 },
  ]);
  const [newActivity, setNewActivity] = React.useState('');
  const [editDay, setEditDay] = React.useState(null);

  const totalBudget = 2000;
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = totalBudget - totalSpent;

  const addActivity = (dayIdx) => {
    if (!newActivity.trim()) return;
    setDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, activities: [...d.activities, newActivity] } : d));
    setNewActivity('');
    setEditDay(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', maxWidth: 390, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 24 }}>⛩️</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Kyoto, Japan</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Apr 10 – 12 · 2 travelers</div>
          </div>
          <button style={{ marginLeft: 'auto', background: '#eff6ff', color: '#3b82f6', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Share 📤</button>
        </div>
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4, margin: '14px 0 0' }}>
          {[['itinerary', '📅 Itinerary'], ['hotels', '🏨 Hotels'], ['budget', '💰 Budget']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#0f172a' : '#64748b', boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ height: 14 }} />
      </div>

      <div style={{ padding: '16px 16px 32px' }}>
        {/* Itinerary Tab */}
        {tab === 'itinerary' && days.map((d, idx) => (
          <div key={d.day} style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>D{d.day}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Day {d.day}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{d.date}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>${d.budget} budget</div>
            </div>
            {d.activities.map((a, ai) => (
              <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: ai < d.activities.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ width: 6, height: 6, background: '#0ea5e9', borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: '#374151' }}>{a}</div>
              </div>
            ))}
            {editDay === idx ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={newActivity} onChange={e => setNewActivity(e.target.value)} placeholder="Add activity..." autoFocus
                  style={{ flex: 1, border: '1.5px solid #0ea5e9', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && addActivity(idx)} />
                <button onClick={() => addActivity(idx)} style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>+</button>
              </div>
            ) : (
              <button onClick={() => setEditDay(idx)} style={{ marginTop: 10, background: 'none', border: '1.5px dashed #e2e8f0', borderRadius: 10, padding: '7px 14px', fontSize: 12, color: '#94a3b8', cursor: 'pointer', width: '100%' }}>
                + Add activity
              </button>
            )}
          </div>
        ))}

        {/* Hotels Tab */}
        {tab === 'hotels' && [
          { name: 'Kyoto Grand Hotel', stars: 4, price: 180, avail: true, emoji: '🏯' },
          { name: 'Gion Ryokan', stars: 5, price: 320, avail: true, emoji: '🏠' },
          { name: 'Budget Inn Kyoto', stars: 2, price: 75, avail: false, emoji: '🏨' },
        ].map((h, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', opacity: h.avail ? 1 : 0.5 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, background: '#f1f5f9', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{h.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{h.name}</div>
                <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>{'⭐'.repeat(h.stars)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>${h.price}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>/night</div>
              </div>
            </div>
            <button disabled={!h.avail} style={{ width: '100%', marginTop: 12, background: h.avail ? 'linear-gradient(135deg, #0ea5e9, #6366f1)' : '#e2e8f0', color: h.avail ? '#fff' : '#94a3b8', border: 'none', borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 700, cursor: h.avail ? 'pointer' : 'not-allowed' }}>
              {h.avail ? '✓ Book Now' : 'Unavailable'}
            </button>
          </div>
        ))}

        {/* Budget Tab */}
        {tab === 'budget' && (
          <>
            <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', borderRadius: 20, padding: 20, marginBottom: 14, color: '#fff' }}>
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Total Budget</div>
              <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>${totalBudget.toLocaleString()}</div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 99 }}>
                <div style={{ height: '100%', width: `${(totalSpent / totalBudget) * 100}%`, background: '#fff', borderRadius: 99 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}>
                <span>Spent: ${totalSpent.toLocaleString()}</span>
                <span>Remaining: ${remaining.toLocaleString()}</span>
              </div>
            </div>
            {expenses.map(e => (
              <div key={e.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 24 }}>{e.cat}</div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{e.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>${e.amount}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
""".strip()

# ---------------------------------------------------------------------------
# FOCUS — Home Dashboard + Focus Mode
# ---------------------------------------------------------------------------

FOCUS_PAGE1 = r"""
function App() {
  const [tasks, setTasks] = React.useState([
    { id: 1, title: 'Review quarterly report', priority: 'high', due: 'Today', completed: false, focusTime: 0, tags: ['work'] },
    { id: 2, title: 'Prepare presentation slides', priority: 'high', due: 'Today', completed: false, focusTime: 1800, tags: ['work'] },
    { id: 3, title: 'Read design patterns book', priority: 'medium', due: 'Tomorrow', completed: true, focusTime: 3600, tags: ['learning'] },
    { id: 4, title: 'Write unit tests', priority: 'low', due: 'Mar 30', completed: false, focusTime: 900, tags: ['coding'] },
    { id: 5, title: 'Team standup notes', priority: 'medium', due: 'Today', completed: true, focusTime: 600, tags: ['work'] },
  ]);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');

  const toggle = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));

  const filtered = tasks.filter(t =>
    (search === '' || t.title.toLowerCase().includes(search.toLowerCase())) &&
    (filter === 'all' || (filter === 'active' ? !t.completed : t.completed))
  );

  const stats = {
    completed: tasks.filter(t => t.completed).length,
    total: tasks.length,
    focusMin: Math.round(tasks.reduce((s, t) => s + t.focusTime, 0) / 60),
    streak: 5,
  };

  const priorityColor = { high: '#ef4444', medium: '#f97316', low: '#10b981' };
  const fmt = (s) => s >= 3600 ? `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m` : `${Math.floor(s/60)}m`;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', maxWidth: 390, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '20px 20px 14px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 2 }}>Monday, March 24</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Good morning! 👋</div>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Completed', value: `${stats.completed}/${stats.total}`, emoji: '✅' },
            { label: 'Focus Time', value: `${stats.focusMin}m`, emoji: '⏱️' },
            { label: 'Streak', value: `${stats.streak} days`, emoji: '🔥' },
          ].map(s => (
            <div key={s.label} style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20 }}>{s.emoji}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 12, padding: '10px 14px', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 14, flex: 1, color: '#374151' }} />
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 10px', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
        {[['all', 'All'], ['active', 'Active'], ['done', 'Done']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding: '6px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: filter === key ? '#6366f1' : '#f1f5f9', color: filter === key ? '#fff' : '#64748b', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div style={{ padding: '12px 16px 32px' }}>
        {filtered.map(task => (
          <div key={task.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: 14, opacity: task.completed ? 0.6 : 1 }}>
            <button onClick={() => toggle(task.id)}
              style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${task.completed ? '#6366f1' : '#e2e8f0'}`, background: task.completed ? '#6366f1' : '#fff', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, fontSize: 13, transition: 'all 0.15s' }}>
              {task.completed ? '✓' : ''}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', textDecoration: task.completed ? 'line-through' : 'none', marginBottom: 4 }}>{task.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: priorityColor[task.priority], background: '#fef2f2', padding: '2px 8px', borderRadius: 99 }}>{task.priority}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>📅 {task.due}</span>
                {task.focusTime > 0 && <span style={{ fontSize: 11, color: '#6366f1' }}>⏱ {fmt(task.focusTime)}</span>}
              </div>
            </div>
            <button style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6366f1', flexShrink: 0 }}>▶</button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
            <div style={{ fontSize: 40 }}>🎯</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 12 }}>No tasks found</div>
          </div>
        )}
      </div>
    </div>
  );
}
""".strip()

FOCUS_PAGE2 = r"""
function App() {
  const [running, setRunning] = React.useState(false);
  const [seconds, setSeconds] = React.useState(25 * 60);
  const [session, setSession] = React.useState(1);
  const [distractions, setDistractions] = React.useState(0);
  const [showDistract, setShowDistract] = React.useState(false);
  const task = { title: 'Review quarterly report', tag: 'work' };
  const TOTAL = 25 * 60;

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { setRunning(false); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const progress = (TOTAL - seconds) / TOTAL;
  const r = 88;
  const circ = 2 * Math.PI * r;

  const handleComplete = () => { setRunning(false); setSeconds(25 * 60); setSession(s => s + 1); };
  const handleDistraction = () => { setDistractions(d => d + 1); setShowDistract(false); };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)', fontFamily: 'system-ui, sans-serif', maxWidth: 390, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px' }}>
      {/* Session info */}
      <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600 }}>Session #{session}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ width: 24, height: 8, borderRadius: 99, background: i < session ? '#a78bfa' : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>
      </div>

      {/* Task chip */}
      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 99, padding: '8px 20px', marginBottom: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>🎯</span>
        <span style={{ color: '#e0e7ff', fontSize: 14, fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
      </div>

      {/* Timer Ring */}
      <div style={{ position: 'relative', width: 220, height: 220, marginBottom: 36 }}>
        <svg width={220} height={220} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={110} cy={110} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={12} />
          <circle cx={110} cy={110} r={r} fill="none" stroke="url(#grad)" strokeWidth={12}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>{fmt(seconds)}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{running ? 'focusing...' : seconds === 0 ? 'session done! 🎉' : 'ready'}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
        <button onClick={() => { setSeconds(25 * 60); setRunning(false); }}
          style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>⏹</button>
        <button onClick={() => setRunning(r => !r)}
          style={{ width: 72, height: 72, borderRadius: '50%', background: running ? '#ef4444' : 'linear-gradient(135deg, #818cf8, #c084fc)', border: 'none', color: '#fff', fontSize: 30, cursor: 'pointer', boxShadow: '0 4px 20px rgba(129,140,248,0.4)', transition: 'all 0.2s' }}>
          {running ? '⏸' : '▶'}
        </button>
        <button onClick={handleComplete} disabled={!running}
          style={{ width: 52, height: 52, borderRadius: '50%', background: running ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)', border: 'none', color: running ? '#6ee7b7' : 'rgba(255,255,255,0.2)', fontSize: 22, cursor: running ? 'pointer' : 'not-allowed' }}>✓</button>
      </div>

      {/* Stats */}
      <div style={{ alignSelf: 'stretch', background: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 16 }}>
        {[
          { label: 'Sessions', value: session },
          { label: 'Focus Time', value: `${(session - 1) * 25}m` },
          { label: 'Distractions', value: distractions },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#e0e7ff' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <button onClick={() => setShowDistract(true)}
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 20px', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>
        📵 Log distraction
      </button>

      {/* Distraction modal */}
      {showDistract && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: '#1e1b4b', borderRadius: 20, padding: 28, width: '100%', maxWidth: 340, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📵</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e0e7ff', marginBottom: 8 }}>Distracted?</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>That's okay. Log it and refocus.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDistract(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 12, padding: 13, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={handleDistraction} style={{ flex: 1, background: 'linear-gradient(135deg, #818cf8, #c084fc)', border: 'none', borderRadius: 12, padding: 13, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Refocus 💪</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
""".strip()

# ---------------------------------------------------------------------------
# Build fixtures
# ---------------------------------------------------------------------------

SCENARIOS = {
    "fitness": {
        "pages": [
            {
                "pageId": "page-meal-logging",
                "pageName": "Meal Logging",
                "pagePath": "/meals",
                "code": FITNESS_PAGE1,
            },
            {
                "pageId": "page-progress-analytics",
                "pageName": "Progress Analytics",
                "pagePath": "/progress",
                "code": FITNESS_PAGE2,
            },
        ]
    },
    "basketball": {
        "pages": [
            {
                "pageId": "page-court-discovery",
                "pageName": "Court Discovery",
                "pagePath": "/courts",
                "code": BASKETBALL_PAGE1,
            },
            {
                "pageId": "page-game-management",
                "pageName": "Game Management",
                "pagePath": "/games",
                "code": BASKETBALL_PAGE2,
            },
        ]
    },
    "travel": {
        "pages": [
            {
                "pageId": "page-destination-discovery",
                "pageName": "Destination Discovery",
                "pagePath": "/destinations",
                "code": TRAVEL_PAGE1,
            },
            {
                "pageId": "page-trip-planning",
                "pageName": "Trip Planning",
                "pagePath": "/trips",
                "code": TRAVEL_PAGE2,
            },
        ]
    },
    "focus": {
        "pages": [
            {
                "pageId": "page-home-dashboard",
                "pageName": "Home Dashboard",
                "pagePath": "/",
                "code": FOCUS_PAGE1,
            },
            {
                "pageId": "page-focus-mode",
                "pageName": "Focus Mode",
                "pagePath": "/focus",
                "code": FOCUS_PAGE2,
            },
        ]
    },
}

if __name__ == "__main__":
    out_dir = "src/fixtures/uiPreviews/data"
    os.makedirs(out_dir, exist_ok=True)

    for scenario, data in SCENARIOS.items():
        payload = {
            "capturedAt": datetime.utcnow().isoformat() + "Z",
            "pages": [
                {**p, "status": "done"} for p in data["pages"]
            ]
        }
        path = os.path.join(out_dir, f"{scenario}.json")
        with open(path, "w") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"✅ {scenario}: {len(data['pages'])} pages → {path}")
