"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

// ================= 类型定义 =================
interface AnalysisTask {
    id: string;
    title: string;
    url: string;
    status: "pending" | "processing" | "completed" | "error";
    result?: {
        simplified: string;
        traditional: string;
        source: "cache" | "generate" | "gemini-3";
    };
    error?: string;
    startTime: number;
    elapsedTime?: number;
}

interface AiAnalysisContextType {
    tasks: Map<string, AnalysisTask>;
    startAnalysis: (id: string, title: string, url: string) => Promise<AnalysisTask>;
    dismissTask: (id: string) => void;
    getTask: (id: string) => AnalysisTask | undefined;
    queueLength: number;
    isServiceOnline: boolean;
}

// ================= Context =================
const AiAnalysisContext = createContext<AiAnalysisContextType | null>(null);

export function useAiAnalysis() {
    const context = useContext(AiAnalysisContext);
    if (!context) {
        throw new Error("useAiAnalysis must be used within AiAnalysisProvider");
    }
    return context;
}

// ================= API =================
const AI_ANALYZE_API = "/api";

// ================= Provider =================
export function AiAnalysisProvider({ children }: { children: React.ReactNode }) {
    const [tasks, setTasks] = useState<Map<string, AnalysisTask>>(new Map());
    const [queueLength, setQueueLength] = useState(0);
    const [isServiceOnline, setIsServiceOnline] = useState(true);
    const [completedTasks, setCompletedTasks] = useState<AnalysisTask[]>([]);

    // 轮询队列状态
    useEffect(() => {
        const checkQueue = async () => {
            try {
                const response = await fetch(`${AI_ANALYZE_API}/analyze`, {
                    method: 'GET',
                });
                // 如果能连通就是在线
                if (response.ok || response.status === 405) {
                    setIsServiceOnline(true);
                    // 尝试获取队列状态
                    try {
                        const queueRes = await fetch(`${AI_ANALYZE_API}/analyze?queue=true`);
                        if (queueRes.ok) {
                            const data = await queueRes.json();
                            setQueueLength(data.queue_length || 0);
                        }
                    } catch {
                        // 队列端点可能不存在
                    }
                }
            } catch {
                setIsServiceOnline(false);
            }
        };

        // 初始检查
        checkQueue();

        // 每10秒检查一次
        const interval = setInterval(checkQueue, 10000);
        return () => clearInterval(interval);
    }, []);

    const startAnalysis = useCallback(async (id: string, title: string, url: string): Promise<AnalysisTask> => {
        // 检查是否已存在
        const existing = tasks.get(id);
        if (existing && (existing.status === "completed" || existing.status === "processing")) {
            return existing;
        }

        // 创建新任务
        const task: AnalysisTask = {
            id,
            title,
            url,
            status: "pending",
            startTime: Date.now(),
        };

        setTasks(prev => new Map(prev).set(id, task));

        // 开始分析
        try {
            // 更新状态为处理中
            setTasks(prev => {
                const newMap = new Map(prev);
                const t = newMap.get(id);
                if (t) {
                    t.status = "processing";
                }
                return newMap;
            });

            const response = await fetch(`${AI_ANALYZE_API}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const elapsedTime = Math.floor((Date.now() - task.startTime) / 1000);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || `请求失败: ${response.status}`);
            }

            const result = await response.json();

            // 更新为完成状态
            const completedTask: AnalysisTask = {
                ...task,
                status: "completed",
                elapsedTime,
                result: {
                    simplified: result.data.simplified,
                    traditional: result.data.traditional,
                    source: result.source,
                }
            };

            setTasks(prev => new Map(prev).set(id, completedTask));
            setCompletedTasks(prev => [...prev, completedTask]);

            return completedTask;

        } catch (err) {
            const errorTask: AnalysisTask = {
                ...task,
                status: "error",
                elapsedTime: Math.floor((Date.now() - task.startTime) / 1000),
                error: err instanceof Error ? err.message : "分析失败"
            };

            setTasks(prev => new Map(prev).set(id, errorTask));
            setIsServiceOnline(false);

            return errorTask;
        }
    }, [tasks]);

    const dismissTask = useCallback((id: string) => {
        setTasks(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
        });
        setCompletedTasks(prev => prev.filter(t => t.id !== id));
    }, []);

    const getTask = useCallback((id: string) => {
        return tasks.get(id);
    }, [tasks]);

    return (
        <AiAnalysisContext.Provider value={{
            tasks,
            startAnalysis,
            dismissTask,
            getTask,
            queueLength,
            isServiceOnline,
        }}>
            {children}
            {/* 全局 Toast 通知 */}
            <AiToastContainer completedTasks={completedTasks} onDismiss={dismissTask} />
        </AiAnalysisContext.Provider>
    );
}

// ================= Toast 通知组件 =================
function AiToastContainer({
    completedTasks,
    onDismiss
}: {
    completedTasks: AnalysisTask[];
    onDismiss: (id: string) => void;
}) {
    // 只显示最近完成的任务（排除正在查看的）
    const [visibleToasts, setVisibleToasts] = useState<AnalysisTask[]>([]);
    const shownTasksRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // 找出新完成的任务
        const newTasks = completedTasks.filter(
            t => t.status === "completed" && !shownTasksRef.current.has(t.id)
        );

        if (newTasks.length > 0) {
            newTasks.forEach(t => shownTasksRef.current.add(t.id));
            setVisibleToasts(prev => [...prev, ...newTasks]);

            // 10秒后自动消失
            newTasks.forEach(task => {
                setTimeout(() => {
                    setVisibleToasts(prev => prev.filter(t => t.id !== task.id));
                }, 10000);
            });
        }
    }, [completedTasks]);

    const handleDismiss = (id: string) => {
        setVisibleToasts(prev => prev.filter(t => t.id !== id));
    };

    if (visibleToasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[3000] flex flex-col gap-2 max-w-sm">
            {visibleToasts.map(task => (
                <div
                    key={task.id}
                    className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-elevated p-4 animate-in slide-in-from-right duration-300 border border-indigo-100 dark:border-indigo-800/30"
                >
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex-shrink-0">
                            <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                AI 解读完成
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {task.title}
                            </div>
                            <div className="text-xs text-indigo-500 mt-1">
                                点击新闻卡片查看解读
                            </div>
                        </div>
                        <button
                            onClick={() => handleDismiss(task.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
