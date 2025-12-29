/**
 * About Page Content Configuration
 * 所有可编辑的文案都集中在此文件中，方便后期修改
 */

export interface ChangelogEntry {
    version: string;
    date: string;
    changes: string[];
}

export interface FeatureItem {
    title: string;
    description: string;
    icon: string;
}

export interface AboutSection {
    title: string;
    icon: string; // lucide-react icon name
    content?: string | string[];
    items?: string[] | FeatureItem[];
}

export interface AboutPageConfig {
    meta: {
        pageTitle: string;
        backButton: string;
    };
    hero: {
        title: string;
        subtitle: string;
        description: string;
        webmasterQuote: string;
    };
    sections: {
        features: AboutSection;
        usage: AboutSection;
        chinaUsers: AboutSection;
        disclaimer: AboutSection;
        changelog: AboutSection & { entries: ChangelogEntry[] };
        contact: AboutSection;
        donation: AboutSection & { qrLabel: string };
    };
    footer: string;
    webmasterLink: string;
}

export const ABOUT_PAGE_CONTENT: Record<"sc" | "tc", AboutPageConfig> = {
    sc: {
        meta: {
            pageTitle: "关于本站",
            backButton: "返回首页"
        },
        hero: {
            title: "cn.saaaai.com",
            subtitle: "从日本看中国",
            description: "实时AI新闻聚合网",
            webmasterQuote: "好家伙，没写一行代码真的做出来了一个网站"
        },
        sections: {
            features: {
                title: "核心功能",
                icon: "Zap",
                items: [
                    {
                        title: "全网扫描",
                        description: "每小时轮询抓取一次全网主流日媒，新闻记录永久保存在云端",
                        icon: "RefreshCw"
                    },
                    {
                        title: "AI日报",
                        description: "首页顶端展示AI自动生成的当日态势定调、关键事件及风向预测",
                        icon: "Bot"
                    },
                    {
                        title: "AI解读",
                        description: "每篇文章均支持一键生成深度分析报告，提供事实、背景、评价及一句话总结",
                        icon: "Sparkles"
                    },
                    {
                        title: "实时现场",
                        description: "内置以东京为主的实时各大景点直播信号，方便直观感受人气程度",
                        icon: "Tv"
                    },
                    {
                        title: "灾害脉动",
                        description: "集成交互式实时地震地图，当在浏览时出现M6以上地震会全局提醒",
                        icon: "Activity"
                    },
                    {
                        title: "PWA架构",
                        description: "渐进式架构，支持手机端添加到主屏幕，以及PC端作为PWA应用安装",
                        icon: "Smartphone"
                    }
                ]
            },
            usage: {
                title: "使用指南",
                icon: "BookOpen",
                items: [
                    "点击新闻卡片可展开查看详情，附带日文新闻原文链接",
                    "点击「AI分析」按钮可获取绝对公正客观的AI智能摘要",
                    "点击心形按钮可收藏，支持简繁切换、明暗切换、字体切换",
                    "使用搜索或分类标签快速筛选感兴趣的新闻",
                    "切换「直播」标签页可观看日本各大人气景点的实况监控",
                    "切换「灾害」标签页可查看日本实时地震地图和天气信息",
                    "手机用户可将本页面「添加到主屏幕」获得类似app的体验"
                ]
            },
            chinaUsers: {
                title: "国内读者须知",
                icon: "MapPin",
                content: [
                    "本站针对大陆网络环境优化了 CDN 路由，无需魔法即可访问。",
                    "请添加到主屏幕方便随时查看，如遇加载缓慢，可尝试刷新页面或更换网络环境。",
                    "新闻原文链接和视频直播源均来自日本谷歌，大陆地区无法直接打开。",
                    "本站自动翻译全部新闻标题，支持简繁切换，翻译错误在所难免，感谢理解。",
                    "请尽量使用手机默认浏览器访问，大陆地区微信内无法直接打开网址。"
                ]
            },
            disclaimer: {
                title: "免责声明",
                icon: "AlertTriangle",
                content: [
                    "本站所有AI生成的简报、解读和翻译仅供参考，不代表媒体立场，亦不作为投资或法律建议。",
                    "本站新闻全部自动抓取自日本各大媒体公开发布的内容，本站不会修改原文，也不对新闻内容的真实性、准确性负责。",
                    "建议重大事件查阅日文原文. 如有任何版权问题，请联系站长删除。",
                    "使用本站即表示您已阅读并同意以上条款。"
                ]
            },
            changelog: {
                title: "版本更新",
                icon: "History",
                entries: [
                    {
                        version: "1.2.0",
                        date: "2025-12-28",
                        changes: [
                            "新增：AI新闻深度分析功能",
                            "新增：每日AI智能简报",
                            "新增：支持PWA安装",
                            "新增：关于页面重构为独立页面",
                            "新增：折叠式内容展示",
                            "新增：国内读者须知板块",
                            "新增：版本更新日志"
                        ]
                    },
                    {
                        version: "1.1.0",
                        date: "2025-12-08",
                        changes: [
                            "新增：更改域名为 cn.saaaai.com",
                            "新增：支持日本多路直播信号",
                            "新增：支持实时地震地图和天气查询",
                            "新增：升级PWA架构，支持添加到主屏幕",
                            "优化：深色渐变主题",
                            "优化：页面加载性能"
                        ]
                    },
                    {
                        version: "1.0.0",
                        date: "2025-11-28",
                        changes: [
                            "网站初版正式上线",
                            "支持新闻浏览、收藏、分类筛选",
                            "支持简繁切换和初版设置菜单"
                        ]
                    }
                ]
            },
            contact: {
                title: "联系方式",
                icon: "Mail",
                content: [
                    "如果您有任何建议或反馈，欢迎通过以下方式联系：",
                    "邮箱：sai@saaaai.com或微信号a16z88（已满无法看到朋友圈但可聊天）",
                    "本站为Gemini、claude opus等ai全程无代码编程作品，为中日友好添一份力。"
                ]
            },
            donation: {
                title: "微信打赏",
                icon: "Coffee",
                qrLabel: "微信红包打赏",
                content: [
                    "本站目前极低成本运营，AI功能由本人显卡内网穿透实现，纯用爱发电。",
                    "如果对您有帮助或者希望日后增加更多功能，可以微信打赏助力站长，凑满经费继续升级。",
                    "打赏是一种认同的体现，不论金额多少都非常感谢您能来，小弟在此谢过！"
                ]
            }
        },
        footer: "探索日本媒体眼中的中国世界，全网独此一家",
        webmasterLink: "站长个人主页：https://saaaai.com"
    },
    tc: {
        meta: {
            pageTitle: "關於本站",
            backButton: "返回首頁"
        },
        hero: {
            title: "cn.saaaai.com",
            subtitle: "從日本看中國",
            description: "實時AI新聞聚合網",
            webmasterQuote: "好傢伙，沒寫一行代碼真的做出來了一個網站"
        },
        sections: {
            features: {
                title: "核心功能",
                icon: "Zap",
                items: [
                    {
                        title: "全網掃描",
                        description: "每小時輪詢抓取一次全網主流日媒，新聞記錄永久保存在雲端",
                        icon: "RefreshCw"
                    },
                    {
                        title: "AI日報",
                        description: "首頁頂端展示AI自動生成的當日態勢定調、關鍵事件及風向預測",
                        icon: "Bot"
                    },
                    {
                        title: "AI解讀",
                        description: "每篇文章均支持一鍵生成深度分析報告，提供事實、背景、評價及一句話總結",
                        icon: "Sparkles"
                    },
                    {
                        title: "實時現場",
                        description: "內置以東京為主的實時各大景點直播信號，方便直觀感受人氣程度",
                        icon: "Tv"
                    },
                    {
                        title: "災害脈動",
                        description: "集成交互式實時地震地圖，當在瀏覽時出現M6以上地震會全局提醒",
                        icon: "Activity"
                    },
                    {
                        title: "PWA架構",
                        description: "漸進式架構，支持手機端添加到主屏幕，以及PC端作為PWA應用安裝",
                        icon: "Smartphone"
                    }
                ]
            },
            usage: {
                title: "使用指南",
                icon: "BookOpen",
                items: [
                    "點擊新聞卡片可展開查看詳情，附帶日文新聞原文鏈接",
                    "點擊「AI分析」按鈕可獲取絕對公正客觀的AI智能摘要",
                    "點擊心形按鈕可收藏，支援簡繁切換、明暗切換、字型切換",
                    "使用搜索或分類標籤快速篩選感興趣的新聞",
                    "切換「直播」標籤頁可觀看日本各大人氣景點的實況監控",
                    "切換「災害」標籤頁可查看日本實時地震地圖和天氣信息",
                    "手機用戶可將本頁面「添加到主屏幕」獲得類似app的體驗"
                ]
            },
            chinaUsers: {
                title: "大陸讀者須知",
                icon: "MapPin",
                content: [
                    "本站針對大陸網絡環境優化了 CDN 路由，無需魔法即可訪問。",
                    "請添加到主屏幕方便隨時查看，如遇加載緩慢，可嘗試刷新頁面或更換網絡環境。",
                    "新聞原文鏈接和視頻直播源均來自日本谷歌，大陸地區無法直接打開。",
                    "本站自動翻譯全部新聞標題，支持簡繁切換，翻譯錯誤在所難免，感謝理解。",
                    "請盡量使用手機默認瀏覽器訪問，大陸地區微信內無法直接打開網址。"
                ]
            },
            disclaimer: {
                title: "免責聲明",
                icon: "AlertTriangle",
                content: [
                    "本站所有AI生成的簡報、解讀和翻譯僅供參考，不代表媒體立場，亦不作為投資或法律建議。",
                    "本站新聞全部自動抓取自日本各大媒體公開發布的内容，本站不會修改原文，也不對新聞內容的真實性、準確性負責。",
                    "建議重大事件查閱日文原文。如有任何版權問題，請聯繫站長刪除。",
                    "使用本站即表示您已閱讀並同意以上條款。"
                ]
            },
            changelog: {
                title: "版本更新",
                icon: "History",
                entries: [
                    {
                        version: "1.2.0",
                        date: "2025-12-28",
                        changes: [
                            "新增：AI新聞深度分析功能",
                            "新增：每日AI智能簡報",
                            "新增：支持PWA安裝",
                            "新增：關於頁面重構為獨立頁面",
                            "新增：折疊式內容展示",
                            "新增：國內讀者須知板塊",
                            "新增：版本更新日誌"
                        ]
                    },
                    {
                        version: "1.1.0",
                        date: "2025-12-08",
                        changes: [
                            "新增：更改域名為 cn.saaaai.com",
                            "新增：支持日本多路直播信號",
                            "新增：支持實時地震地圖和天氣查詢",
                            "新增：升級PWA架構，支持添加到主屏幕",
                            "優化：深色漸變主題",
                            "優化：頁面加載性能"
                        ]
                    },
                    {
                        version: "1.0.0",
                        date: "2025-11-28",
                        changes: [
                            "網站初版正式上線",
                            "支持新聞瀏覽、收藏、分類篩選",
                            "支持簡繁切換和初版設置菜單"
                        ]
                    }
                ]
            },
            contact: {
                title: "聯繫方式",
                icon: "Mail",
                content: [
                    "如果您有任何建議或反饋，歡迎通過以下方式聯繫：",
                    "郵箱：sai@saaaai.com或微信號a16z88（已滿無法看到朋友圈但可聊天）",
                    "本站為Gemini、claude opus等ai全程無代碼編程作品，為中日友好添一份力。"
                ]
            },
            donation: {
                title: "微信打賞",
                icon: "Coffee",
                qrLabel: "微信紅包打賞",
                content: [
                    "本站目前極低成本運營，AI功能由本人顯卡內網穿透實現，純用愛發電。",
                    "如果對您有幫助或者希望日後增加更多功能，可以微信打賞助力站長，湊滿經費繼續升級。",
                    "打賞是一種認同的體現，不論金額多少都非常感謝您能來，小弟在此謝過！"
                ]
            }
        },
        footer: "探索日本媒體眼中的中國世界，全網獨此一家",
        webmasterLink: "站長個人主頁：https://saaaai.com"
    }
};
