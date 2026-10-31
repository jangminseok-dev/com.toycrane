// "을"/"를": 마지막 글자에 받침이 있으면 "을" (한글이 아니면 "를")
export function eulReul(word: string): '을' | '를' {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? '을' : '를';
}

// "이"/"가": 마지막 글자에 받침이 있으면 "이"
export function iGa(word: string): '이' | '가' {
  return eulReul(word) === '을' ? '이' : '가';
}
