import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import * as cheerio from 'cheerio';
import { search, SafeSearchType } from 'duck-duck-scrape';
import { gemmaModel } from '@/lib/gemini';
import crypto from 'crypto';
// import { decodeGoogleNewsUrl } from '@/lib/google-news-decoder'; // Puppeteer removed for Cloudflare compatibility

/**
 * AI 新闻解读 API (Node.js Runtime)
 * 
 * 逻辑升级：
 * 1. 优先尝试 Google Gemini (Gemma 3) 进行解读。
 * 2. 支持搜索增强：自动提取标题关键词并搜索背景信息。
 * 3. 失败自动降级：如果 Google API 失败，回退到本地 FastAPI (Ollama)。
 * 4. 保持 R2 缓存机制。
 */

export const runtime = 'nodejs'; // 必须使用 Node.js 运行时以支持 cheerio/ddgs/puppeteer

// 配置
const FASTAPI_URL = process.env.FASTAPI_URL || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8001' : 'https://fastapi.saaaai.com');
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'cnjp-data';

// 初始化 S3 客户端
let s3Client: S3Client | null = null;
if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    });
}

function md5(str: string) {
    return crypto.createHash('md5').update(str).digest('hex');
}

// 辅助函数：通过标题搜索真实链接 (DDGS)
async function findDetailedUrl(title: string): Promise<string | null> {
    if (!title) return null;
    try {
        console.log(`[Gemini] Attempting to find original URL via DDGS for: ${title.substring(0, 30)}...`);
        const results = await search(title, {
            safeSearch: SafeSearchType.STRICT,
            locale: 'ja-JP'
        });

        if (results.results && results.results.length > 0) {
            // 过滤掉 Google News 自身的链接
            for (const r of results.results) {
                if (!r.url.includes("news.google.com") && !r.url.includes("google.com/search")) {
                    console.log(`[Gemini] Found alternative URL via DDGS: ${r.url}`);
                    return r.url;
                }
            }
        }
    } catch (e) {
        console.warn(`[Gemini] DDGS search for original URL failed:`, e);
    }
    return null;
}

// 辅助函数：抓取网页正文
async function fetchArticleContent(url: string, title?: string): Promise<{ title: string; content: string }> {
    try {
        // 🔑 关键修复：使用 Puppeteer 解码 Google News URL (处理 JS 重定向)
        let realUrl = url;
        let preFetchedHtml = ""; // 用于存储 Puppeteer 直接获取的 HTML

        // 策略 1: 尝试通过 DDGS 搜索原文链接 (优先使用，速度快)
        // 用户明确希望使用 DDGS 抓取
        if (title && url.includes("news.google.com")) {
            const altUrl = await findDetailedUrl(title);
            if (altUrl) {
                realUrl = altUrl;
                // 注意：这里我们找到了真实链接，接下来会走下面的标准 fetch 流程
                // 不需要 Puppeteer
            }
        }

        // 策略 1: 尝试通过 DDGS 搜索原文链接 (优先使用，速度快)
        // 用户明确希望使用 DDGS 抓取
        if (title && url.includes("news.google.com")) {
            const altUrl = await findDetailedUrl(title);
            if (altUrl) {
                realUrl = altUrl;
            }
        }

        // Cloudflare 环境不支持 Puppeteer，已移除兜底策略
        // 如果 DDGS 失败，将直接尝试 fetch 原链接 (可能拿到聚合页，由后续逻辑处理)

        let html = preFetchedHtml;
        let finalUrl = realUrl;

        // 只有当 Puppeteer 没有获取到内容时，才执行常规 fetch
        if (!html) {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7'
            };

            let response = await fetch(realUrl, {
                headers,
                redirect: 'follow',
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            html = await response.text();
            finalUrl = response.url;
        }

        // 如果解码后的URL仍然重定向到 Google News，记录警告
        if (finalUrl.includes("news.google.com")) {
            console.warn(`[Gemini] Warning: Still on Google News after decode. Final URL: ${finalUrl}`);
        }

        const $ = cheerio.load(html);

        // 移除无关元素
        $('script, style, nav, footer, header, iframe, .ad, .advertisement').remove();

        // 优先提取 og:title，其次 title
        let extractedTitle = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || $('h1').first().text().trim() || "";

        // 🚨 关键检查：如果标题是 "Google News" 或 "Google 新闻"，说明我们仍然停留在聚合页，抓取失败
        if (extractedTitle.includes("Google News") || extractedTitle.includes("Google 新闻")) {
            console.warn("[Gemini] Extraction stuck on Google News landing page. Aborting content extraction.");
            // 抓取失败，回退到传入的标题
            return { title: title || "", content: "" };
        }

        // 提取正文 (简单启发式)
        let content = "";
        const article = $('article');
        if (article.length > 0) {
            content = article.text().replace(/\s+/g, ' ').trim();
        } else {
            content = $('body p').map((i, el) => $(el).text()).get().join('\n').replace(/\s+/g, ' ').trim();
        }

        // 简单的文本清洗
        content = content.substring(0, 8000);

        return { title: extractedTitle || title || "未知文章", content };
    } catch (e) {
        console.error("Fetch error:", e);
        return { title: "未知文章", content: "" };
    }
}

// 辅助函数：搜索增强
async function searchContext(keyword: string): Promise<string> {
    if (!keyword) return "";
    try {
        const results = await search(keyword, {
            safeSearch: SafeSearchType.STRICT,
            locale: 'zh-CN' // 搜索中文背景
        });

        if (results.results && results.results.length > 0) {
            return results.results.slice(0, 2).map(r => `[搜索背景] ${r.title}: ${r.description}`).join('\n');
        }
    } catch (e: any) {
        if (e.message && e.message.includes("DDG detected an anomaly")) {
            console.warn("Search skipped (Rate Limited by DDG). Proceeding without background.");
        } else {
            console.warn("Search failed:", e);
        }
    }
    return "";
}

// 核心：使用 Google Gemini 生成
async function generateWithGemini(title: string, content: string, background: string) {
    const prompt = `
【语言强制锁定】
**警告：本任务的唯一输出语言为简体中文（Simplified Chinese）。**
**禁止**在输出结果中包含任何日文句子。如果包含日文，任务视为失败。

你是一名专业的新闻整理型AI编辑，面向看不到、也看不懂日文原文的中文读者。
你的任务是：阅读日文原文，**将其翻译并改写**为简体中文新闻简报。

【新闻标题】
${title}

【背景信息】
${background}

【新闻全文（日文）】
${content}

【核心指令】
1. **翻译并整合**：必须整合正文所有信息，所有内容必须**翻译成地道的简体中文**。
2. **辩证对立结构**：严格区分"成就/优势"与"问题/挑战"。
3. **精准数据原则**：保留关键数据，禁止编造数字。
4. **输出 Traditional Chinese (繁体)**：同时提供繁体中文版本。

【输出格式 (JSON)】
请直接返回 JSON 对象，不要包含 Markdown 格式标记（如 \`\`\`json）：
{
  "title": "中文标题",
  "simplified": "简体中文内容...",
  "traditional": "繁體中文內容...",
  "original_url": "原文链接(由外部填充)",
  "analyzed_at": "ISO时间字符串(由外部填充)"
}

对于 simplified 和 traditional 字段，请将内容组织为以下纯文本格式（保留换行符）：
核心事实：
(2-3句话)

背景说明：
(2-3句话)

正面评价：
(3-4句话)

负面评价：
(3-4句话)

一句话总结：
(中性陈述)
`;

    const result = await gemmaModel.generateContent(prompt);
    const text = result.response.text();
    // 清理可能的 Markdown 标记
    const jsonStr = text.replace(/```json\s*|\s*```/g, "");
    return JSON.parse(jsonStr);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const inputUrl = body.url;
        const inputUrlTitle = body.title; // 获取传入的标题
        const forceRefresh = body.force === true; // 强制刷新标志

        // 1. R2 缓存检查（如果 force=true 则跳过）
        if (s3Client && inputUrl && !forceRefresh) {
            try {
                const hashId = md5(inputUrl);
                const command = new GetObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: `analysis/${hashId}.json`,
                });
                const r2Response = await s3Client.send(command);
                if (r2Response.Body) {
                    const jsonString = await r2Response.Body.transformToString();
                    return NextResponse.json({
                        source: "cache",
                        hash_id: hashId,
                        data: JSON.parse(jsonString),
                        cached: true,
                        via: "edge-r2-instant"
                    });
                }
            } catch (e) { }
        }

        if (forceRefresh) {
            console.log(`[Gemini] Force refresh requested for: ${inputUrl}`);
        }

        const titleJa = body.title_ja;
        const searchTitle = titleJa || inputUrlTitle; // 优先用日语标题搜索
        console.log(`[Gemini] Search Title (for DDGS): ${searchTitle}`);

        // 2. 尝试 Google Gemini 方案
        try {
            console.log(`[Gemini] Starting analysis for: ${inputUrl}`);
            const { title, content } = await fetchArticleContent(inputUrl, searchTitle);

            let finalContent = content;
            let finalBackground = "";

            if (content.length <= 50) {
                console.warn(`[Gemini] Content too short (${content.length} chars). Using Title+Context mode. URL: ${inputUrl}`);
                finalContent = "（注意：原文正文抓取失败。请完全基于新闻标题和提供的背景信息进行分析和撰写。）";
            }

            // 关键词提取与背景搜索
            const keyword = title.substring(0, 10);
            finalBackground = await searchContext(keyword);

            const data = await generateWithGemini(title, finalContent, finalBackground);

            // 补全字段
            data.original_url = inputUrl;
            data.analyzed_at = new Date().toISOString();

            // 写入缓存
            if (s3Client) {
                const hashId = md5(inputUrl);
                await s3Client.send(new PutObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: `analysis/${hashId}.json`,
                    Body: JSON.stringify(data),
                    ContentType: 'application/json'
                }));
            }

            return NextResponse.json({
                source: "gemini-3",
                hash_id: md5(inputUrl),
                data: data,
                cached: false
            });

        } catch (geminiError: any) {
            console.error("[Gemini] Failed, falling back to local.");
            console.error("Error Details:", geminiError);
            if (geminiError.response) {
                console.error("API Response:", geminiError.response);
            }
            // 继续向下执行，进入 Fallback 流程
        }

        // 3. Fallback: 转发到本地 FastAPI (Ollama)
        // [Cloudflare Deployment] 本地 Ollama 在云端无法访问，且用户要求禁用本地 fallback
        // console.log(`[Fallback] Forwarding to FastAPI: ${FASTAPI_URL}`);
        // const response = await fetch(`${FASTAPI_URL}/analyze`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(body),
        // });

        // if (!response.ok) {
        //     const errorText = await response.text();
        //     let errorData;
        //     try { errorData = JSON.parse(errorText); } catch { errorData = { detail: errorText }; }
        //     return NextResponse.json(
        //         {
        //             error: (errorData.detail || errorData.error) || '所有 AI 方案均已失败',
        //             fallback_failed: true
        //         },
        //         { status: response.status }
        //     );
        // }
        // const data = await response.json();
        // return NextResponse.json(data);

        return NextResponse.json(
            { error: 'Google Gemini Analysis Failed. Local Fallback is disabled for Cloudflare deployment.' },
            { status: 500 }
        );

    } catch (error: any) {
        console.error('Analyze API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

// 保持 GET 健康检查与原逻辑一致 (代理到 FastAPI 检查排队状态)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const isQueueCheck = searchParams.get('queue') === 'true';

    try {
        if (isQueueCheck) {
            const response = await fetch(`${FASTAPI_URL}/queue`);
            if (response.ok) return NextResponse.json(await response.json());
        } else {
            const response = await fetch(`${FASTAPI_URL}/health`);
            if (response.ok) return NextResponse.json(await response.json());
        }
    } catch (error) { }

    // 如果 FastAPI 挂了，但我们有 Gemini，我们依然可以返回 "Online" (假装)
    // 或者返回一个标记，表明仅云端可用
    return NextResponse.json({
        status: 'cloud_only',
        message: '本地 AI 服务离线，使用云端 Gemini',
        offline: false
    });
}
