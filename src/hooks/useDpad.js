import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const FOCUSABLE = 'a[href], button:not(:disabled), input, select, [tabindex="0"]';

function getCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function isVisible(el) {
  if (!el.offsetParent && el.tagName !== 'BODY') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getCandidates(current) {
  const all = Array.from(document.querySelectorAll(FOCUSABLE));
  return all.filter((el) => el !== current && isVisible(el));
}

function findBest(current, direction) {
  const candidates = getCandidates(current);
  if (candidates.length === 0) return null;

  const fromRect = current.getBoundingClientRect();
  const from = getCenter(fromRect);

  let best = null;
  let bestDist = Infinity;

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    const to = getCenter(rect);
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    let isInDirection = false;
    let primary, secondary;

    switch (direction) {
      case 'ArrowLeft':
        isInDirection = dx < -10;
        primary = Math.abs(dx);
        secondary = Math.abs(dy);
        break;
      case 'ArrowRight':
        isInDirection = dx > 10;
        primary = Math.abs(dx);
        secondary = Math.abs(dy);
        break;
      case 'ArrowUp':
        isInDirection = dy < -10;
        primary = Math.abs(dy);
        secondary = Math.abs(dx);
        break;
      case 'ArrowDown':
        isInDirection = dy > 10;
        primary = Math.abs(dy);
        secondary = Math.abs(dx);
        break;
    }

    if (!isInDirection) continue;

    // Weight: favor elements more aligned in the primary direction
    // Heavy penalty for being off-axis to prevent jumping across rows
    const dist = primary + secondary * 3;

    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }

  return best;
}

export default function useDpad() {
  const location = useLocation();

  // Auto-focus first focusable element on route change
  useEffect(() => {
    const timer = setTimeout(() => {
      // Don't steal focus from inputs that already have it
      if (document.activeElement?.tagName === 'INPUT') return;
      // Find first focusable in main content area
      const main = document.querySelector('main') || document.body;
      const first = main.querySelector(FOCUSABLE);
      if (first && isVisible(first)) {
        first.focus({ preventScroll: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip when video player is active
      if (document.body.hasAttribute('data-player-active')) return;

      // Skip when typing in an input (allow Enter through for form submission)
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key !== 'Enter') return;
        // Enter on input: let the form handle it
        return;
      }

      const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

      if (arrows.includes(e.key)) {
        e.preventDefault();

        let current = document.activeElement;
        // If nothing focused, pick the first visible focusable
        if (!current || current === document.body) {
          const first = document.querySelector(FOCUSABLE);
          if (first && isVisible(first)) {
            first.focus();
            first.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
          return;
        }

        const next = findBest(current, e.key);
        if (next) {
          next.focus();
          next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
