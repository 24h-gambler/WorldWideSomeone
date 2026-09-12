import type { Gender } from '@/types';

export const AVATARS = ['🦊', '🐼', '🐸', '🦄', '🐙', '🦋', '🐨', '🐯', '🦉', '🐳', '🌻', '🍑', '🎧', '🛹', '🌙', '⚡', '🍓', '🐧', '🦁', '🌈'];
export const FIELDS = ['IT/개발', '디자인', '음악', '영상/사진', '의료', '교육', '비즈니스', '과학', '스포츠', '요리', '패션', '글쓰기', '게임', '여행', '학생'];
export const JOBS = ['개발자', '디자이너', '학생', '마케터', '기획자', '의사/간호사', '교사', '뮤지션', '작가', '요리사', '운동선수', '창업가', '연구원', '프리랜서', '기타'];
export const HOBBIES = ['러닝', '사진', '커피', '독서', '캠핑', '요가', '게임', '영화', '피아노', '그림', '서핑', '등산', '베이킹', '고양이', '강아지', '여행', '댄스', 'K-POP', '축구', '농구', '위스키', '식물'];
export const GENDERS: { id: Gender; label: string }[] = [
  { id: 'female', label: '여성' },
  { id: 'male', label: '남성' },
  { id: 'other', label: '기타' },
  { id: 'private', label: '비공개' },
];
export const genderLabel = (g: Gender) => GENDERS.find((x) => x.id === g)?.label ?? '비공개';
