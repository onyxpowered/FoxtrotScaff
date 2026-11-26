import type { Signals } from "./Fingerprint.ts";

export const Crawlers: readonly string[] = [
  "gptbot", "chatgpt-user", "oai-searchbot", "claudebot", "claude-web", "claude-user", "claude-searchbot",
  "anthropic-ai", "ccbot", "bytespider", "perplexitybot", "perplexity-user", "amazonbot", "applebot-extended",
  "meta-externalagent", "meta-externalfetcher", "cohere-ai", "mistralai-user", "duckassistbot", "diffbot",
  "omgilibot", "omgili", "timpibot", "youbot", "imagesiftbot", "img2dataset", "laion", "petalbot", "dataforseo",
  "scrapy", "python-requests", "python-urllib", "aiohttp", "httpx", "node-fetch", "axios", "go-http-client",
  "curl/", "wget/", "headlesschrome", "phantomjs", "puppeteer", "playwright", "selenium",
];

export const Thresholds = { Block: 100, Challenge: 40 } as const;

export function Score(Seen: Signals) {
  const Reasons: string[] = [];
  let Total = 0;
  const Agent = Seen.Agent.toLowerCase();

  const Known = Crawlers.find((Needle) => Agent.includes(Needle));
  if (Known) {
    Total += 100;
    Reasons.push(`known-crawler:${Known}`);
  }

  if (!Seen.Agent) {
    Total += 40;
    Reasons.push("missing-user-agent");
  } else if (Seen.Agent.length < 10) {
    Total += 10;
    Reasons.push("short-user-agent");
  }

  if (!Seen.Language) {
    Total += 15;
    Reasons.push("missing-accept-language");
  }

  if (!Seen.Encoding) {
    Total += 15;
    Reasons.push("missing-accept-encoding");
  }

  if (!Seen.Language && !Seen.Encoding) {
    Total += 10;
    Reasons.push("missing-both-accept-headers");
  }

  if (Seen.Accept === "*/*" && /mozilla|chrome|safari|firefox/.test(Agent)) {
    Total += 20;
    Reasons.push("browser-agent-with-wildcard-accept");
  }

  return { Total, Reasons };
}
