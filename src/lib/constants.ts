export const CATEGORIES = [
    { key: "all", label: "全部", color: "all" },
    { key: "politics", label: "时政", color: "politics" },
    { key: "economy", label: "经济", color: "economy" },
    { key: "society", label: "社会", color: "society" },
    { key: "military", label: "军事", color: "military" },
    { key: "tech", label: "科技", color: "tech" },
    { key: "sports", label: "体育", color: "sports" },
    { key: "other", label: "其他", color: "other" },
] as const;

export type CategoryKey = typeof CATEGORIES[number]["key"];

export const CATEGORY_MAP: Record<string, string> = {
    '时政': 'politics', '政治': 'politics',
    '经济': 'economy',
    '社会': 'society',
    '军事': 'military',
    '科技': 'tech', 'IT': 'tech',
    '体育': 'sports',
    '其他': 'other'
};

export const MEDIA_LOGOS: Record<string, string> = {
    "NHK": "https://www3.nhk.or.jp/favicon.ico",
    "Yahoo": "https://s.yimg.jp/c/icon/s/bsc/2.0/favicon.ico",
    "共同": "https://www.kyodo.co.jp/favicon.ico",
    "共同通信": "https://www.kyodo.co.jp/favicon.ico",
    "朝日": "https://www.asahi.com/favicon.ico",
    "読売": "https://www.yomiuri.co.jp/favicon.ico",
    "每日": "https://mainichi.jp/favicon.ico",
    "毎日": "https://mainichi.jp/favicon.ico",
    "日経": "https://www.nikkei.com/favicon.ico",
    "产经": "https://www.sankei.com/favicon.ico",
    "産経": "https://www.sankei.com/favicon.ico",
    "时事": "https://www.jiji.com/favicon.ico",
    "TBS": "https://news.tbs.co.jp/favicon.ico",
    "FNN": "https://www.fnn.jp/favicon.ico",
    "Bloomberg": "https://assets.bloomberg.com/static/images/favicon.ico",
    "CNN": "https://cnn.co.jp/favicon.ico",
    "Reuters": "https://www.reuters.com/favicon.ico",
    "路透": "https://www.reuters.com/favicon.ico",
    "BBC": "https://www.bbc.com/favicon.ico",
    "Record China": "https://d36u79445858l5.cloudfront.net/static/img/favicon.ico",
    "東洋経済": "https://toyokeizai.net/favicon.ico",
    "JBpress": "https://jbpress.ismedia.jp/favicon.ico"
};
