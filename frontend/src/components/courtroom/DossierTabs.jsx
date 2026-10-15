export default function DossierTabs({ value, onChange }) {
  const tabs = [{ id: 'case', label: 'Vụ án' }, { id: 'history', label: 'Biên bản' }];
  function move(event, index) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
    onChange(tabs[next].id);
    document.getElementById('dossier-tab-' + tabs[next].id)?.focus();
  }
  return <div className="dossier-tabs" role="tablist" aria-label="Hồ sơ phiên tòa">{tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={'dossier-tab-' + tab.id} aria-controls="dossier-content" aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1} onKeyDown={(event) => move(event, index)} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</div>;
}
