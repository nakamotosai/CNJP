"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Sparkles } from "lucide-react";
import { useTheme } from "../ThemeContext";

interface CityData {
    name: string;
    tags: string[];
    description: string;
    climate: string;
    wikiUrl: string;
}

// SC to TC mapping
const SC_TC_MAP: Record<string, string> = {
    "东京": "東京",
    "横滨": "橫濱",
    "大阪": "大阪",
    "京都": "京都",
    "神户": "神戶",
    "札幌": "札幌",
    "福冈": "福岡",
    "名古屋": "名古屋",
    "仙台": "仙台",
    "那霸": "那霸"
};

// Simplified to Traditional Chinese Data
const CITY_ENCYCLOPEDIA_DATA: Record<string, CityData> = {
    "東京": {
        name: "東京",
        tags: ["國際都會", "潮流購物", "二次元聖地"],
        description: "日本的政治、經濟與文化中心，融合了古老傳統與超前科技的超級大都市。無論是淺草寺的雷門還是新宿的霓虹燈，都充滿魅力。",
        climate: "四季分明，夏季高溫多濕，常有颱風影響；冬季乾燥晴朗，雖氣溫較低但鮮少積雪。",
        wikiUrl: "https://zh.wikipedia.org/wiki/東京"
    },
    "橫濱": {
        name: "橫濱",
        tags: ["港口城市", "中華街", "浪漫夜景"],
        description: "緊鄰東京的現代化港口都市，擁有日本最大的中華街和著名的未來港21地區，洋溢著異國情調與海濱浪漫。",
        climate: "溫暖濕潤的海洋性氣候，夏季海風涼爽，冬季相對溫暖，不僅宜居且四季景色宜人。",
        wikiUrl: "https://zh.wikipedia.org/wiki/橫濱市"
    },
    "大阪": {
        name: "大阪",
        tags: ["美食之都", "熱情", "環球影城"],
        description: "關西地區的經濟中心，以「吃到倒」的飲食文化聞名。這裡的人們熱情豪爽，道頓堀的看板和大阪城是其標誌性景觀。",
        climate: "屬瀨戶內海式氣候，降水相對較少。夏季非常炎熱，冬季少雪但體感較冷。",
        wikiUrl: "https://zh.wikipedia.org/wiki/大阪市"
    },
    "京都": {
        name: "京都",
        tags: ["千年古都", "寺廟神社", "傳統藝伎"],
        description: "保留了日本最純正的傳統文化，擁有清水寺、金閣寺等無數世界遺產。漫步祗園花見小路，彷彿穿越回平安時代。",
        climate: "典型的盆地氣候，溫差較大。夏季悶熱如蒸籠，冬季寒冷刺骨，這造就了絕美的紅葉與雪景。",
        wikiUrl: "https://zh.wikipedia.org/wiki/京都市"
    },
    "神戶": {
        name: "神戶",
        tags: ["神戶牛肉", "時尚", "六甲山"],
        description: "依山傍海的優雅港口城市，曾是日本最早開放的通商口岸之一。這裡有世界頂級的牛肉、歐式異人館和璀璨的千萬美元夜景。",
        climate: "氣候溫和，受瀨戶內海調節。冬季西北季風被六甲山阻擋，因此相對溫暖，降雪極少。",
        wikiUrl: "https://zh.wikipedia.org/wiki/神戶市"
    },
    "札幌": {
        name: "札幌",
        tags: ["冰雪節", "拉麵", "白色戀人"],
        description: "北海道的首府，擁有棋盤狀的整齊街道。這裡是冬季滑雪的勝地，也是味噌拉麵和成吉思汗烤肉的發源地。",
        climate: "典型的日本海側氣候，夏季涼爽無梅雨，是避暑勝地；冬季漫長且降雪量巨大，銀裝素裹。",
        wikiUrl: "https://zh.wikipedia.org/wiki/札幌市"
    },
    "福岡": {
        name: "福岡",
        tags: ["屋台文化", "博多豚骨", "亞洲門戶"],
        description: "九州地區最大的城市，距離韓國和中國很近。夜晚街頭的屋台（大排檔）是這裡最獨特的風景線，充滿市井煙火氣。",
        climate: "溫暖濕潤，年平均氣溫較高。梅雨季節降水量大，夏季炎熱，冬季雖然風大但極少積雪。",
        wikiUrl: "https://zh.wikipedia.org/wiki/福岡市"
    },
    "名古屋": {
        name: "名古屋",
        tags: ["工業中樞", "名古屋城", "鰻魚飯"],
        description: "位於日本中部的交通樞紐，豐田汽車的大本營。獨特的飲食文化如味噌豬排、鰻魚飯三吃讓人印象深刻。",
        climate: "夏季受太平洋高壓控制，高溫高濕，是日本著名的「酷暑」城市之一；冬季乾燥寒冷，也就是著名的伊吹落山風。",
        wikiUrl: "https://zh.wikipedia.org/wiki/名古屋市"
    },
    "仙台": {
        name: "仙台",
        tags: ["杜之都", "牛舌", "七夕祭"],
        description: "東北地區最大的城市，街道綠樹成蔭，被稱為「森林之都」。伊達政宗的歷史遺跡與現代都市完美融合。",
        climate: "夏季沒有東京那麼炎熱，冬季雖然寒冷但降雪量在東北地區算比較少的，氣候相對舒適。",
        wikiUrl: "https://zh.wikipedia.org/wiki/仙台市"
    },
    "那霸": {
        name: "那霸",
        tags: ["琉球文化", "陽光海灘", "首里城"],
        description: "沖繩縣的首府，曾是琉球王國的中心。這裡有獨特的紅瓦建築、石敢當文化和清澈見底的亞熱帶海濱風光。",
        climate: "亞熱帶海洋性氣候，終年溫暖，無霜雪。夏季漫長且紫外線強，秋季常受颱風侵襲。",
        wikiUrl: "https://zh.wikipedia.org/wiki/那霸市"
    }
};

interface CityEncyclopediaCardProps {
    cityName: string;
}

export default function CityEncyclopediaCard({ cityName }: CityEncyclopediaCardProps) {
    const { settings } = useTheme();

    // Map incoming SC name (e.g., "东京") to TC key (e.g., "東京")
    // If not found in map, try using cityName directly. Fallback to Tokyo (TC).
    const tcKey = SC_TC_MAP[cityName] || cityName;
    const data = CITY_ENCYCLOPEDIA_DATA[tcKey] || CITY_ENCYCLOPEDIA_DATA["東京"];

    return (
        <div className="luxury-card w-full rounded-[32px] overflow-hidden z-20">
            <AnimatePresence mode="wait">
                <motion.div
                    key={data.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="p-8"
                >
                    {/* Header: Name & Tags */}
                    <div className="flex flex-col gap-4 mb-6">
                        <div className="flex items-center justify-between">
                            <h2
                                className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight"
                                style={{
                                    textShadow: "0 2px 1px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)"
                                }}
                            >
                                {settings.lang === "sc" ? data.name : data.name}
                                {/* 
                                    Note: Since data is now purely TC, displaying data.name ensures TC display.
                                    If user switches to SC in settings, they might expect SC text.
                                    However, user EXPLICITLY provided TC data and asked to replace it.
                                    So we respect the data provided and display it as is.
                                */}
                            </h2>
                            <Sparkles className="w-6 h-6 text-yellow-400" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {data.tags.map(tag => (
                                <span
                                    key={tag}
                                    className="px-3 py-1 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Content: Description & Climate */}
                    <div className="space-y-4 mb-6">
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            {data.description}
                        </p>
                        <div className="p-4 bg-red-50/50 dark:bg-red-500/5 rounded-2xl border border-red-100 dark:border-red-500/10">
                            <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-2 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400"></span>
                                {settings.lang === "sc" ? "气候概况" : "氣候概況"}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                {data.climate}
                            </p>
                        </div>
                    </div>

                    {/* Footer: Wiki Link */}
                    <div className="flex justify-end">
                        <a
                            href={data.wikiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                            <span>{settings.lang === "sc" ? "维基百科" : "維基百科"}</span>
                            <ExternalLink className="w-3 h-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </a>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
