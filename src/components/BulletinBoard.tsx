
"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Send, BarChart3 } from "lucide-react";
import { SYSTEM_BULLETINS, CATEGORY_DOT_COLORS, BULLETIN_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeContext";

interface Bulletin {
    id: string;
    content: string;
    created_at?: string;
    isSystem?: boolean;
}

interface AggregatedBulletin {
    content: string;
    count: number;
    percent: number;
    color: string;
}

const COLORS = Object.values(CATEGORY_DOT_COLORS).filter(c => c !== 'bg-gray-900' && c !== 'bg-gray-400');
const COOLDOWN_MS = 60 * 1000;

const getColorForContent = (content: string) => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = content.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLORS.length;
    return COLORS[index];
};

export default function BulletinBoard() {
    const { settings } = useTheme();
    const [bulletins, setBulletins] = useState<Bulletin[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [sending, setSending] = useState(false);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);

    // CSS Transform 动画状态
    const [offset, setOffset] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [contentWidth, setContentWidth] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 触摸事件相关
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    useEffect(() => {
        fetchBulletins();
        const lastSent = localStorage.getItem("last_bulletin_time");
        if (lastSent) {
            const diff = Date.now() - parseInt(lastSent, 10);
            if (diff < COOLDOWN_MS) {
                setCooldownRemaining(Math.ceil((COOLDOWN_MS - diff) / 1000));
            }
        }
    }, []);

    useEffect(() => {
        if (cooldownRemaining <= 0) return;
        const timer = setInterval(() => {
            setCooldownRemaining((prev) => prev <= 1 ? 0 : prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldownRemaining]);

    // 测量内容宽度
    useEffect(() => {
        if (contentRef.current) {
            setContentWidth(contentRef.current.scrollWidth / 2);
        }
    }, [bulletins]);

    // CSS Transform 动画 - 持续滚动
    useEffect(() => {
        if (contentWidth === 0) return;

        const scrollSpeed = 30; // pixels per second

        const animate = (timestamp: number) => {
            if (!lastTimeRef.current) lastTimeRef.current = timestamp;
            const deltaTime = timestamp - lastTimeRef.current;
            lastTimeRef.current = timestamp;

            if (!isPaused) {
                setOffset(prev => {
                    const newOffset = prev + (scrollSpeed * deltaTime) / 1000;
                    if (newOffset >= contentWidth) {
                        return newOffset - contentWidth;
                    }
                    return newOffset;
                });
            }
            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPaused, contentWidth]);

    // 暂停并1秒后强制恢复
    const pauseAndResume = useCallback(() => {
        setIsPaused(true);
        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
    }, []);

    // 鼠标事件 - PC端悬停暂停1秒后恢复
    const handleMouseEnter = useCallback(() => {
        pauseAndResume();
    }, [pauseAndResume]);

    const handleMouseLeave = useCallback(() => {
        // 确保1秒后恢复
        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
    }, []);

    // 触摸事件 - 触摸暂停，1秒后强制恢复
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        pauseAndResume();
    }, [pauseAndResume]);

    const handleTouchEnd = useCallback(() => {
        // 触摸结束后1秒恢复
        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
        touchStartRef.current = null;
    }, []);

    // 点击弹幕区域显示统计
    const handleMarqueeClick = useCallback(() => {
        setShowStatsModal(true);
    }, []);

    const fetchBulletins = async () => {
        try {
            const res = await fetch("/api/barrage");
            if (res.ok) {
                const data = await res.json();
                if (!Array.isArray(data) || data.length < 3) {
                    const mixed = [...(Array.isArray(data) ? data : []), ...SYSTEM_BULLETINS];
                    const unique = mixed.filter((item, index, self) =>
                        index === self.findIndex((t) => t.id === item.id)
                    );
                    setBulletins(unique);
                } else {
                    setBulletins(data);
                }
            } else {
                setBulletins(SYSTEM_BULLETINS);
            }
        } catch (e) {
            console.error("Failed to fetch barrage", e);
            setBulletins(SYSTEM_BULLETINS);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (content: string) => {
        if (sending) return;

        const lastSent = localStorage.getItem("last_bulletin_time");
        if (lastSent) {
            const diff = Date.now() - parseInt(lastSent, 10);
            if (diff < COOLDOWN_MS) {
                alert(`请稍候再试，还需等待 ${Math.ceil((COOLDOWN_MS - diff) / 1000)} 秒`);
                return;
            }
        }

        setSending(true);
        const newId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newItem: Bulletin = {
            id: newId,
            content,
            created_at: new Date().toISOString(),
        };

        setBulletins((prev) => {
            const updated = [newItem, ...prev];
            return updated.length > 100 ? updated.slice(0, 100) : updated;
        });

        localStorage.setItem("last_bulletin_time", Date.now().toString());
        setCooldownRemaining(60);
        setShowModal(false);

        try {
            await fetch("/api/barrage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newItem),
            });
        } catch (e) {
            console.error("Failed to send barrage", e);
        } finally {
            setSending(false);
        }
    };

    const aggregatedList = useMemo(() => {
        if (bulletins.length === 0) return [];

        const counts: Record<string, number> = {};
        bulletins.forEach(b => {
            counts[b.content] = (counts[b.content] || 0) + 1;
        });

        const total = bulletins.length;
        const distinctContents = Object.keys(counts);

        const result: AggregatedBulletin[] = distinctContents.map(content => {
            const count = counts[content];
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return { content, count, percent, color: getColorForContent(content) };
        });

        return result.sort((a, b) => b.count - a.count);
    }, [bulletins]);

    // 双倍内容实现无缝循环
    const displayList = [...aggregatedList, ...aggregatedList];

    const getPresetContent = (item: { sc: string, tc: string }) => {
        return settings.lang === 'tc' ? item.tc : item.sc;
    }

    return (
        <div className="w-full mb-3">
            <div className="w-full max-w-[600px] h-[52px] mx-auto bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 flex items-center px-1 mt-3 overflow-hidden">

                {/* Left Label */}
                <div className="flex items-center gap-1.5 pl-1 pr-3 border-r border-gray-100 dark:border-white/5 shrink-0 h-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300 leading-none">
                        {settings.lang === 'tc' ? '熱議' : '热议'}
                    </span>
                </div>

                {/* Scrollable Marquee Area - 可点击 */}
                <div
                    className="flex-1 overflow-hidden relative h-full flex items-center cursor-pointer"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onClick={handleMarqueeClick}
                >
                    <div
                        ref={contentRef}
                        className="inline-flex items-center will-change-transform"
                        style={{
                            transform: `translate3d(-${offset}px, 0, 0)`,
                        }}
                    >
                        {displayList.map((item, i) => (
                            <div
                                key={`${item.content}-${i}`}
                                className="mx-4 text-[13px] whitespace-nowrap flex items-center gap-1.5"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${item.color} shrink-0`} />
                                <span className="text-gray-600 dark:text-gray-300 font-medium">
                                    {item.content}
                                </span>
                                {item.count > 1 && (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
                                        x{item.count}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Send Button */}
                <button
                    onClick={() => {
                        if (cooldownRemaining > 0) {
                            alert(`请稍候再试，还需等待 ${cooldownRemaining} 秒`);
                            return;
                        }
                        setShowModal(true);
                    }}
                    disabled={cooldownRemaining > 0}
                    className={cn(
                        "relative flex items-center gap-1.5 text-[13px] transition-all duration-200 whitespace-nowrap flex-shrink-0 px-3.5 py-1.5 rounded-full shadow-md font-bold ml-2",
                        cooldownRemaining > 0
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-red-600 hover:bg-red-700 text-white active:scale-95"
                    )}
                >
                    <Send size={10} className={cooldownRemaining > 0 ? "" : "text-white dark:text-gray-900"} />
                    <span>{cooldownRemaining > 0 ? `${cooldownRemaining}s` : (settings.lang === 'tc' ? '發聲' : '发声')}</span>
                </button>
            </div>

            {/* 统计对话框 */}
            {showStatsModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div
                        className="bg-white dark:bg-[#202020] w-full max-w-sm rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 max-h-[70vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
                                {settings.lang === 'tc' ? '熱議統計' : '热议统计'}
                            </h3>
                            <button
                                onClick={() => setShowStatsModal(false)}
                                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 custom-scrollbar">
                            <div className="space-y-2">
                                {aggregatedList.map((item, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-black/20"
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                                {item.content}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                x{item.count}
                                            </span>
                                            <span className="text-xs text-gray-400 w-10 text-right">
                                                {item.percent}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-center">
                                <span className="text-xs text-gray-400">
                                    {settings.lang === 'tc'
                                        ? `共 ${bulletins.length} 條發言`
                                        : `共 ${bulletins.length} 条发言`}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="absolute inset-0 -z-10" onClick={() => setShowStatsModal(false)} />
                </div>,
                document.body
            )}

            {/* 发送对话框 */}
            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div
                        className="bg-white dark:bg-[#202020] w-full max-w-sm rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                                {settings.lang === 'tc' ? '選擇你的態度' : '选择你的态度'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-2">
                                {BULLETIN_PRESETS.map((item, i) => {
                                    const text = getPresetContent(item);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => handleSend(text)}
                                            className="text-center px-2 py-3 text-xs sm:text-sm rounded-xl bg-gray-50 dark:bg-black/20 hover:bg-[var(--primary)] hover:text-white dark:hover:bg-[var(--primary)] dark:text-gray-300 transition-all border border-transparent hover:border-[var(--primary)] active:scale-95 break-words leading-snug flex items-center justify-center gap-2 group"
                                        >
                                            <span>{text}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-4 text-[10px] text-center text-gray-400">
                                1分钟内限制发送1条 • 文明发言
                            </div>
                        </div>
                    </div>
                    <div className="absolute inset-0 -z-10" onClick={() => setShowModal(false)} />
                </div>,
                document.body
            )}
        </div>
    );
}
