from datetime import datetime, timezone

from flask import Blueprint, g, jsonify

from middleware.role_auth import require_role
from services.supabase_client import get_supabase


notifications_bp = Blueprint("notifications", __name__)

MATERIAL_FIELDS = (
    "id,title,subject_name,branch,semester,"
    "material_type,created_at"
)


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def notification_start(db, uid):
    result = (
        db.table("pdf_notification_settings")
        .select("notifications_since")
        .eq("student_uid", uid)
        .limit(1)
        .execute()
    )

    if result.data:
        return result.data[0]["notifications_since"]

    db.table("pdf_notification_settings").upsert(
        {
            "student_uid": uid,
            "notifications_since": utc_now()
        },
        on_conflict="student_uid",
        ignore_duplicates=True
    ).execute()

    result = (
        db.table("pdf_notification_settings")
        .select("notifications_since")
        .eq("student_uid", uid)
        .limit(1)
        .execute()
    )

    return result.data[0]["notifications_since"]


def load_materials(db, since):
    materials = []
    offset = 0
    batch_size = 200

    while True:
        result = (
            db.table("study_materials")
            .select(MATERIAL_FIELDS)
            .eq("status", "published")
            .gt("created_at", since)
            .order("created_at", desc=True)
            .order("id", desc=True)
            .range(offset, offset + batch_size - 1)
            .execute()
        )

        rows = result.data or []
        materials.extend(rows)

        if len(rows) < batch_size:
            break

        offset += batch_size

    return materials


def load_read_ids(db, uid):
    read_ids = set()
    offset = 0
    batch_size = 200

    while True:
        result = (
            db.table("pdf_notification_reads")
            .select("material_id")
            .eq("student_uid", uid)
            .order("material_id")
            .range(offset, offset + batch_size - 1)
            .execute()
        )

        rows = result.data or []

        read_ids.update(
            row["material_id"] for row in rows
        )

        if len(rows) < batch_size:
            break

        offset += batch_size

    return read_ids


@notifications_bp.get("/api/student/notifications")
@require_role("student")
def list_notifications():
    try:
        db = get_supabase()
        uid = g.firebase_uid

        since = notification_start(db, uid)
        materials = load_materials(db, since)
        read_ids = load_read_ids(db, uid)

        notifications = []

        for material in materials:
            notifications.append({
                **material,
                "notification_title": "New PDF Available",
                "is_read": material["id"] in read_ids
            })

        unread_count = sum(
            1 for item in notifications
            if not item["is_read"]
        )

        response = jsonify({
            "notifications": notifications[:50],
            "unread_count": unread_count
        })

        response.headers["Cache-Control"] = "no-store"

        return response

    except Exception:
        return jsonify({
            "error": "Unable to load notifications"
        }), 503


@notifications_bp.post(
    "/api/student/notifications/<uuid:material_id>/read"
)
@require_role("student")
def mark_notification_read(material_id):
    try:
        db = get_supabase()
        uid = g.firebase_uid
        since = notification_start(db, uid)

        result = (
            db.table("study_materials")
            .select("id")
            .eq("id", str(material_id))
            .eq("status", "published")
            .gt("created_at", since)
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "Notification not found"
            }), 404

        db.table("pdf_notification_reads").upsert(
            {
                "student_uid": uid,
                "material_id": str(material_id),
                "read_at": utc_now()
            },
            on_conflict="student_uid,material_id"
        ).execute()

        return jsonify({
            "success": True
        })

    except Exception:
        return jsonify({
            "error": "Unable to mark notification as read"
        }), 503


@notifications_bp.post(
    "/api/student/notifications/read-all"
)
@require_role("student")
def mark_all_notifications_read():
    try:
        db = get_supabase()
        uid = g.firebase_uid

        since = notification_start(db, uid)
        materials = load_materials(db, since)
        read_ids = load_read_ids(db, uid)

        rows = [
            {
                "student_uid": uid,
                "material_id": material["id"],
                "read_at": utc_now()
            }
            for material in materials
            if material["id"] not in read_ids
        ]

        for start in range(0, len(rows), 200):
            db.table("pdf_notification_reads").upsert(
                rows[start:start + 200],
                on_conflict="student_uid,material_id"
            ).execute()

        return jsonify({
            "success": True,
            "marked_read": len(rows)
        })

    except Exception:
        return jsonify({
            "error": "Unable to mark notifications as read"
        }), 503
