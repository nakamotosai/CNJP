export interface AboutSection {
    title: string;
    content: string | string[];
}

export interface AboutConfig {
    hero: {
        title: string;
        subtitle: string;
        description: string;
    };
    sections: {
        origin: AboutSection;
        features: AboutSection;
        usage: AboutSection;
        contact: AboutSection;
        donation: AboutSection;
    };
    footer: string;
}

export const ABOUT_CONTENT: Record<"sc" | "tc", AboutConfig> = {
    sc: {
        hero: {
            title: "关于本站",
            subtitle: "China News From Japan",
            description: "消除信息差，连接中日桥梁。"
        },
        sections: {
            origin: {
                title: "创站初衷",
                content: [
                    "こんにちは、大家好。由于近日中日两国新闻存在矛盾和争议，必须把两边的新闻合在一起看才能获得完整的信息，因此本网站专注聚合日本媒体发布的中国相关新闻，尽力消除信息差。",
                    "对一部分人来说是对日媒的一种监督，对另一部分人来说希望能让国内家人看到真实的本土信息报个平安。一个在日华人，希望中日友好。"
                ]
            },
            features: {
                title: "本站特色",
                content: [
                    "每小时自动抓取日本谷歌新闻中包含“中国”关键字的实时数据。",
                    "不做任何修改和挑选，由爬虫自动爬取并按最新发布顺序显示。",
                    "首页展示最近 100 条记录，超出后自动转入存档永久保存。",
                    "全程由 Gemini + Antigravity 制作，处于试运营状态。"
                ]
            },
            usage: {
                title: "使用说明",
                content: [
                    "本站支持简繁切换和多种字体切换，适配手机与电脑。",
                    "由于版权问题，仅能使用机翻标题，正文部分需自行打开查阅。",
                    "建议手机用户将本页面“添加到主屏幕”，即可获得类似于 App 的全屏体验。",
                    "如本站有重大更新，将会在此页面或首页公告栏发布。"
                ]
            },
            contact: {
                title: "联系方式",
                content: "如果您有任何建议或反馈，欢迎通过邮件联系我：support@saaaai.com (示例文案)"
            },
            donation: {
                title: "支持本站",
                content: "本站目前零成本运营，连专属域名都买不起。如果您希望日后增加更多功能（如正式App、更多实用集成等），可以打个小赏凑点经费。不论金额多少，都非常感谢！これからもよろしくお願いいたします。"
            }
        },
        footer: "© 2025 从日本看中国 | China News From Japan"
    },
    tc: {
        hero: {
            title: "關於本站",
            subtitle: "China News From Japan",
            description: "消除信息差，連接中日橋樑。"
        },
        sections: {
            origin: {
                title: "創站初衷",
                content: [
                    "こんにちは、大家好。由於近日中日兩國新聞存在矛盾和爭議，必須把兩邊的新聞合在一起看才能獲得完整的信息，因此本網站專註聚合日本媒體發布的中國相關新聞，盡力消除信息差。",
                    "對一部分人來說是對日媒的一種監督，對另一部分人來說希望能讓國內家人看到真實的本土信息報個平安。一個在日華人，希望中日友好。"
                ]
            },
            features: {
                title: "本站特色",
                content: [
                    "每小時自動抓取日本谷歌新聞中包含「中國」關鍵字的實時數據。",
                    "不做任何修改和挑選，由爬蟲自動爬取並按最新發布順序顯示。",
                    "首頁展示最近 100 條記錄，超出後自動轉入存檔永久保存。",
                    "全程由 Gemini + Antigravity 製作，處於試運營狀態。"
                ]
            },
            usage: {
                title: "使用說明",
                content: [
                    "本站支持簡繁切換和多種字體切換，適配手機與電腦。",
                    "由於版權問題，僅能使用機翻標題，正文部分需自行打開查閱。",
                    "建議手機用戶將本頁面「添加到主屏幕」，即可獲得類似於 App 的全屏體驗。",
                    "如本站有重大更新，將會在此頁面或首頁公告欄發布。"
                ]
            },
            contact: {
                title: "聯繫方式",
                content: "如果您有任何建議或反饋，歡迎通過郵件聯繫我：support@saaaai.com (示例文案)"
            },
            donation: {
                title: "支持本站",
                content: "本站目前零成本運營，連專屬域名都買不起。如果您希望日後增加更多功能（如正式App、更多實用集成等），可以打個小賞湊點經費。不論金額多少，都非常感謝！これからもよろしくお願いいたします。"
            }
        },
        footer: "© 2025 從日本看中國 | China News From Japan"
    }
};
