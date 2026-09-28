import { useState } from 'react';
import { MY_PROJECTS, STAGE_ORDER, STAGE_COLORS } from '../data/myProjects';
import { Folder } from 'lucide-react';

export default function MyProjects() {
  const [stage, setStage] = useState('all');

  const counts = STAGE_ORDER.reduce((acc, s) => {
    acc[s] = MY_PROJECTS.filter(p => p.stage === s).length;
    return acc;
  }, {});
  const list = stage === 'all' ? MY_PROJECTS : MY_PROJECTS.filter(p => p.stage === stage);

  return (
    <div className="myprojects-page">
      <div className="section-header">
        <h2>Мои проекты</h2>
        <span className="mp-total">{MY_PROJECTS.length}</span>
      </div>

      <div className="mp-filters">
        <button className={`pill ${stage === 'all' ? 'active' : ''}`} onClick={() => setStage('all')}>
          Все ({MY_PROJECTS.length})
        </button>
        {STAGE_ORDER.filter(s => counts[s] > 0).map(s => (
          <button key={s} className={`pill ${stage === s ? 'active' : ''}`} onClick={() => setStage(s)}>
            <span className="mp-dot" style={{ background: STAGE_COLORS[s] }} /> {s} ({counts[s]})
          </button>
        ))}
      </div>

      <div className="mp-list">
        {list.map((p, i) => (
          <div key={i} className="mp-card">
            <div className="mp-card-top">
              <h3 className="mp-name">{p.name}</h3>
              <span className="mp-stage" style={{ background: STAGE_COLORS[p.stage] + '22', color: STAGE_COLORS[p.stage] }}>
                {p.stage}
              </span>
            </div>
            <div className="mp-where"><Folder size={12} /> {p.where}</div>
            <p className="mp-purpose">{p.purpose}</p>
            <div className="mp-meta">
              <span className="mp-stack">{p.stack}</span>
              <span className="mp-date">{p.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
