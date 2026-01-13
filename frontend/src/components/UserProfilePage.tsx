import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, User, Lock, Trash2 } from 'lucide-react';
import { getCurrentUser, type User as UserType } from '../utils/api';
import { removeToken } from '../utils/auth';

export function UserProfilePage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setName(userData.name);
      setEmail(userData.email);
    } catch (error) {
      console.error('Failed to load user:', error);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setUpdating(true);

    try {
      // Mock update - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setSuccess('Profile updated successfully');
      if (user) {
        setUser({ ...user, name, email });
      }
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setUpdating(true);

    try {
      // Mock update - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Failed to update password');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    setUpdating(true);

    try {
      // Mock delete - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));
      removeToken();
      navigate('/');
    } catch (err) {
      setError('Failed to delete account');
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Chat
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">User Profile</h1>
          <p className="text-slate-400">Manage your account settings and preferences</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-500/10 border border-green-500/50 rounded-lg p-4 text-green-400">
            {success}
          </div>
        )}

        <div className="grid gap-6">
          {/* Profile Information */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-600 rounded-full">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Profile Information</h2>
                <p className="text-sm text-slate-400">Update your account details</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Profile'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-600 rounded-full">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Change Password</h2>
                <p className="text-sm text-slate-400">Update your password</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Delete Account */}
          <div className="bg-slate-900 rounded-lg p-6 border border-red-500/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-600 rounded-full">
                <Trash2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Delete Account</h2>
                <p className="text-sm text-slate-400">Permanently delete your account and all data</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm">
                ⚠️ Warning: This action cannot be undone. All your data, including chats and visualizations, will be permanently deleted.
              </p>
            </div>

            <button
              onClick={handleDeleteAccount}
              disabled={updating}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {updating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  Delete Account
                </>
              )}
            </button>
          </div>
        </div>

        {/* User Info Card */}
        {user && (
          <div className="mt-6 bg-slate-900/50 rounded-lg p-4 border border-slate-800">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">User ID:</span>
                <p className="text-slate-300 font-mono">{user.user_id}</p>
              </div>
              <div>
                <span className="text-slate-500">Created:</span>
                <p className="text-slate-300">{new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}