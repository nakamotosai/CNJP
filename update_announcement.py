import re

# Read the HTML file
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the old announcement text pattern (to be safe)
old_pattern = r'''                <p>专注聚合<b>日本媒体眼中的中国新闻</b>。首页实时展示<b>近3天</b>的报道，超过3天的历史新闻会收录进存档永久保存。</p>\r?\n                <p><b>本网站会每一个小时自动抓取一次数据。</b></p>\r?\n                <p>目前是试运营状态，如果你对这些新闻感兴趣，请把本网页添加到手机主屏幕上。</p>'''

# Define the new announcement text
new_text = '''                <p>由于中日两国新闻存在巨大矛盾和争议，因此本网站专注聚合日本媒体发布的中国新闻，尽力消除信息差。每一个小时自动抓取一次日本谷歌新闻中包含"中国"关键字的实时数据，首页展示近3天的记录，超过3天的历史新闻会收录进存档永久保存。经测试目前国内访问没有问题。</p>
                <p>本网站全程由Gemini制作，部署在cloudflare上，目前试运营状态，还在持续更新优化中。如果你对这些新闻感兴趣，请把本网页添加到手机主屏幕上（用手机自带浏览器按分享后添加到主屏幕上即可）。</p>
                <p style="font-size: 12px; color: #999; margin-top: 10px;">*因技术原因，网站开通前的历史数据无法抓取，尽请谅解。</p>'''

# Replace
content = re.sub(old_pattern, new_text, content)

# Write back
with open('index.html', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content)

print("Announcement updated successfully!")
