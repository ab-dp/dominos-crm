/* מונה בקשות הצטרפות ממתינות – לפעמון ולבאנר במסך "היום" של המנהל */
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export function usePendingRequests() {
  const { isAdmin } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) { setCount(0); return; }
    return onSnapshot(query(collection(db, 'users'), where('status', '==', 'pending')), (s) => setCount(s.size), () => setCount(0));
  }, [isAdmin]);
  return count;
}
