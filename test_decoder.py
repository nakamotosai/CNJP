from googlenewsdecoder import gnewsdecoder
import sys

url = "https://news.google.com/rss/articles/CBMif0FVX3lxTE1RRWJ5RzBNVWQwNzBKdEhUbmhRZ3p3OVN1MVZkQzBxOF9lLWJnMk5uZE5hRUJLMGJNbVdfN08xN24zY3VzY2laOE9CdVRlZ0lhLTdoQV8tTkVBV1ItQ0d2WVdGYjdCQWhTSWhJXzhmODRYV1FxSEdXSllkZ0UwUQ?oc=5"
print(f"Testing URL: {url}")
try:
    result = gnewsdecoder(url)
    print(f"Result: {result}")
except Exception as e:
    print(f"Error: {e}")
