"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudSun, Activity, AlertTriangle } from "lucide-react";
import { useTheme } from "../ThemeContext";
import WeatherView from "./WeatherView";
import EarthquakeView from "./EarthquakeView";
import OtherDisasterView from "./OtherDisasterView";
import CityEncyclopediaCard from "./CityEncyclopediaCard";

type SubTab = 'weather' | 'earthquake' | 'other';

export default function DisasterSection() {
    const { settings } = useTheme();
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('weather');
    const [currentCity, setCurrentCity] = useState("东京");

    return (
        <div className="w-full">
            {/* Sub-Navigation */}
            <nav className="flex items-center gap-3 px-4 py-2 overflow-x-auto scrollbar-hide">
                <NavButton
                    isActive={activeSubTab === 'weather'}
                    onClick={() => setActiveSubTab('weather')}
                    icon={<CloudSun className="w-4 h-4" />}
                    label={settings.lang === "sc" ? "天气" : "天氣"}
                    color="text-orange-500"
                />
                <NavButton
                    isActive={activeSubTab === 'earthquake'}
                    onClick={() => setActiveSubTab('earthquake')}
                    icon={<Activity className="w-4 h-4" />}
                    label={settings.lang === "sc" ? "地震" : "地震"}
                    color="text-red-500"
                />
                <NavButton
                    isActive={activeSubTab === 'other'}
                    onClick={() => setActiveSubTab('other')}
                    icon={<AlertTriangle className="w-4 h-4" />}
                    label={settings.lang === "sc" ? "其他" : "其他"}
                    color="text-yellow-500"
                />
            </nav>

            {/* Content Area */}
            <div className="px-4 pt-1 pb-4 min-h-[500px]">
                <AnimatePresence mode="wait">
                    {activeSubTab === 'weather' && (
                        <motion.div
                            key="weather"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <WeatherView onCityChange={setCurrentCity} />
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="mt-4"
                            >
                                <CityEncyclopediaCard cityName={currentCity} />
                            </motion.div>
                        </motion.div>
                    )}

                    {activeSubTab === 'earthquake' && (
                        <motion.div
                            key="earthquake"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <EarthquakeView />
                        </motion.div>
                    )}

                    {activeSubTab === 'other' && (
                        <motion.div
                            key="other"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <OtherDisasterView />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function NavButton({
    isActive,
    onClick,
    icon,
    label,
    color
}: {
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`
        relative flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-300
        ${isActive
                    ? "category-tag-active"
                    : "bg-transparent text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }
      `}
        >
            <span className={`${isActive ? `${color} dark:text-white` : "text-gray-400"}`}>{icon}</span>
            <span className={`text-sm font-medium ${isActive ? "text-gray-900 dark:text-white font-bold" : ""}`}>
                {label}
            </span>
            {isActive && (
                <motion.div
                    layoutId="activeSubTab"
                    className="absolute inset-0 rounded-xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0 }}
                />
            )}
        </button>
    );
}
