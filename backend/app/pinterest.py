"""Pinterest → seyo: a pin link the user pasted becomes a reference photo.

No searching here: the user finds a pin in Pinterest, copies its link, and pastes it into seyo.
The server asks Pinterest's public oEmbed endpoint (the one link previews use) for that pin's
image and returns it as a data URL the app attaches like any photo (a design reference by default).

Only Pinterest hosts are ever fetched (the pin page, its short links, its image CDN), redirects
included, so this can't be used to make the server fetch arbitrary URLs.
"""

import base64
import re
from urllib.parse import urlparse

import httpx

PAGE_HOSTS = re.compile(r"^(?:[a-z]{2,3}\.)?(?:www\.)?pinterest\.(?:com|co\.kr|co\.uk|ca|fr|de|jp|com\.au)$|^pin\.it$")
IMAGE_HOSTS = re.compile(r"^i\.pinimg\.com$")
LINK = re.compile(r"https?://(?:[a-z]{2,3}\.)?(?:www\.)?(?:pinterest\.[a-z.]{2,6}/pin/[\w-]+|pin\.it/[\w-]+)/?", re.I)
MAX_BYTES = 1_000_000
UA = "Mozilla/5.0 (compatible; seyo-preview/1.0)"


class PinError(Exception):
    """Message is shown to the user as-is."""


def find_link(text: str) -> str | None:
    m = LINK.search(text or "")
    return m.group(0) if m else None


def _host_ok(url: str, hosts: re.Pattern) -> bool:
    u = urlparse(url)
    return u.scheme == "https" and bool(u.hostname) and bool(hosts.match(u.hostname.lower()))


async def _get(client: httpx.AsyncClient, url: str, hosts: re.Pattern) -> httpx.Response:
    """GET following redirects by hand, every hop checked against `hosts`."""
    for _ in range(5):
        if not _host_ok(url, hosts):
            raise PinError("핀터레스트 링크만 가져올 수 있어요")
        r = await client.get(url, follow_redirects=False)
        if r.is_redirect and r.headers.get("location"):
            url = str(r.next_request.url) if r.next_request else r.headers["location"]
            continue
        return r
    raise PinError("링크를 열 수 없어요")


OEMBED = "https://www.pinterest.com/oembed.json"
_PIN_ID = re.compile(r"/pin/(?:[\w-]*?-)?(\d{6,})")


async def _canonical(client: httpx.AsyncClient, url: str) -> str:
    """Any pin link (country domains, slugs, pin.it short links) → https://www.pinterest.com/pin/<id>/,
    the form Pinterest's oEmbed accepts. Short links are resolved hop by hop (Pinterest hosts only)."""
    m = _PIN_ID.search(urlparse(url).path)
    if not m and urlparse(url).hostname == "pin.it":
        for _ in range(5):
            r = await _get_once(client, url, PAGE_HOSTS)
            if not (r.is_redirect and r.headers.get("location")):
                break
            url = str(r.next_request.url) if r.next_request else r.headers["location"]
            m = _PIN_ID.search(urlparse(url).path)
            if m:
                break
    if not m:
        raise PinError("핀 링크를 알아보지 못했어요. 핀 화면에서 링크를 다시 복사해 주세요")
    return f"https://www.pinterest.com/pin/{m.group(1)}/"


async def _get_once(client: httpx.AsyncClient, url: str, hosts: re.Pattern) -> httpx.Response:
    if not _host_ok(url, hosts):
        raise PinError("핀터레스트 링크만 가져올 수 있어요")
    return await client.get(url, follow_redirects=False)


async def pin_image(url: str) -> str:
    """A pin link → its image as a data URL, through Pinterest's official oEmbed endpoint."""
    url = url.strip().replace("http://", "https://", 1)
    if not _host_ok(url, PAGE_HOSTS):
        raise PinError("핀터레스트 링크만 가져올 수 있어요")
    async with httpx.AsyncClient(timeout=10, headers={"User-Agent": UA}) as client:
        pin = await _canonical(client, url)
        r = await client.get(OEMBED, params={"url": pin})
        if r.status_code != 200:
            raise PinError("핀을 찾을 수 없어요. 비공개 핀이거나 지워졌을 수 있어요")
        thumb = (r.json() or {}).get("thumbnail_url") or ""
        if not _host_ok(thumb, IMAGE_HOSTS):
            raise PinError("이 핀에서 이미지를 찾지 못했어요. 이미지를 복사해서 붙여넣어 주세요")
        # oEmbed hands out the 236px thumbnail; the same image comes in 736px for a usable reference
        img = None
        for size_url in (re.sub(r"/236x/", "/736x/", thumb), thumb):
            got = await _get(client, size_url, IMAGE_HOSTS)
            if got.status_code == 200:
                img = got
                break
        kind = img.headers.get("content-type", "").split(";")[0] if img else ""
        if not img or not kind.startswith("image/"):
            raise PinError("이미지를 가져오지 못했어요")
        if len(img.content) > MAX_BYTES:
            raise PinError("이미지가 너무 커요. 이미지를 복사해서 붙여넣어 주세요")
        return f"data:{kind};base64,{base64.b64encode(img.content).decode()}"
