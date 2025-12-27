import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
// @ts-ignore
import { createHash } from 'node:crypto';

/**
 * AI 新闻解读 API (Edge Runtime)
 * 
 * 1. 优先尝试直接从 R2 读取缓存 (无需如站长电脑在线)
 * 2. 如果缓存不存在，转发请求到后端 FastAPI 服务进行生成
 */

export const runtime = 'edge';

// 配置
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://fastapi.saaaai.com';
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

// 辅助函数: 计算 MD5
function getMd5(str: string): string {
    return createHash('md5').update(str).digest('hex');
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
                // 注意: 前端/Edge 的解析能力可能不如 Python 的 gnewsdecoder 强，
                // 但对于普通重定向能覆盖一部分 Case
                const realUrl = await resolveUrl(inputUrl);
                const hashId = getMd5(realUrl);

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
                        // 标记这是通过 Edge 直接读取的
                        via: "edge-r2"
                    });
                }
            } catch (e: any) {
                // Ignore AccessDenied or NotFound, proceed to live API
                // console.log("Cache miss or error:", e.name);
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

            // 如果是 503/502，说明后端挂了，且前面缓存还没命中
            const isOffline = response.status === 502 || response.status === 503;

            return NextResponse.json(
                {
                    error: isOffline ? '站长电脑关机中，且无历史缓存' : (errorData.detail || errorData.error),
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
            // 队列状态必须查 Live API
            const response = await fetch(`${FASTAPI_URL}/queue`);
            if (response.ok) {
                const data = await response.json();
                return NextResponse.json(data);
            }
        }

        // 健康检查
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
