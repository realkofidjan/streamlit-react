import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getMediaUrl, isServerConfigured } from '../services/media';

const UserContext = createContext(null);

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const api = useCallback(() => axios.create({ baseURL: getMediaUrl() }), []);

  const fetchUsers = useCallback(async () => {
    if (!isServerConfigured()) return;
    try {
      const res = await api().get('/api/users');
      setUsers(res.data);
    } catch {
      // Server offline
    }
  }, [api]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const restore = async () => {
      if (!isServerConfigured()) { setLoading(false); return; }
      try {
        await fetchUsers();
        const savedId = localStorage.getItem('streamit_userId');
        const savedAt = localStorage.getItem('streamit_loginAt');
        if (savedId && savedAt) {
          const elapsed = Date.now() - Number(savedAt);
          if (elapsed < 24 * 60 * 60 * 1000) {
            const res = await api().get(`/api/users/${savedId}/history`);
            const usersRes = await api().get('/api/users');
            const user = usersRes.data.find((u) => u.id === savedId);
            if (user) {
              setCurrentUser({ ...user, watchHistory: res.data });
            }
          } else {
            localStorage.removeItem('streamit_userId');
            localStorage.removeItem('streamit_loginAt');
          }
        }
      } catch {
        // Server offline or user deleted
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, [fetchUsers, api]);

  const createUser = async (username, pin, avatar) => {
    const res = await api().post('/api/users', { username, pin, avatar });
    await fetchUsers();
    return res.data;
  };

  const login = async (userId, pin) => {
    const res = await api().post('/api/users/login', { userId, pin });
    setCurrentUser(res.data);
    localStorage.setItem('streamit_userId', userId);
    localStorage.setItem('streamit_loginAt', String(Date.now()));
    return res.data;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('streamit_userId');
    localStorage.removeItem('streamit_loginAt');
  };

  const updateWatchHistory = async (mediaType, mediaId, data) => {
    if (!currentUser) return;
    try {
      const res = await api().put(`/api/users/${currentUser.id}/history`, {
        mediaType, mediaId, ...data,
      });
      setCurrentUser((prev) => ({ ...prev, watchHistory: res.data }));
    } catch {
      // Silently fail
    }
  };

  const clearContinueWatching = async () => {
    if (!currentUser) return;
    try {
      const res = await api().delete(`/api/users/${currentUser.id}/history/watching`);
      setCurrentUser((prev) => ({ ...prev, watchHistory: res.data }));
    } catch {
      // Silently fail
    }
  };

  const addToWatchlist = async (type, mediaId, title, posterPath) => {
    if (!currentUser) return;
    try {
      const res = await api().put(`/api/users/${currentUser.id}/watchlist`, {
        type, mediaId, title, posterPath,
      });
      setCurrentUser((prev) => ({ ...prev, watchlist: res.data }));
    } catch {
      // Silently fail
    }
  };

  const removeFromWatchlist = async (type, mediaId) => {
    if (!currentUser) return;
    try {
      const res = await api().delete(`/api/users/${currentUser.id}/watchlist/${type}/${mediaId}`);
      setCurrentUser((prev) => ({ ...prev, watchlist: res.data }));
    } catch {
      // Silently fail
    }
  };

  const refreshHistory = async () => {
    if (!currentUser) return;
    try {
      const res = await api().get(`/api/users/${currentUser.id}/history`);
      setCurrentUser((prev) => ({ ...prev, watchHistory: res.data }));
    } catch {
      // Silently fail
    }
  };

  const deleteUser = async (userId, pin) => {
    await api().delete(`/api/users/${userId}`, { data: { pin } });
    if (currentUser?.id === userId) {
      logout();
    }
    await fetchUsers();
  };

  // Admin can delete any user without their PIN
  const adminDeleteUser = async (targetUserId) => {
    if (!currentUser) return;
    await api().delete(`/api/users/${targetUserId}`, { data: { adminId: currentUser.id } });
    await fetchUsers();
  };

  const updateProfile = async (username, currentPin, newPin, emoji, avatar) => {
    if (!currentUser) return;
    const res = await api().put(`/api/users/${currentUser.id}/profile`, {
      username: username || undefined,
      currentPin: currentPin || undefined,
      newPin: newPin || undefined,
      emoji: emoji !== undefined ? emoji : undefined,
      avatar: avatar || undefined,
    });
    setCurrentUser((prev) => ({ ...prev, ...res.data }));
    await fetchUsers();
    return res.data;
  };

  const sendNotification = async (showName, showId, message) => {
    if (!currentUser || !isServerConfigured()) return;
    try {
      await api().post('/api/notifications', {
        fromUser: currentUser.username,
        showName,
        showId,
        message,
      });
    } catch {
      // Silently fail
    }
  };

  const getNotifications = useCallback(async () => {
    if (!isServerConfigured()) return [];
    try {
      const res = await api().get('/api/notifications');
      return res.data;
    } catch {
      return [];
    }
  }, [api]);

  const dismissNotification = useCallback(async (notifId) => {
    if (!isServerConfigured()) return [];
    try {
      const res = await api().delete(`/api/notifications/${notifId}`);
      return res.data;
    } catch {
      return [];
    }
  }, [api]);

  return (
    <UserContext.Provider value={{
      users, currentUser, loading,
      createUser, login, logout, deleteUser, adminDeleteUser,
      updateWatchHistory, clearContinueWatching, refreshHistory, fetchUsers,
      addToWatchlist, removeFromWatchlist,
      updateProfile, sendNotification, getNotifications, dismissNotification,
    }}>
      {children}
    </UserContext.Provider>
  );
}
