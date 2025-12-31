import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * AI 新闻解读 API (Edge Runtime)
 * 
 * 1. 优先尝试直接从 R2 读取缓存 (无需如站长电脑在线)
 * 2. 如果缓存不存在，转发请求到后端 FastAPI 服务进行生成
 */

export const runtime = 'edge';

// 配置
const FASTAPI_URL = process.env.FASTAPI_URL || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : 'https://fastapi.saaaai.com');
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

/**
 * 辅助函数: 计算 MD5
 * 在 Edge Runtime 中无法直接使用 node:crypto，
 * 这里使用 Web Crypto API 实现一个简单的 MD5 (需要注意兼容性)
 * 或者使用一个通用的 MD5 函数。
 * 由于 Cloudflare Edge 并没有内置 MD5，我们需要一个实现。
 */
async function getMd5(message: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(message);
    // 注意: SubtleCrypto 不支持 MD5。
    // 如果必须 MD5 (为了匹配 Python 侧)，我们需要一个 JS 实现的 MD5。
    // 这里使用一个精简的 MD5 实现。
    return md5(message);
}

// 精简 MD5 实现 (为了不依赖外部大库)
function md5(string: string) {
    function md5cycle(x: any, k: any) {
        var a = x[0], b = x[1], c = x[2], d = x[3];

        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);

        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);

        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, -680876936);
        d = hh(d, a, b, c, k[0], 11, -389564586);
        c = hh(c, d, a, b, k[3], 16, 606105819);
        b = hh(b, c, d, a, k[6], 23, -1044525330);
        a = hh(a, b, c, d, k[9], 4, -176418897);
        d = hh(d, a, b, c, k[12], 11, 1200080426);
        c = hh(c, d, a, b, k[15], 16, -1473231341);
        b = hh(b, c, d, a, k[2], 23, -45705983);

        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787280);
        b = ii(b, c, d, a, k[9], 21, -343485551);

        x[0] = add32(a, x[0]);
        x[1] = add32(b, x[1]);
        x[2] = add32(c, x[2]);
        x[3] = add32(d, x[3]);
    }

    function cmn(q: any, a: any, b: any, x: any, s: any, t: any) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
    }
    function ff(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    function gg(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    function hh(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function ii(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    function add32(a: any, b: any) {
        return (a + b) & 0xFFFFFFFF;
    }

    function md51(s: any) {
        var n = s.length,
            state = [1732584193, -271733879, -1732584194, 271733878], i;
        for (i = 64; i <= s.length; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < s.length; i++)
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i++) tail[i] = 0;
        }
        tail[14] = n * 8;
        md5cycle(state, tail);
        return state;
    }

    function md5blk(s: any) {
        var md5blks = [], i;
        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i)
                + (s.charCodeAt(i + 1) << 8)
                + (s.charCodeAt(i + 2) << 16)
                + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }

    var hex_chr = "0123456789abcdef".split("");

    function rhex(n: any) {
        var s = "", j = 0;
        for (; j < 4; j++)
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F]
                + hex_chr[(n >> (j * 8)) & 0x0F];
        return s;
    }

    function hex(x: any) {
        for (var i = 0; i < x.length; i++)
            x[i] = rhex(x[i]);
        return x.join("");
    }

    return hex(md51(string));
}

// 辅助函数: 获取真实 URL (处理重定向)
async function resolveUrl(url: string): Promise<string> {
    if (!url.includes('google.com')) return url;
    try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        return res.url;
    } catch {
        return url;
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const inputUrl = body.url;

        // 1. 尝试直接从 R2 读取缓存
        if (s3Client && inputUrl) {
            try {
                // 尝试解析真实 URL 以匹配 Python 侧的 Hash 逻辑
                const realUrl = await resolveUrl(inputUrl);
                const hashId = await getMd5(realUrl);

                const command = new GetObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: `analysis/${hashId}.json`,
                });

                const r2Response = await s3Client.send(command);
                if (r2Response.Body) {
                    const jsonString = await r2Response.Body.transformToString();
                    const cachedData = JSON.parse(jsonString);

                    return NextResponse.json({
                        source: "cache",
                        hash_id: hashId,
                        data: cachedData,
                        cached: true,
                        via: "edge-r2"
                    });
                }
            } catch (e: any) {
                // Ignore AccessDenied or NotFound, proceed to live API
            }
        }

        // 2. 缓存未命中，转发请求到 FastAPI (需要站长电脑在线)
        const response = await fetch(`${FASTAPI_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { detail: `Non-JSON Error (${response.status}): ${errorText.slice(0, 200)}` };
            }

            const isOffline = response.status === 502 || response.status === 503;

            if (isOffline && s3Client && inputUrl) {
                try {
                    const realUrl = await resolveUrl(inputUrl);
                    const hashId = await getMd5(realUrl);
                    const putCommand = new PutObjectCommand({
                        Bucket: R2_BUCKET_NAME,
                        Key: `pending/${hashId}.json`,
                        Body: JSON.stringify({
                            url: inputUrl,
                            real_url: realUrl,
                            requested_at: new Date().toISOString()
                        }),
                        ContentType: 'application/json'
                    });
                    await s3Client.send(putCommand);
                } catch (e) {
                    console.error('Failed to queue offline request:', e);
                }
            }

            return NextResponse.json(
                {
                    error: isOffline ? '站长的电脑没开机，等开机后会自动进行解读，请耐心等待。' : (errorData.detail || errorData.error),
                    detail: errorData.detail,
                    offline: isOffline
                },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Analyze API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

// 健康检查 + 队列状态
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const isQueueCheck = searchParams.get('queue') === 'true';

    try {
        if (isQueueCheck) {
            const response = await fetch(`${FASTAPI_URL}/queue`);
            if (response.ok) {
                const data = await response.json();
                return NextResponse.json(data);
            }
        }

        const response = await fetch(`${FASTAPI_URL}/health`);
        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        return NextResponse.json(
            { status: 'offline', message: '站长电脑关机中', offline: true },
            { status: 503 }
        );
    }
}
