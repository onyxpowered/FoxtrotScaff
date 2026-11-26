export const Traps: readonly string[] = ["/archive/full-dump", "/api/export-all", "/sitemap-full.xml", "/data/export"];

const Declared = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai",
  "Google-Extended", "CCBot", "Bytespider", "PerplexityBot", "Perplexity-User", "Amazonbot", "Applebot-Extended",
  "meta-externalagent", "cohere-ai", "MistralAI-User", "DuckAssistBot", "Diffbot", "omgili", "Timpibot",
  "ImagesiftBot", "img2dataset", "PetalBot", "DataForSeoBot", "FacebookBot",
];

export function Text() {
  const Banned = Declared.map((Agent) => `User-agent: ${Agent}\nDisallow: /`).join("\n\n");
  const Rest = ["User-agent: *", "Disallow: /api/", "Disallow: /media/", "Disallow: /_shield/", ...Traps.map((Path) => `Disallow: ${Path}`)].join("\n");
  return `${Banned}\n\n${Rest}\n`;
}
