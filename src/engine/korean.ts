/**
 * 한국어 조사 — 받침 유무로 이/가, 은/는, 을/를, 와/과를 고른다.
 * "매이(가) 머리 위를…" 처럼 괄호로 얼버무리지 않기 위해.
 */
const hasJong = (word: string): boolean => {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;      // 한글 음절
  if (/[0-9]$/.test(ch)) return ['0', '1', '3', '6', '7', '8'].includes(ch);    // 숫자 읽기 기준
  return /[a-zA-Z]$/.test(ch) ? !'aeiouAEIOU'.includes(ch) : false;            // 로마자는 대략치
};
export const josa = (word: string, pair: '이/가' | '은/는' | '을/를' | '와/과' | '으로/로'): string => {
  const [withJong, without] = pair.split('/');
  if (pair === '으로/로') { const ch = word.trim().slice(-1); const code = ch.charCodeAt(0); const rieul = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8; return rieul ? without : hasJong(word) ? withJong : without; }
  return hasJong(word) ? withJong : without;
};
/** "매가", "드래곤이" 처럼 단어에 조사를 붙여 돌려준다 */
export const withJosa = (word: string, pair: '이/가' | '은/는' | '을/를' | '와/과' | '으로/로'): string => `${word}${josa(word, pair)}`;
