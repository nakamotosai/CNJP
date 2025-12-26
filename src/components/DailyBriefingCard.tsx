"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useTheme } from "./ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Calendar, TrendingUp, Info, ChevronDown, ChevronUp, ExternalLink, Archive, X, Loader2, Target, AlertCircle, Compass } from "lucide-react";
import Modal from "./Modal";
import { format, eachDayOfInterval, startOfDay, isAfter, subDays } from "date-fns";

export interface DailyBriefingData {
    title: string;
    title_tc?: string;
    summary: string;
    summary_tc?: string;
    // 新增独立分段字段
    section_stance?: string;
    section_stance_tc?: string;
    section_events?: string;
    section_events_tc?: string;
    section_forecast?: string;
    section_forecast_tc?: string;
    key_highlights: {
        title: string;
        title_tc?: string;
        link: string;
        origin: string;
        analysis: string;
        analysis_tc?: string;
        title_ja?: string;
    }[];
    editorial_vibe: string;
    editorial_vibe_tc?: string;
    timestamp: string;
    id: string;
    type: string;
    generated_at: string;
    news_count: number;
}

interface DailyBriefingCardProps {
    data: DailyBriefingData;
    className?: string;
}

/**
 * 内部组件：简报内容渲染块
 * 支持简繁切换显示逻辑，使用新的独立分段字段
 */
function BriefingContent({ briefing, isExpanded = true, isArchive = false, lang = "sc", onHighlightSelect, archiveDate }: {
    briefing: DailyBriefingData,
    isExpanded: boolean,
    isArchive?: boolean,
    lang?: string,
    onHighlightSelect: (highlight: DailyBriefingData["key_highlights"][0], dateStr: string) => void,
    archiveDate?: string  // 新增：存档日期用于显示
}) {
    // 获取态势定调内容
    const stanceContent = useMemo(() => {
        return (lang === "tc" && briefing.section_stance_tc) ? briefing.section_stance_tc : briefing.section_stance;
    }, [briefing, lang]);

    // 获取关键事件内容
    const eventsContent = useMemo(() => {
        return (lang === "tc" && briefing.section_events_tc) ? briefing.section_events_tc : briefing.section_events;
    }, [briefing, lang]);

    // 获取风向预测内容
    const forecastContent = useMemo(() => {
        return (lang === "tc" && briefing.section_forecast_tc) ? briefing.section_forecast_tc : briefing.section_forecast;
    }, [briefing, lang]);

    // 兼容旧数据：从summary中解析
    const fallbackSections = useMemo(() => {
        if (stanceContent || eventsContent || forecastContent) return null;
        const activeSummary = (lang === "tc" && briefing.summary_tc) ? briefing.summary_tc : briefing.summary;
        if (!activeSummary) return null;

        const parts = activeSummary.split(/(?=<b>)/g);
        const parsed: { stance: string, events: string, forecast: string } = { stance: '', events: '', forecast: '' };

        parts.forEach(part => {
            const match = part.match(/<b>(.*?)<\/b>/);
            if (match) {
                const title = match[1];
                const content = part.replace(/<b>.*?<\/b>/, '').trim();
                if (title.includes('态势定调') || title.includes('態勢定調')) {
                    parsed.stance = content;
                } else if (title.includes('关键事件') || title.includes('關鍵事件')) {
                    parsed.events = content;
                } else if (title.includes('风向预测') || title.includes('風向預測')) {
                    parsed.forecast = content;
                }
            }
        });

        return parsed;
    }, [briefing, lang, stanceContent, eventsContent, forecastContent]);

    // 最终使用的内容
    const stance = stanceContent || fallbackSections?.stance || '';
    const events = eventsContent || fallbackSections?.events || '';
    const forecast = forecastContent || fallbackSections?.forecast || '';

    // 格式化存档日期显示
    const formattedArchiveDate = useMemo(() => {
        if (!archiveDate) return null;
        // archiveDate 格式为 "2025-12-01"
        const parts = archiveDate.split('-');
        if (parts.length !== 3) return archiveDate;
        const year = parts[0];
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        return lang === "tc"
            ? `${year}年${month}月${day}日`
            : `${year}年${month}月${day}日`;
    }, [archiveDate, lang]);

    // 用于热点卡片的日期字符串
    const dateForHighlight = archiveDate || "";

    return (
        <div className={`p-6 md:p-10 ${isExpanded ? "space-y-8" : "space-y-0"} ${isArchive ? "max-h-[75vh] overflow-y-auto custom-scrollbar" : ""}`}>

            {/* 存档日期大标题 - 仅在存档模式下显示 */}
            {isArchive && formattedArchiveDate && (
                <div className="text-center pb-6 border-b border-gray-100 dark:border-white/10">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-sub mb-2">
                        {lang === "tc" ? "歷史存檔" : "历史存档"}
                    </p>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        {formattedArchiveDate}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-sub mt-2">
                        {lang === "tc" ? "中日態勢AI簡報" : "中日态势AI简报"}
                    </p>
                </div>
            )}

            {/* 态势定调 - 横置全宽 */}
            {stance && (
                <div className="briefing-sub-card p-6 md:p-8 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 shadow-sm hover:border-red-500/20 dark:hover:border-indigo-500/20 cursor-text">
                    <div className="flex items-center gap-3 mb-5 pointer-events-none">
                        <Target className="w-4 h-4 text-red-600 dark:text-indigo-500" />
                        <h3 className="text-[17px] font-black text-gray-900 dark:text-white tracking-wide">
                            {lang === "tc" ? "中日關係AI綜合研判" : "中日关系AI综合研判"}
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {stance.split('\n').filter(l => l.trim()).map((line, li) => (
                            <p key={li} className="text-[14px] leading-[1.8] text-gray-700 dark:text-gray-300 font-medium" dangerouslySetInnerHTML={{ __html: line }} />
                        ))}
                    </div>
                </div>
            )}

            {/* 关键事件（左）+ 风向预测（右）- 只在展开时显示 */}
            {/* 手机端：垂直排列，电脑端：左右排列 */}
            {isExpanded && (events || forecast) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                    {/* 关键事件 - 左侧 */}
                    {events && (
                        <div className="briefing-sub-card p-6 md:p-8 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 shadow-sm hover:border-red-500/20 dark:hover:border-indigo-500/20 cursor-text">
                            <div className="flex items-center gap-3 mb-5 pointer-events-none">
                                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <h3 className="text-[17px] font-black text-gray-900 dark:text-white tracking-wide">
                                    {lang === "tc" ? "關鍵事件" : "关键事件"}
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {events.split('\n').filter(l => l.trim()).map((line, li) => (
                                    <p key={li} className="text-[14px] leading-[1.8] text-gray-700 dark:text-gray-300 font-medium" dangerouslySetInnerHTML={{ __html: line }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 风向预测 - 右侧 */}
                    {forecast && (
                        <div className="briefing-sub-card p-6 md:p-8 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 shadow-sm hover:border-red-500/20 dark:hover:border-indigo-500/20 cursor-text">
                            <div className="flex items-center gap-3 mb-5 pointer-events-none">
                                <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <h3 className="text-[17px] font-black text-gray-900 dark:text-white tracking-wide">
                                    {lang === "tc" ? "風向預測" : "风向预测"}
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {forecast.split('\n').filter(l => l.trim()).map((line, li) => (
                                    <p key={li} className="text-[14px] leading-[1.8] text-gray-700 dark:text-gray-300 font-medium" dangerouslySetInnerHTML={{ __html: line }} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 当日热点 - 底部小卡片 */}
            {(isExpanded || isArchive) && briefing.key_highlights && briefing.key_highlights.length > 0 && (
                <div className="animate-in fade-in duration-500 pt-4">
                    <div className="flex items-center gap-2 mb-6 px-2">
                        <TrendingUp className="w-4 h-4 text-red-600 dark:text-indigo-400" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-sub">
                            {lang === "tc" ? "Highlights 當日熱點" : "Highlights 当日热点"}
                        </h3>
                    </div>
                    {/* 手机端：垂直排列，电脑端：3列网格 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                        {briefing.key_highlights.map((item, idx) => {
                            const displayTitle = (lang === "tc" && item.title_tc) ? item.title_tc : item.title;
                            return (
                                <button
                                    key={idx}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onHighlightSelect(item, dateForHighlight);
                                    }}
                                    className="highlight-card group/link p-5 rounded-2xl bg-white dark:bg-white/[0.01] border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-indigo-500/[0.03] hover:border-red-500/30 dark:hover:border-indigo-400/30 transition-all flex flex-col justify-between text-left"
                                >
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-sub rounded-md uppercase tracking-wider">
                                                {item.origin}
                                            </span>
                                        </div>
                                        <h4 className="text-[14px] font-black text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight group-hover/link:text-red-600 dark:group-hover/link:text-indigo-400 transition-colors">
                                            {displayTitle}
                                        </h4>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between opacity-40 group-hover/link:opacity-100 transition-opacity">
                                        <span className="text-[11px] italic text-gray-500 dark:text-sub">{lang === "tc" ? "解析詳情" : "解析详情"}</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DailyBriefingCard({ data, className = "" }: DailyBriefingCardProps) {
    const { settings } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedHighlight, setSelectedHighlight] = useState<{ highlight: DailyBriefingData["key_highlights"][0], dateStr: string } | null>(null);
    const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);
    const [selectedHistoryBriefing, setSelectedHistoryBriefing] = useState<DailyBriefingData | null>(null);
    const [selectedArchiveDate, setSelectedArchiveDate] = useState<string>(""); // 新增：记录选中的日期
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    if (!data) return null;

    // 标题的多语言处理
    const displayTitle = useMemo(() => {
        let title = (settings.lang === "tc" && data.title_tc) ? data.title_tc : data.title;
        return title.replace("态势简报", settings.lang === "tc" ? "中日態勢AI簡報" : "中日态势AI简报")
            .replace("態勢簡報", "中日態勢AI簡報");
    }, [data, settings.lang]);

    const activeVibe = useMemo(() => {
        return (settings.lang === "tc" && data.editorial_vibe_tc) ? data.editorial_vibe_tc : data.editorial_vibe;
    }, [data, settings.lang]);

    const archiveDates = useMemo(() => {
        const start = startOfDay(new Date(2025, 11, 1)); // 2025-12-01
        const end = subDays(startOfDay(new Date()), 1); // 截止到昨天
        if (isAfter(start, end)) return [];
        return eachDayOfInterval({ start, end }).map(date => format(date, "yyyy-MM-dd")).reverse();
    }, []);

    // 获取今天的日期字符串
    const todayDateStr = useMemo(() => {
        return format(new Date(), "yyyy-MM-dd");
    }, []);

    // 强置顶逻辑
    const handleForceScrollToTop = () => {
        const performScroll = () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.documentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (window.scrollY > 0) {
                document.body.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        performScroll();
        setTimeout(performScroll, 100);
        setTimeout(performScroll, 400);
    };

    const toggleExpand = (e?: React.MouseEvent) => {
        const target = e?.target as HTMLElement;
        if (target.closest('a, button, .highlight-card, .archive-drawer')) return;
        if (isExpanded && target.closest('.briefing-sub-card')) return;

        const newExpandedState = !isExpanded;
        if (!newExpandedState) {
            handleForceScrollToTop();
        }
        setIsExpanded(newExpandedState);
    };

    const handleOpenArchive = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowArchiveDrawer(!showArchiveDrawer);
    };

    const loadArchiveBriefing = async (dateStr: string) => {
        setIsHistoryLoading(true);
        setSelectedArchiveDate(dateStr); // 记录选中的日期
        try {
            const url = `https://r2.cn.saaaai.com/ollama/${dateStr}_summary.json`;
            const res = await fetch(url);
            if (res.ok) {
                const historyData = await res.json();
                setSelectedHistoryBriefing(historyData);
                setShowArchiveDrawer(false);
            } else {
                alert(settings.lang === "tc" ? "未找到該日期的存檔數據。" : "未找到该日期的存档数据。");
            }
        } catch (e) {
            console.error("Failed to fetch history briefing", e);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    // 处理热点选择，同时传递日期信息
    const handleHighlightSelect = (highlight: DailyBriefingData["key_highlights"][0], dateStr: string) => {
        setSelectedHighlight({ highlight, dateStr });
    };

    // 格式化日期显示（用于热点详情弹窗）
    const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return data.timestamp;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[0]}-${parts[1]}-${parts[2]}`;
    };

    return (
        <>
            <div
                ref={cardRef}
                id="daily-briefing-card"
                className={`w-full relative overflow-hidden rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 shadow-2xl dark:shadow-none lg:col-span-2 ${className}`}
            >
                {/* 顶部 Header */}
                <div className="p-5 md:p-8 border-b border-gray-50 dark:border-white/[0.03]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg md:text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-tight mb-2">
                                {displayTitle}
                            </h2>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] md:text-[11px] font-bold text-gray-400 dark:text-sub uppercase tracking-wider">
                                <span className="text-red-500 dark:text-indigo-400 font-extrabold">
                                    {settings.lang === "tc" ? "昨日中日關係：" : "昨日中日关系："}
                                    {activeVibe}
                                </span>
                                <span className="opacity-20 hidden xs:block">|</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400">{settings.lang === "tc" ? "當日抓取報導" : "当日抓取报道"}</span>
                                    <span className="text-red-500 dark:text-indigo-400 font-black">{data.news_count}</span>
                                    <span className="text-gray-400">{settings.lang === "tc" ? "篇" : "篇"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative shrink-0 pt-0.5">
                            <button
                                onClick={handleOpenArchive}
                                className={`
                                    relative flex items-center gap-1.5 transition-all duration-200 whitespace-nowrap flex-shrink-0 
                                    h-[30px] dark:h-[32px] px-3.5 dark:px-4 text-[13px] font-bold active:scale-95 cursor-pointer
                                    ${settings.theme === 'dark'
                                        ? 'category-tag-active text-white backdrop-blur-sm'
                                        : 'bg-red-600 text-white rounded-[0.75rem] shadow-lg shadow-red-600/20 hover:bg-red-700'
                                    }
                                `}
                            >
                                {settings.theme === 'dark' ? (
                                    <span className="w-2.5 h-2.5 rounded-full rainbow-dot shrink-0" />
                                ) : (
                                    <Archive className="w-3.5 h-3.5" />
                                )}
                                <span>{settings.lang === "tc" ? "日報存檔" : "日报存档"}</span>
                            </button>

                            <AnimatePresence>
                                {showArchiveDrawer && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="archive-drawer absolute top-full right-0 mt-3 w-44 md:w-48 bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                                    >
                                        <div className="p-2 border-b border-gray-50 dark:border-white/5 flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-gray-400 pl-2">Select Date</span>
                                            <button onClick={() => setShowArchiveDrawer(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-3 h-3" /></button>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                                            {archiveDates.map(date => (
                                                <button
                                                    key={date}
                                                    onClick={() => loadArchiveBriefing(date)}
                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 rounded-lg transition-colors flex justify-between items-center group cursor-pointer"
                                                >
                                                    {date}
                                                    <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 -rotate-90" />
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* 内容区域 - 使用 CSS max-height 替代 Framer Motion 以提升性能 */}
                <div
                    className={`
                        relative overflow-hidden cursor-pointer
                        transition-[max-height] duration-500 ease-out
                        ${isExpanded ? "max-h-[3000px]" : "max-h-[260px]"}
                    `}
                    style={{ willChange: 'max-height' }}
                    onClick={(e) => toggleExpand(e)}
                >
                    <BriefingContent
                        briefing={data}
                        isExpanded={isExpanded}
                        lang={settings.lang}
                        onHighlightSelect={handleHighlightSelect}
                        archiveDate={todayDateStr}
                    />
                </div>

                {/* 底部引导部分 */}
                <div
                    className="px-8 py-4 bg-gray-50/50 dark:bg-white/[0.01] border-t border-gray-100 dark:border-white/[0.03] relative cursor-pointer select-none"
                    onClick={(e) => toggleExpand(e)}
                >
                    {/* 英文声明 */}
                    <div className="flex items-center justify-between opacity-30 grayscale hover:grayscale-0 transition-all relative z-10 w-full pointer-events-none">
                        <div className="flex items-center gap-3 shrink-0">
                            <Info className="w-3.5 h-3.5 text-gray-400" />
                            <p className="text-[9px] text-gray-500 dark:text-sub font-bold tracking-wider uppercase">
                                AI AGENT CONTENT ENGINE
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <p className="text-[9px] text-gray-500 dark:text-sub font-bold tracking-wider uppercase">
                                DATA AS OF {data.generated_at?.substring(0, 10) || data.timestamp}
                            </p>
                        </div>
                    </div>

                    {/* 居中交互引导 - 保持原来的动画风格 */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <motion.div
                            className="pointer-events-auto cursor-pointer flex items-center gap-1 py-1"
                            animate={!isExpanded ? {
                                y: [0, -12, 0],
                                scaleY: [1, 0.9, 1.05, 1],
                            } : {}}
                            transition={!isExpanded ? {
                                duration: 0.8,
                                repeat: Infinity,
                                repeatDelay: 1.2,
                                ease: "easeInOut"
                            } : {}}
                        >
                            {isExpanded ? (
                                <>
                                    <span className="text-[12px] font-bold text-gray-400 dark:text-sub">{settings.lang === "tc" ? "收起簡報" : "收起简报"}</span>
                                    <ChevronUp className="w-4 h-4 text-gray-400 dark:text-sub" />
                                </>
                            ) : (
                                <>
                                    <span className="text-[13px] font-bold tracking-widest text-gradient-animated leading-none" style={{ fontFamily: (settings.lang === "tc" ? "'Noto Serif TC', serif" : "'Noto Serif SC', 'Songti SC', serif") }}>
                                        {settings.lang === "tc" ? "點擊展開全文" : "点击展开全文"}
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 text-red-500 dark:text-indigo-400" />
                                </>
                            )}
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* 历史日报弹窗 - 使用宽屏模式 */}
            <Modal
                isOpen={!!selectedHistoryBriefing}
                onClose={() => {
                    setSelectedHistoryBriefing(null);
                    setSelectedArchiveDate("");
                }}
                title=""
                size="wide"
            >
                {selectedHistoryBriefing && (
                    <BriefingContent
                        briefing={selectedHistoryBriefing}
                        isExpanded={true}
                        isArchive={true}
                        lang={settings.lang}
                        onHighlightSelect={handleHighlightSelect}
                        archiveDate={selectedArchiveDate}
                    />
                )}
            </Modal>

            {/* 加载指示器 */}
            {isHistoryLoading && (
                <div className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm flex items-center justify-center">
                    <div className="p-6 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl flex flex-col items-center gap-4">
                        <Loader2 className="w-8 h-8 text-red-600 dark:text-indigo-400 animate-spin" />
                        <p className="text-sm font-bold">{settings.lang === "tc" ? "正在調取歷史存檔..." : "正在调取历史存档..."}</p>
                    </div>
                </div>
            )}

            {/* 亮点详情弹窗 - 使用正确的日期 */}
            <Modal
                isOpen={!!selectedHighlight}
                onClose={() => setSelectedHighlight(null)}
                title=""
            >
                {selectedHighlight && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold leading-snug text-[var(--text-main)]">
                            {(settings.lang === "tc" && selectedHighlight.highlight.title_tc) ? selectedHighlight.highlight.title_tc : selectedHighlight.highlight.title}
                        </h2>
                        {selectedHighlight.highlight.title_ja && (
                            <h3 className="text-sm font-medium text-gray-500 dark:text-sub leading-relaxed">{selectedHighlight.highlight.title_ja}</h3>
                        )}
                        <div className="flex items-center gap-3 text-xs text-[var(--text-sub)] pb-2 border-b border-gray-100 dark:border-border">
                            <span className="font-medium">{selectedHighlight.highlight.origin}</span>
                            <span>•</span>
                            <span>{formatDateDisplay(selectedHighlight.dateStr)}</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-white/[0.02] p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                            <p className="font-black text-red-600 dark:text-indigo-400 mb-2 text-[11px] uppercase tracking-wider">
                                {settings.lang === "tc" ? "AI 一句話總結" : "AI 一句话总结"}
                            </p>
                            {(settings.lang === "tc" && selectedHighlight.highlight.analysis_tc) ? selectedHighlight.highlight.analysis_tc : selectedHighlight.highlight.analysis}
                        </div>
                        <div className="pt-2 flex items-center justify-end gap-2">
                            <a href={selectedHighlight.highlight.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--primary)] text-white rounded-full text-xs font-medium hover:opacity-90 transition-all shadow-floating shadow-red-500/20 dark:shadow-indigo-500/20 cursor-pointer">
                                <span>{settings.lang === "sc" ? "阅读原文" : "閱讀原文"}</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
