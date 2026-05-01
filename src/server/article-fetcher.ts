import axios from "axios";
import * as cheerio from "cheerio";

export interface ExtractedArticle {
  title: string;
  content: string;
  ogImage: string | null;
  domain: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Fetch + extract article content from a URL.
 *
 * Strategy:
 * 1. og:title + og:image from `<meta>`
 * 2. <article>, <main>, or `[itemprop="articleBody"]` for body
 * 3. Fallback: top 30 longest <p> tags
 */
export async function fetchArticle(url: string): Promise<ExtractedArticle> {
  const { data, request } = await axios.get<string>(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    timeout: 20000,
    maxRedirects: 5,
    responseType: "text",
  });
  const finalUrl: string = request?.res?.responseUrl ?? url;
  const $ = cheerio.load(data);

  const ogTitle =
    $('meta[property="og:title"]').attr("content") ??
    $('meta[name="twitter:title"]').attr("content") ??
    $("title").first().text();

  const ogImage =
    $('meta[property="og:image"]').attr("content") ??
    $('meta[name="twitter:image"]').attr("content") ??
    null;

  let content = "";
  const candidates = [
    "article",
    'main [itemprop="articleBody"]',
    '[itemprop="articleBody"]',
    "main article",
    "main",
    ".article-content",
    ".article-body",
    ".post-content",
    ".entry-content",
    "#content",
  ];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length) {
      const paragraphs = el
        .find("p")
        .map((_, p) => $(p).text().trim())
        .get()
        .filter((t) => t.length > 30);
      if (paragraphs.length >= 3) {
        content = paragraphs.join("\n\n");
        break;
      }
    }
  }
  if (!content) {
    const ps = $("p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter((t) => t.length > 40)
      .sort((a, b) => b.length - a.length)
      .slice(0, 30);
    content = ps.join("\n\n");
  }

  if (content.length < 200) {
    throw new Error(
      `Không trích xuất được nội dung từ URL (chỉ ${content.length} ký tự). Thử lưu bài thành .txt và dán vào ô "Từ file văn bản".`,
    );
  }

  const domain = safeDomain(finalUrl);
  return {
    title: clean(ogTitle ?? "(Không có tiêu đề)"),
    content: clean(content).slice(0, 8000),
    ogImage: ogImage ? absUrl(ogImage, finalUrl) : null,
    domain,
  };
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function absUrl(maybeRel: string, base: string): string {
  try {
    return new URL(maybeRel, base).toString();
  } catch {
    return maybeRel;
  }
}

export function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "local";
  }
}
