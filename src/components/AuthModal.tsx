import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useHub } from '../context/HubContext';

export function AuthModal() {
  const {
    authModalOpen,
    setAuthModalOpen,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
  } = useHub();

  const [mode, setMode] = useState<'signin' | 'register' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  if (!authModalOpen) return null;

  const handleGoogle = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else if (mode === 'register') {
        await registerWithEmail(email, password, displayName);
      } else {
        await sendPasswordReset(email);
        setInfoMsg('Password recovery email sent if an account exists for this address.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (msg.includes('operation-not-allowed')) {
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in this Firebase project. Use Google Sign-In above, or enable Email/Password under Firebase Console → Authentication → Sign-in method.'
        );
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to ALL INFORMATION HUB"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36] p-7 relative">
        <button
          type="button"
          onClick={() => setAuthModalOpen(false)}
          aria-label="Close sign in dialog"
          className="absolute top-4 right-4 p-1.5 text-[#57534E] hover:text-[#141413] dark:text-[#9CA3AF] dark:hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="text-xs uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF]">
          ALL INFORMATION HUB
        </p>
        <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
          {mode === 'signin'
            ? 'Reader & Editorial Sign In'
            : mode === 'register'
              ? 'Create Reader Account'
              : 'Password Recovery'}
        </h2>
        <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1.5">
          Save bookmarks, build personal reading lists, follow topics, or access role-based editorial controls.
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 w-full py-2.5 px-4 text-sm font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E5E2DC] dark:bg-[#232A36]" />
          <span className="text-xs text-[#78716C]">or email</span>
          <div className="flex-1 h-px bg-[#E5E2DC] dark:bg-[#232A36]" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-[#292524] dark:text-[#D1D5DB] mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Dr. Ananya Sen"
                className="w-full px-3 py-2 text-sm bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#292524] dark:text-[#D1D5DB] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.org"
              className="w-full px-3 py-2 text-sm bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-[#292524] dark:text-[#D1D5DB] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3 py-2 text-sm bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-[#B91C1C] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#450A0A]/40 border border-[#FECACA] dark:border-[#7F1D1D] p-2.5">
              {errorMsg}
            </p>
          )}
          {infoMsg && (
            <p className="text-xs text-[#166534] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#052E16]/40 border border-[#BBF7D0] dark:border-[#14532D] p-2.5">
              {infoMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-medium bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {loading
              ? 'Please wait...'
              : mode === 'signin'
                ? 'Sign In with Email'
                : mode === 'register'
                  ? 'Create Account'
                  : 'Send Recovery Link'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-[#57534E] dark:text-[#9CA3AF]">
          {mode === 'signin' ? (
            <>
              <button type="button" onClick={() => setMode('register')} className="hover:underline cursor-pointer">
                Create an account
              </button>
              <button type="button" onClick={() => setMode('reset')} className="hover:underline cursor-pointer">
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setMode('signin')} className="hover:underline cursor-pointer">
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
