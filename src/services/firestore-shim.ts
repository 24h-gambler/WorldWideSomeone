/** firebase/firestore 와 functions 의 필요한 심볼만 재-export (트리 셰이킹 · 모킹 편의) */
export { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
export { httpsCallable } from 'firebase/functions';
