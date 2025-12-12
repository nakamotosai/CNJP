"use client";

import { useState, useEffect } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../ThemeContext";

// --- Types ---
interface QuakeData {
    id: string;
    time: string;
    code: number;
    earthquake: {
        time: string;
        hypocenter: {
            name: string;
            latitude: number;
            longitude: number;
            depth: number;
            magnitude: number;
        };
        maxScale: number;
    };
    issue: {
        time: string;
        type: string;
    };
}

interface CityCallout {
    name: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    align: "start" | "end" | "middle" | "inherit";
    labelSC: string;
    labelTC: string;
}

// High-Density Japan Dot Map Coordinates
const JAPAN_DOTS = [
    // --- 北海道 (High Res) ---
    { x: 76, y: 10 }, { x: 79, y: 10 }, { x: 82, y: 11 }, { x: 85, y: 13 },
    { x: 75, y: 13 }, { x: 78, y: 13 }, { x: 81, y: 14 }, { x: 84, y: 16 },
    { x: 76, y: 16 }, { x: 79, y: 17 }, { x: 82, y: 19 }, { x: 85, y: 20 },
    { x: 74, y: 19 }, { x: 77, y: 20 }, { x: 80, y: 22 },
    // --- 东北 ---
    { x: 71, y: 26 }, { x: 74, y: 27 }, { x: 77, y: 29 },
    { x: 70, y: 29 }, { x: 73, y: 30 }, { x: 76, y: 32 },
    { x: 69, y: 33 }, { x: 72, y: 34 }, { x: 75, y: 36 },
    { x: 68, y: 37 }, { x: 71, y: 38 }, { x: 74, y: 40 },
    { x: 67, y: 40 }, { x: 70, y: 41 }, { x: 73, y: 43 },
    // --- 关东/中部 ---
    { x: 63, y: 44 }, { x: 66, y: 45 }, { x: 69, y: 46 }, { x: 72, y: 48 },
    { x: 62, y: 47 }, { x: 65, y: 48 }, { x: 68, y: 50 }, { x: 71, y: 51 },
    { x: 59, y: 49 }, { x: 62, y: 51 }, { x: 65, y: 53 },
    { x: 56, y: 52 }, { x: 59, y: 54 }, { x: 62, y: 56 },
    { x: 55, y: 55 }, { x: 58, y: 57 }, { x: 60, y: 59 },
    // --- 近畿/关西 ---
    { x: 52, y: 56 }, { x: 55, y: 58 },
    { x: 49, y: 57 }, { x: 52, y: 59 }, { x: 55, y: 61 },
    { x: 47, y: 59 }, { x: 50, y: 61 },
    // --- 中国/四国 ---
    { x: 41, y: 59 }, { x: 44, y: 60 },
    { x: 38, y: 61 }, { x: 41, y: 62 }, { x: 44, y: 63 },
    { x: 43, y: 66 }, { x: 46, y: 67 }, // 四国
    // --- 九州 ---
    { x: 31, y: 62 }, { x: 34, y: 63 },
    { x: 29, y: 64 }, { x: 32, y: 65 },
    { x: 28, y: 67 }, { x: 31, y: 68 },
    { x: 29, y: 71 }, { x: 31, y: 73 },
    // --- 冲绳 ---
    { x: 10, y: 80 }, { x: 13, y: 81 }, { x: 9, y: 83 }, { x: 12, y: 84 }
];

// City Callout Data
const CITY_CALLOUTS: CityCallout[] = [
    { name: "Sapporo", x1: 79, y1: 12, x2: 92, y2: 12, align: "start", labelSC: "札幌", labelTC: "札幌" },
    { name: "Tokyo", x1: 66, y1: 48, x2: 88, y2: 48, align: "start", labelSC: "东京", labelTC: "東京" },
    { name: "Osaka", x1: 52, y1: 58, x2: 32, y2: 52, align: "end", labelSC: "大阪", labelTC: "大阪" },
    { name: "Fukuoka", x1: 30, y1: 65, x2: 12, y2: 65, align: "end", labelSC: "福冈", labelTC: "福岡" }
];

export default function EarthquakeView() {
    const { settings } = useTheme();
    const [data, setData] = useState<QuakeData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchQuakes() {
            try {
                const res = await fetch("https://api.p2pquake.net/v2/history?codes=551&limit=20");
                const json = await res.json();
                const filtered = json.filter((q: QuakeData) =>
                    q.earthquake.hypocenter.magnitude >= 3.0
                );
                setData(filtered);
            } catch (error) {
                console.error("Failed to fetch quakes:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchQuakes();
    }, []);

    const majorAlert = data.find(q => {
        const timeDiff = new Date().getTime() - new Date(q.earthquake.time).getTime();
        const isRecent = timeDiff < 24 * 60 * 60 * 1000;
        const isBig = q.earthquake.maxScale >= 45 || q.earthquake.hypocenter.magnitude >= 6.0;
        return isRecent && isBig;
    });

    const getMagColor = (magnitude: number) => {
        if (magnitude >= 6.0) return "text-red-500 font-bold";
        if (magnitude >= 4.0) return "text-orange-500 font-bold";
        return "text-yellow-500 font-bold";
    };

    // Projection Logic (Lat/Lon -> 0-100)
    const project = (lat: number, lon: number) => {
        const latMin = 24;
        const latMax = 46;
        const lonMin = 122;
        const lonMax = 148;

        const xPct = (lon - lonMin) / (lonMax - lonMin);
        const yPct = 1 - (lat - latMin) / (latMax - latMin);

        return {
            x: xPct * 100,
            y: yPct * 100
        };
    };

    // Identify Primary Quake (Largest Magnitude or Newest if equal)
    const primaryQuake = data.length > 0 ? data.reduce((prev, current) => {
        return (prev.earthquake.hypocenter.magnitude > current.earthquake.hypocenter.magnitude) ? prev : current;
    }, data[0]) : null;

    // However, user said "Newest OR Largest". Often newest is index 0. 
    // If there is a major alert, that should be primary.
    // Let's settle on: If Major Alert exists, use that. Otherwise use the Newest (Index 0).
    const mainFocusQuake = majorAlert || data[0];

    return (
        <div className="flex flex-col gap-6">

            {/* Abstract Dot Map Container with HUD */}
            <div className="luxury-card relative aspect-[16/10] w-full bg-slate-50 rounded-[32px] overflow-hidden shadow-inner">

                {/* HUD Status Bar (Top Left) */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md border border-gray-100 dark:border-white/10 shadow-sm">
                    <div className={`w-2 h-2 rounded-full ${majorAlert ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                        {majorAlert
                            ? (settings.lang === "sc" ? "地震警报生效中" : "地震警報生效中")
                            : (settings.lang === "sc" ? "当前无重大警报" : "當前無重大警報")
                        }
                    </span>
                </div>

                <svg viewBox="0 5 100 85" className="w-full h-full p-2 pointer-events-none">

                    {/* Layer 1: City Labels (Callouts) */}
                    <g id="city-labels">
                        {CITY_CALLOUTS.map((city, i) => (
                            <g key={i}>
                                <line
                                    x1={city.x1} y1={city.y1}
                                    x2={city.x2} y2={city.y2}
                                    className="stroke-gray-300 dark:stroke-gray-600"
                                    strokeWidth="0.5"
                                />
                                <circle
                                    cx={city.x1} cy={city.y1} r="0.8"
                                    className="fill-gray-300 dark:fill-gray-600"
                                />
                                <text
                                    x={city.align === 'start' ? city.x2 + 2 : city.x2 - 2}
                                    y={city.y2 + 1}
                                    textAnchor={city.align}
                                    className="fill-gray-400 dark:fill-gray-500 text-[3px] font-sans"
                                    alignmentBaseline="middle"
                                >
                                    {settings.lang === "sc" ? city.labelSC : city.labelTC}
                                </text>
                            </g>
                        ))}
                    </g>

                    {/* Layer 2: Map Dots */}
                    <g id="map-dots">
                        {JAPAN_DOTS.map((dot, i) => (
                            <circle
                                key={i}
                                cx={dot.x}
                                cy={dot.y}
                                r="1"
                                className="fill-gray-300 dark:fill-white/10"
                            />
                        ))}
                    </g>

                    {/* Layer 3: Epicenters - Visual Hierarchy applied */}
                    <g id="epicenter">
                        {data.slice(0, 10).map(q => {
                            const { x, y } = project(q.earthquake.hypocenter.latitude, q.earthquake.hypocenter.longitude);
                            const isMain = mainFocusQuake && q.id === mainFocusQuake.id;

                            // Render Logic
                            if (isMain) {
                                return (
                                    <g key={q.id}>
                                        {/* Main: Red Halo + Red Core + Pulse */}
                                        <circle cx={x} cy={y} r="3" className="fill-red-500 animate-pulse opacity-30" />
                                        <circle cx={x} cy={y} r="1.5" className="fill-red-600" />
                                    </g>
                                );
                            } else {
                                return (
                                    <g key={q.id}>
                                        {/* Secondary: Orange, Smaller, Transparent, No Pulse */}
                                        <circle cx={x} cy={y} r="1.2" className="fill-orange-300 dark:fill-orange-400 opacity-60" />
                                    </g>
                                );
                            }
                        })}
                    </g>
                </svg>

                <div className="absolute bottom-3 right-5 text-[10px] text-gray-400 font-mono opacity-60">
                    P2P Quake
                </div>
            </div>

            {/* 3. Compact Recent List - Top 10 */}
            <div className="luxury-card rounded-2xl bg-white overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {settings.lang === "sc" ? "地震记录" : "地震記錄"}
                    </h3>
                    <span className="text-[10px] text-gray-400">Recent 10</span>
                </div>

                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="py-8 text-center text-xs text-gray-400">Loading data...</div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-white/5">
                            {data.slice(0, 10).map((q) => (
                                <div key={q.id} className="flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <span className="text-xs font-mono text-gray-400 w-12 shrink-0">
                                        {q.earthquake.time.split(' ')[1].substring(0, 5)}
                                    </span>
                                    <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200 truncate px-2">
                                        {q.earthquake.hypocenter.name}
                                    </span>
                                    <span className={`text-xs w-10 text-right ${getMagColor(q.earthquake.hypocenter.magnitude)}`}>
                                        M{q.earthquake.hypocenter.magnitude.toFixed(1)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background-color: rgba(156, 163, 175, 0.3);
                  border-radius: 9999px;
                }
            `}</style>
        </div>
    );
}
