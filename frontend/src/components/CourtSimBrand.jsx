import { Link } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import './courtSimBrand.css';

export default function CourtSimBrand() {
  return <Link to="/" aria-label="CourtSim — Trang chủ" className="courtsim-brand"><Gavel size={26} aria-hidden="true"/>Court<span>Sim</span></Link>;
}
