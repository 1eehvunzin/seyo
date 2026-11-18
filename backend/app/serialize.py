import hashlib

from .models import Page, User

_FACE_COLORS = ["#F3DCEC", "#D7E5F6", "#D8E8E0", "#F6F1CC", "#EDE3F6"]


def person(u: User) -> dict:
    name = u.name or "친구"
    bg = _FACE_COLORS[int(hashlib.md5(u.id.encode()).hexdigest(), 16) % len(_FACE_COLORS)]
    return {"id": u.id, "name": name, "initial": name[0], "bg": bg}


def page_out(p: Page, viewer: User) -> dict:
    """The app's Page shape: doc fields + sharing fields seen from the viewer's side."""
    is_owner = p.owner_id == viewer.id
    members = [person(m.user) for m in p.memberships]
    return {
        **p.doc,
        "id": p.id,
        "owner": None if is_owner else person(p.owner),
        "members": members if is_owner else [person(p.owner)],
        # only the owner can see and share the invite link
        "inviteToken": p.invite_token if is_owner else "",
        "version": p.version,
        "createdAt": int(p.created_at.timestamp() * 1000),
        "updatedAt": int(p.updated_at.timestamp() * 1000),
    }
