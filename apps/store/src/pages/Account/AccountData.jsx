import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, ArrowRight } from 'lucide-react';
import { ConfirmDialog } from '@printlabs/ui';
import AccountLayout from '../../components/AccountLayout/AccountLayout';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { collectAccountData } from '../../services/accountData';

export default function AccountData() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const download = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await collectAccountData(api);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = `theprintlabs-account-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Your download is ready. Keep this file private: it contains your contact details.');
    } catch { setError('We couldn’t prepare your download. No partial file was downloaded. Please try again.'); }
    finally { setBusy(false); }
  };
  const close = async () => {
    setDeleting(true); setDeleteError('');
    try { await api.delete('/auth/me'); logout(); navigate('/', { replace: true }); }
    catch (err) { setDeleteError(err.response?.data?.message || 'Your account could not be closed. Please try again.'); setDeleting(false); }
  };
  return <AccountLayout title="Your data" subtitle="A copy for you. Clear choices for your account.">
    {error && <p className="account-feedback" role="alert">{error}</p>}{notice && <p className="account-feedback" role="status">{notice}</p>}
    <section className="account-panel"><div className="account-panel-heading"><div><p className="account-eyebrow">01 / Take a copy</p><h2>Download your account data</h2></div><Download size={22} aria-hidden="true" /></div><p>Get a file with your saved contact details, delivery address and order summaries.</p><ul className="account-data-list"><li>Personal details<span>Name, email and phone</span></li><li>Saved address<span>Your current delivery address</span></li><li>Order summaries<span>Items, totals and order status</span></li></ul><button className="account-button" onClick={download} disabled={busy || deleting}>{busy ? 'Preparing your file…' : 'Download data'}<Download size={16} /></button><p className="account-panel-note">Downloads as a JSON file. This includes the information available in your account, not all records the store may hold. A full data-request process is still under scrutiny.</p></section>
    <section className="account-panel"><div className="account-panel-heading"><div><p className="account-eyebrow">02 / Account controls</p><h2>Close your account</h2></div></div><p>Closing your account disables sign-in and clears your saved profile details. Order records and some security records remain. This action cannot be undone from your account.</p><button className="account-text-button" disabled={busy || deleting} onClick={() => { setDeleteError(''); setConfirm(true); }}>Close my account <ArrowRight size={15} /></button></section>
    <p className="account-caption">Looking for our privacy policy? <Link to="/privacy"><u>View its status</u></Link>.</p>
    <ConfirmDialog open={confirm} onOpenChange={value => { if (!deleting) setConfirm(value); }} title="Close your account?" description="You will be signed out and your saved profile details cleared. Existing orders and some security records remain. Download your account data first if you want a copy." confirmLabel="Close my account" loading={deleting} onConfirm={close}>{deleteError && <p role="alert">{deleteError}</p>}</ConfirmDialog>
  </AccountLayout>;
}
