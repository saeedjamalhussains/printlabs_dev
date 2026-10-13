import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pencil, MapPin } from 'lucide-react';
import AccountLayout from '../../components/AccountLayout/AccountLayout';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const fromUser = (user) => ({ name: user.name || '', email: user.email || '', phone: user.phone || '', street: user.address?.street || '', city: user.address?.city || '', state: user.address?.state || '', pincode: user.address?.pincode || '' });
const profileFields = [['name', 'Full name', 'name'], ['phone', 'Phone number', 'tel']];
const addressFields = [['street', 'Street address', 'street-address'], ['city', 'City', 'address-level2'], ['state', 'State / region', 'address-level1'], ['pincode', 'Pincode / ZIP', 'postal-code']];

export default function Account({ addressOnly = false }) {
  const { updateSession } = useAuth();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    api.get('/auth/me').then(({ data }) => { if (alive) { setSaved(fromUser(data.data.user)); setDraft(fromUser(data.data.user)); } }).catch(() => { if (alive) setError('We couldn’t load your details. Please try again.'); });
    return () => { alive = false; };
  }, [retry]);
  const save = async event => {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = addressOnly ? { address: { street: draft.street.trim(), city: draft.city.trim(), state: draft.state.trim(), pincode: draft.pincode.trim() } } : { name: draft.name.trim(), phone: draft.phone.trim() };
      if (!addressOnly && !payload.name) throw new Error('Please enter your name.');
      const { data } = await api.put('/auth/me', payload);
      updateSession(data.data);
      const next = { ...saved, ...(addressOnly ? payload.address : payload) };
      setSaved(next); setDraft(next); setEditing(false); setNotice(addressOnly ? 'Your delivery address has been saved.' : 'Your personal details have been saved.');
    } catch (err) { setError(err.response?.data?.message || err.message || 'Your changes weren’t saved. Please try again.'); }
    finally { setSaving(false); }
  };
  const fields = addressOnly ? addressFields : profileFields;
  return <AccountLayout title={addressOnly ? 'Delivery address' : 'Personal details'} subtitle={addressOnly ? 'A home for your next favourite print.' : 'The little details that make this space yours.'}>
    {error && <div role="alert" className="account-feedback">{error}{!saved && <button className="account-text-button" onClick={() => { setError(''); setRetry(n => n + 1); }}>Try again</button>}</div>}
    {notice && <p role="status" className="account-feedback">{notice}</p>}
    {!saved ? (!error && <p role="status" className="account-loading">Loading your details…</p>) : <>
      <section className="account-panel" aria-labelledby="details-heading">
        <div className="account-panel-heading"><div><p className="account-eyebrow">{addressOnly ? '01 / Where it goes' : '01 / About you'}</p><h2 id="details-heading">{addressOnly ? 'Saved address' : 'Contact information'}</h2></div>{!editing && <button className="account-text-button" onClick={() => { setDraft({ ...saved }); setEditing(true); setNotice(''); setError(''); }}><Pencil size={14} />Edit{addressOnly ? ' address' : ' details'}</button>}</div>
        {editing ? <form onSubmit={save} className="account-form"><div className="account-field-grid">{fields.map(([name, label, autoComplete], index) => <div className={`account-field${name === 'street' ? ' account-field-wide' : ''}`} key={name}><label htmlFor={`account-${name}`}>{label}</label><input id={`account-${name}`} name={name} autoComplete={autoComplete} type={name === 'phone' ? 'tel' : 'text'} value={draft[name]} required={name === 'name'} autoFocus={index === 0} disabled={saving} onChange={event => setDraft({ ...draft, [name]: event.target.value })} /></div>)}</div><div className="account-actions"><button type="button" className="account-button account-button-quiet" disabled={saving} onClick={() => { setDraft({ ...saved }); setEditing(false); setError(''); }}>Cancel</button><button className="account-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}<ArrowRight size={16} /></button></div></form> : <dl className="account-detail-grid">{(addressOnly ? addressFields : [...profileFields.slice(0, 1), ['email', 'Email address'], ...profileFields.slice(1)]).map(([key, label]) => <div key={key} className={key === 'street' ? 'account-field-wide' : ''}><dt>{label}</dt><dd>{saved[key] || <span className="account-unset">Not added yet</span>}</dd></div>)}</dl>}
        {!addressOnly && <p className="account-panel-note">Your email is used to sign in to your account.</p>}
      </section>
      {!addressOnly && <Link className="account-feature-link" to="/account/address"><MapPin size={22} /><div><h2>Your delivery address</h2><p>{saved.street ? [saved.street, saved.city].filter(Boolean).join(', ') : 'Add an address for your next order.'}</p></div><ArrowRight size={20} /></Link>}
      {addressOnly && <p className="account-caption">This updates your saved address. It won’t change the delivery details on an existing order.</p>}
    </>}
  </AccountLayout>;
}
