import { NextRequest, NextResponse } from 'next/server';

/**
 * AI 新闻解读 API 代理
 * 
 * 将前端请求转发到 FastAPI 服务
 * 生产环境: https://fastapi.saaaai.com (Cloudflare Tunnel)
 * 开发环境: http://localhost:8000
 */

const FASTAPI_URL = process.env.FASTAPI_URL || 'https://fastapi.saaaai.com';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 转发请求到 FastAPI
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
            return NextResponse.json(
                { error: errorData.detail || errorData.error || `API error: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Analyze API error:', error);
        // 检查是否是连接错误（服务未启动）
        if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('connect'))) {
            return NextResponse.json(
                { error: '站长电脑关机中，AI 服务暂时不可用', offline: true },
                { status: 503 }
            );
        }
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
            // 获取队列状态
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
