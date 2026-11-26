const Tone = "[\\u{1F3FB}-\\u{1F3FF}\\uFE0F]?";
const Single = new RegExp(`^(?:\\p{Extended_Pictographic}${Tone}(?:\\u200D\\p{Extended_Pictographic}${Tone})*|\\p{Regional_Indicator}{2})$`, "u");

export function Valid(Text: string) {
  return Text.length <= 32 && Single.test(Text);
}
