import { describe, expect, it, vi, afterEach } from "vitest";

afterEach(() => vi.restoreAllMocks());

describe("fetchArticle: paragraph preservation", () => {
  it("keeps paragraph breaks in extracted body so the LLM gets structure", async () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Tin demo">
      <meta property="og:image" content="/img.jpg">
      </head><body><article>
        <p>   Đoạn một có nội dung   khá dài để vượt qua bộ lọc 30 ký tự đặt ra bởi extractor.   </p>
        <p>Đoạn  hai cũng đủ dài và sẽ tách bằng \\n\\n trong output sau khi được ghép.</p>
        <p>Đoạn ba thêm nội dung phụ để đảm bảo paragraphs.length >= 3 chiếm ưu tiên.</p>
      </article></body></html>`;

    vi.doMock("axios", () => ({
      default: {
        get: vi.fn(async () => ({
          data: html,
          request: { res: { responseUrl: "https://example.com/foo" } },
        })),
      },
    }));

    const { fetchArticle } = await import("./article-fetcher.js");
    const article = await fetchArticle("https://example.com/foo");

    // Paragraphs MUST be separated by \n\n, not collapsed to a single space.
    expect(article.content).toContain("\n\n");
    expect(article.content.split("\n\n").length).toBeGreaterThanOrEqual(3);

    // Multi-space runs within a paragraph are still collapsed.
    expect(article.content).not.toMatch(/   /);

    expect(article.title).toBe("Tin demo");
    expect(article.ogImage).toBe("https://example.com/img.jpg");
    expect(article.domain).toBe("example.com");
  });
});
