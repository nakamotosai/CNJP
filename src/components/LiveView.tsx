"use client";

import { useEffect, useState } from 'react';
import { Play, Wifi, Clock, ExternalLink, ChevronDown, MonitorPlay } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StreamData {
    id: string;
    displayName: string;
    channelName: string;
    isLive: boolean;
    videoId: string | null;
    title: string | null;
    matchScore: number;
}

interface LiveData {
    lastUpdated: string;
    streams: StreamData[];
}

export default function LiveView() {
    const [data, setData] = useState<LiveData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedStreamId, setSelectedStreamId] = useState<string>('');

    useEffect(() => {
        fetch('/live_data.json')
            .then((res) => res.json())
            .then((data: LiveData) => {
                setData(data);
                const firstLive = data.streams.find(s => s.isLive);
                if (firstLive) {
                    setSelectedStreamId(firstLive.id);
                } else if (data.streams.length > 0) {
                    setSelectedStreamId(data.streams[0].id);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch live data', err);
                setLoading(false);
            });
    }, []);

    const selectedStream = data?.streams.find(s => s.id === selectedStreamId);
    const liveStreams = data?.streams.filter(s => s.isLive) || [];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mb-4"></div>
                <p className="text-sm tracking-widest uppercase">Loading Live Feeds...</p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="w-full max-w-[800px] mx-auto pb-20 animate-in fade-in duration-500">
            {/* Main Content Area */}
            <div className="flex flex-col gap-6">

                {/* Channel Switcher - Thumbnail Grid */}
                <div className="w-full">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider">切换频道</h3>
                        <span className="text-[10px] text-[var(--text-aux)] bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                            {liveStreams.length} / {data.streams.length} 在线
                        </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {data.streams.map(stream => (
                            <button
                                key={stream.id}
                                onClick={() => setSelectedStreamId(stream.id)}
                                className={`
                                    relative flex flex-col rounded-xl overflow-hidden transition-all duration-200 group
                                    ${selectedStreamId === stream.id
                                        ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-white dark:ring-offset-[#121212]'
                                        : 'hover:opacity-90'
                                    }
                                `}
                            >
                                {/* Thumbnail */}
                                <div className="aspect-video w-full bg-gray-200 dark:bg-black relative">
                                    <img
                                        src={`https://i.ytimg.com/vi/${stream.videoId}/mqdefault.jpg`}
                                        alt={stream.displayName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                    {/* Overlay Gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                                    {/* Status Badge */}
                                    <div className="absolute top-1 right-1">
                                        {stream.isLive ? (
                                            <div className="flex items-center gap-1 bg-red-600 text-white text-[8px] px-1.5 py-0.5 rounded-sm font-bold shadow-sm">
                                                <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                                LIVE
                                            </div>
                                        ) : (
                                            <div className="bg-black/60 text-white/70 text-[8px] px-1.5 py-0.5 rounded-sm font-bold backdrop-blur-sm">
                                                OFF
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="absolute bottom-0 left-0 w-full p-2 text-left">
                                    <div className="text-[10px] font-bold text-white leading-tight truncate drop-shadow-md">
                                        {stream.displayName}
                                    </div>
                                    <div className="text-[8px] text-white/80 truncate drop-shadow-md">
                                        {stream.channelName}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Video Player */}
                <div className="w-full flex flex-col gap-4">
                    {selectedStream ? (
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/5">
                            {selectedStream.isLive && selectedStream.videoId ? (
                                <div className="aspect-video w-full bg-black relative group">
                                    <iframe
                                        className="w-full h-full"
                                        src={`https://www.youtube.com/embed/${selectedStream.videoId}?autoplay=1`}
                                        title={selectedStream.title || selectedStream.displayName}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ) : (
                                <div className="aspect-video w-full bg-gray-100 dark:bg-[#2c2c2c] flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                    <Wifi className="w-12 h-12 mb-4 opacity-50" />
                                    <p className="font-medium">{selectedStream.displayName}</p>
                                    <p className="text-sm mt-2 opacity-70">当前暂无直播信号</p>
                                </div>
                            )}

                            {/* Video Info */}
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-[var(--text-main)] leading-tight mb-2">
                                            {selectedStream.displayName}
                                        </h2>
                                        <p className="text-sm text-[var(--text-sub)] line-clamp-2">
                                            {selectedStream.title || "暂无标题"}
                                        </p>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${selectedStream.isLive ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                                        <span className={`w-2 h-2 rounded-full ${selectedStream.isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                        {selectedStream.isLive ? 'LIVE' : 'OFFLINE'}
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-aux)]">
                                    <span className="flex items-center gap-1.5">
                                        <MonitorPlay className="w-3.5 h-3.5" />
                                        {selectedStream.channelName}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        {new Date(data.lastUpdated).toLocaleTimeString('zh-CN', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            timeZone: 'Asia/Tokyo'
                                        })} (东京时间)
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-400">请选择一个直播源</div>
                    )}
                </div>

            </div>
        </div>
    );
}
