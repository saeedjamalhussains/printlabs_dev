import { useState } from 'react';
import AccountLayout from '../../components/AccountLayout/AccountLayout';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

export default function AccountSecurity() {
  const { updateSession } = useAuth();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submit = async event => {
    event.preventDefault(); setError(''); setNotice('');
    if (values.newPassword !== values.confirm) { setError('Your new passwords don’t match.'); return; }
    setBusy(true);
    try {
      const { data } = await api.put('/auth/me/password', { currentPassword: values.currentPassword, newPassword: values.newPassword });
      updateSession(data.data); setValues({ currentPassword: '', newPassword: '', confirm: '' }); setVisible(false); setNotice('Password updated. Your other sessions have been signed out.');
    } catch (err) { setError(err.response?.data?.message || 'Your password wasn’t updated. Please try again.'); }
    finally { setBusy(false); }
  };
  return <AccountLayout title="Password & security" subtitle="Keep your account comfortably yours.">{error && <p className="account-feedback" role="alert">{error}</p>}{notice && <p className="account-feedback" role="status">{notice}</p>}<section className="account-panel"><div className="account-panel-heading"><div><p className="account-eyebrow">01 / Sign-in</p><h2>Change your password</h2></div></div><form className="account-security-form" onSubmit={submit}>{[['currentPassword', 'Current password'], ['newPassword', 'New password'], ['confirm', 'Confirm new password']].map(([name, label]) => <div className="account-field" key={name}><label htmlFor={name}>{label}</label><input id={name} name={name} type={visible ? 'text' : 'password'} autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} minLength={name === 'currentPassword' ? undefined : 8} aria-describedby={name === 'currentPassword' ? undefined : 'password-hint'} required disabled={busy} value={values[name]} onChange={event => setValues({ ...values, [name]: event.target.value })} /></div>)}<p id="password-hint" className="account-caption">Use at least 8 characters. Other signed-in sessions will end when you save.</p><label className="account-caption"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} /> Show passwords</label><div className="account-actions"><button className="account-button" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></div></form></section></AccountLayout>;
}
