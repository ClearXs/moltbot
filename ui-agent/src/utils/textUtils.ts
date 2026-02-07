/**
 * Text utilities for Chinese/English mixed text segmentation
 * Used for streaming replay typewriter effect
 */

/**
 * Check if a character is Chinese
 * @param char - Single character to check
 * @returns true if the character is Chinese
 */
export function isChinese(char: string): boolean {
  if (!char || char.length === 0) return false;
  const code = char.charCodeAt(0);
  // Chinese character range: U+4E00 to U+9FA5
  return code >= 0x4e00 && code <= 0x9fa5;
}

/**
 * Check if a character is punctuation
 * @param char - Single character to check
 * @returns true if the character is punctuation (Chinese or English)
 */
export function isPunctuation(char: string): boolean {
  if (!char || char.length === 0) return false;
  // English punctuation and Chinese punctuation
  return /[.,;!?。,;!?、:：""''《》【】（）\-—…]/.test(char);
}

/**
 * Split text into "words" for typewriter effect
 * - Chinese characters: each character is treated as one "word"
 * - English/numbers: split by spaces into words
 * - Punctuation: attached to the previous word
 *
 * @param text - Text to split
 * @returns Array of words/characters for display
 *
 * @example
 * splitTextIntoWords("我在分析数据") // ["我", "在", "分", "析", "数", "据"]
 * splitTextIntoWords("使用Python分析") // ["使", "用", "Python", "分", "析"]
 * splitTextIntoWords("分析完成!") // ["分", "析", "完", "成!"]
 */
export function splitTextIntoWords(text: string): string[] {
  if (!text) return [];

  const words: string[] = [];
  let currentWord = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (isChinese(char)) {
      // Chinese character: finish current word, add it as a separate word
      if (currentWord.trim()) {
        words.push(currentWord);
        currentWord = "";
      }
      words.push(char);
    } else if (char === " " || char === "\n" || char === "\t") {
      // Whitespace: finish current word
      if (currentWord.trim()) {
        words.push(currentWord);
        currentWord = "";
      }
      // Preserve the whitespace as a separate word for layout
      if (char === "\n") {
        words.push("\n");
      } else if (char === " " && words.length > 0) {
        // Add space to previous word to maintain spacing
        words[words.length - 1] += char;
      }
    } else if (isPunctuation(char)) {
      // Punctuation: attach to current word
      currentWord += char;
      if (currentWord.trim()) {
        words.push(currentWord);
        currentWord = "";
      }
    } else {
      // English/numbers: accumulate into current word
      currentWord += char;
    }
  }

  // Don't forget the last word
  if (currentWord.trim()) {
    words.push(currentWord);
  }

  return words;
}

/**
 * Sleep utility for async delays in typewriter effect
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get displayed text up to a certain word index
 * Used by StreamingReplayContext to show partial text during animation
 *
 * @param words - Array of words from splitTextIntoWords()
 * @param currentIndex - Current word index (0-based)
 * @returns Concatenated text up to currentIndex
 */
export function getDisplayedText(words: string[], currentIndex: number): string {
  if (!words || words.length === 0) return "";
  if (currentIndex < 0) return "";
  if (currentIndex >= words.length) return words.join("");

  return words.slice(0, currentIndex + 1).join("");
}
