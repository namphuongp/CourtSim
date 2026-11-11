import { Link } from 'react-router-dom';
import CourtSimMark from './CourtSimMark';
import './courtSimBrand.css';

export default function CourtSimBrand() {
  return (
    <Link
      to="/"
      aria-label="CourtSim — Trang chủ"
      className="courtsim-brand"
      onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}
    >
      <CourtSimMark />Court<span>Sim</span>
    </Link>
  );
}
