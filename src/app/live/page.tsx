'use client';

import { useEffect, useState } from 'react';

interface LiveData {
    isLive: boolean;
    videoId: string | null;
    title: string | null;
    lastUpdated: string;
}

export default function LivePage() {
    const [data, setData] = useState<LiveData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/live_data.json')
            .then((res) => res.json())
            .then((data) => {
                setData(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch live data', err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6 text-center">实时直播</h1>

            {loading && <p className="text-center">加载中...</p>}

            {!loading && data && (
                <div className="flex flex-col items-center">
                    {data.isLive && data.videoId ? (
                        <div className="w-full max-w-4xl aspect-video">
                            <iframe
                                className="w-full h-full rounded-lg shadow-lg"
                                src={`https://www.youtube.com/embed/${data.videoId}?autoplay=1`}
                                title={data.title || "Live Stream"}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                            <h2 className="text-xl font-semibold mt-4">{data.title}</h2>
                            <p className="text-gray-500 text-sm mt-2">最后更新: {new Date(data.lastUpdated).toLocaleString()}</p>
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-gray-100 rounded-lg w-full max-w-2xl">
                            <p className="text-xl text-gray-600">当前没有正在进行的直播。</p>
                            <p className="text-gray-500 mt-2">请稍后再来看看！</p>
                            {data.lastUpdated && (
                                <p className="text-gray-400 text-xs mt-4">最后检查: {new Date(data.lastUpdated).toLocaleString()}</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
