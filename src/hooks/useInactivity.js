import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes

export function useInactivity() {
    const { currentUser, logout } = useUser();
    const navigate = useNavigate();
    const location = useLocation();
    const timeoutId = useRef(null);

    // We consider the user "active" if they are interacting
    // OR if they are watching a video (on the /play route OR if the external player iframe is present)
    const isPlaying = location.pathname === '/play' || !!document.querySelector('.stream-iframe');

    const handleLogout = useCallback(() => {
        if (currentUser) {
            console.log('User inactive for 10 minutes. Logging out.');
            logout();
            navigate('/profiles');
        }
    }, [currentUser, logout, navigate]);

    const resetTimer = useCallback(() => {
        if (timeoutId.current) clearTimeout(timeoutId.current);
        if (!isPlaying && currentUser) {
            timeoutId.current = setTimeout(handleLogout, INACTIVITY_LIMIT);
        }
    }, [handleLogout, isPlaying, currentUser]);

    useEffect(() => {
        // Events to track activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

        // setup event listeners
        const onActivity = () => resetTimer();

        if (currentUser && !isPlaying) {
            events.forEach(event => document.addEventListener(event, onActivity));
            // Start initial timer
            resetTimer();
        }

        return () => {
            if (timeoutId.current) clearTimeout(timeoutId.current);
            events.forEach(event => document.removeEventListener(event, onActivity));
        };
    }, [currentUser, isPlaying, resetTimer]);

    return;
}
