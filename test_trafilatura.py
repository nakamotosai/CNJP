import trafilatura

url = "https://news.google.com/rss/articles/CBMif0FVX3lxTE1RRWJ5RzBNVWQwNzBKdEhUbmhRZ3p3OVN1MVZkQzBxOF9lLWJnMk5uZE5hRUJLMGJNbVdfN08xN24zY3VzY2laOE9CdVRlZ0lhLTdoQV8tTkVBV1ItQ0d2WVdGYjdCQWhTSWhJXzhmODRYV1FxSEdXSllkZ0UwUQ?oc=5"
print(f"Testing fetching URL directly with trafilatura: {url}")
downloaded = trafilatura.fetch_url(url)
if downloaded:
    print("Fetch successful!")
    content = trafilatura.extract(downloaded)
    print(f"Extracted content length: {len(content) if content else 0}")
    print(f"Content preview: {content[:100] if content else 'None'}")
else:
    print("Fetch failed.")
