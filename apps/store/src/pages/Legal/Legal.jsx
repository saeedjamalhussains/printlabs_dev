import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import './Legal.css';

export default function Legal({ type }) {
  const privacy = type === 'privacy';
  return <div className="legal-page container"><Link to="/shop" className="legal-back"><ArrowLeft size={16} />Back to the shop</Link><div className="legal-layout"><aside><p className="legal-eyebrow">ThePrintLabs / Information</p><nav aria-label="Policies"><Link to="/privacy" aria-current={privacy ? 'page' : undefined}>Privacy policy <ArrowUpRight size={14} /></Link><Link to="/terms" aria-current={!privacy ? 'page' : undefined}>Terms & conditions <ArrowUpRight size={14} /></Link></nav></aside><article><p className="legal-eyebrow">{privacy ? '01 / Your privacy' : '02 / Shopping with us'}</p><h1>{privacy ? 'Privacy policy' : 'Terms & conditions'}</h1><div className="legal-status"><span className="legal-dot" aria-hidden="true" />Still under scrutiny</div><p className="legal-description">{privacy ? 'We’re reviewing our privacy policy. The completed policy will be available here once the review is finished.' : 'We’re reviewing our terms and conditions. The completed terms will be available here once the review is finished.'}</p><div className="legal-note"><h2>A little more time, a little more care.</h2><p>This page is a status notice. It does not contain a final policy.</p></div><Link to="/account/data" className="legal-account">Manage your account data <ArrowUpRight size={16} /></Link></article></div></div>;
}
