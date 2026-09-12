/** 가입 게이트: 비회원이면 가입 시트를 띄우고, 가입 후 원래 동작을 이어서 실행 */
import { useCallback } from 'react';
import { useStore } from '@/store';
import { openSignup } from '@/components/signup-sheet';

export function useGate() {
  const signedIn = useStore((s) => s.signedIn);
  return useCallback((reason: 'send' | 'like' | 'comment' | 'chat' | 'pay' | 'reply', fn: () => void) => {
    if (signedIn) fn();
    else openSignup(reason, fn);
  }, [signedIn]);
}
