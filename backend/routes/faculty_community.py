from datetime import datetime, timezone
from uuid import UUID

from flask import Blueprint, jsonify, request, g, current_app
from firebase_admin import auth

from middleware.role_auth import require_role
from routes.admin_community import admin_only
from services.supabase_client import get_supabase

faculty_community_bp = Blueprint(
    "faculty_community",
    __name__
)


def valid_uuid(value):
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def rpc_result(name, params):
    try:
        result = get_supabase().rpc(
            name, params
        ).execute()

        return jsonify(result.data or {})

    except Exception as exc:
        known_errors = (
            "Request not found",
            "Only material requests can be forwarded",
            "Request is already closed",
            "Request already assigned to faculty",
            "Invalid or unapproved faculty",
            "Approved faculty access required",
            "Invalid action",
            "Request is not available",
            "Request was not forwarded to you",
            "Offer is no longer available",
            "Another faculty member already accepted",
            "Request cannot be completed",
            "Request is not assigned to you",
            "Accepted faculty offer required",
            "Published faculty material required",
            "Material does not match the student request",
        )

        for message in known_errors:
            if message in str(exc):
                return jsonify({
                    "error": message
                }), 409

        current_app.logger.exception(
            "Community RPC failed: %s", name
        )

        return jsonify({
            "error": "Unable to process request"
        }), 503


@faculty_community_bp.after_request
def prevent_cache(response):
    response.headers["Cache-Control"] = "private, no-store"
    return response


# ==========================================
# ADMIN: FORWARD REQUEST
# ==========================================

@faculty_community_bp.post(
    "/api/admin/community/requests/<request_id>/forward"
)
@admin_only
def forward_request(request_id):

    request_id = valid_uuid(request_id)

    if not request_id:
        return jsonify({"error": "Invalid request ID"}), 400

    body = request.get_json(silent=True)

    if not isinstance(body, dict):
        return jsonify({"error": "JSON object required"}), 400

    faculty_uids = body.get("faculty_uids")

    if (
        not isinstance(faculty_uids, list)
        or not 1 <= len(faculty_uids) <= 50
        or not all(
            isinstance(uid, str)
            and 1 <= len(uid) <= 128
            for uid in faculty_uids
        )
    ):
        return jsonify({
            "error": "Select between 1 and 50 faculty members"
        }), 400

    faculty_uids = list(dict.fromkeys(faculty_uids))

    # Check Firebase account availability.

    for uid in faculty_uids:
        try:
            user = auth.get_user(uid)

            if user.disabled or not user.email_verified:
                return jsonify({
                    "error": "Selected faculty account is not active"
                }), 409

        except auth.UserNotFoundError:
            return jsonify({
                "error": "Selected faculty account not found"
            }), 404

    return rpc_result(
        "community_admin_forward",
        {
            "p_admin_uid": g.firebase_uid,
            "p_request_id": request_id,
            "p_faculty_uids": faculty_uids,
        }
    )


# ==========================================
# FACULTY: LIST FORWARDED REQUESTS
# ==========================================

@faculty_community_bp.get(
    "/api/faculty/community/requests"
)
@require_role("faculty")
def list_requests():

    try:
        db = get_supabase()

        offers = (
            db.table("community_faculty_offers")
            .select(
                "id,request_id,status,created_at,"
                "responded_at,completed_at,material_id"
            )
            .eq("faculty_uid", g.firebase_uid)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        ).data or []

        request_ids = list({
            row["request_id"] for row in offers
        })

        if not request_ids:
            return jsonify({"requests": []})

        requests = (
            db.table("community_requests")
            .select(
                "id,ticket_number,title,description,"
                "branch,semester,subject_name,"
                "material_type,status,material_id,"
                "assigned_faculty_uid,created_at"
            )
            .in_("id", request_ids)
            .execute()
        ).data or []

        request_map = {
            row["id"]: row for row in requests
        }

        items = []

        for offer in offers:

            item = request_map.get(offer["request_id"])

            if not item:
                continue

            offer_status = offer["status"]

            # Prevent action on requests closed by admin.

            if item["status"] in ("completed", "cancelled"):
                if offer_status in ("offered", "accepted"):
                    offer_status = "withdrawn"

            items.append({
                **item,
                "offer_id": offer["id"],
                "offer_status": offer_status,
                "forwarded_at": offer["created_at"],
            })

        return jsonify({"requests": items})

    except Exception:
        current_app.logger.exception(
            "Faculty request listing failed"
        )

        return jsonify({
            "error": "Unable to load student requests"
        }), 503


# ==========================================
# FACULTY: ACCEPT OR DECLINE
# ==========================================

@faculty_community_bp.post(
    "/api/faculty/community/requests/<request_id>/respond"
)
@require_role("faculty")
def respond(request_id):

    request_id = valid_uuid(request_id)

    if not request_id:
        return jsonify({"error": "Invalid request ID"}), 400

    body = request.get_json(silent=True)

    if not isinstance(body, dict):
        return jsonify({"error": "JSON object required"}), 400

    action = body.get("action")

    if action not in ("accept", "decline"):
        return jsonify({"error": "Invalid action"}), 400

    return rpc_result(
        "community_faculty_respond",
        {
            "p_faculty_uid": g.firebase_uid,
            "p_request_id": request_id,
            "p_action": action,
        }
    )


# ==========================================
# FACULTY: COMPLETE WITH PUBLISHED MATERIAL
# ==========================================

@faculty_community_bp.post(
    "/api/faculty/community/requests/<request_id>/complete"
)
@require_role("faculty")
def complete(request_id):

    request_id = valid_uuid(request_id)

    if not request_id:
        return jsonify({"error": "Invalid request ID"}), 400

    body = request.get_json(silent=True)

    if not isinstance(body, dict):
        return jsonify({"error": "JSON object required"}), 400

    material_id = valid_uuid(body.get("material_id"))

    if not material_id:
        return jsonify({"error": "Invalid material ID"}), 400

    return rpc_result(
        "community_faculty_complete",
        {
            "p_faculty_uid": g.firebase_uid,
            "p_request_id": request_id,
            "p_material_id": material_id,
        }
    )


# ==========================================
# FACULTY: NOTIFICATIONS
# ==========================================

@faculty_community_bp.get(
    "/api/faculty/community/notifications"
)
@require_role("faculty")
def notifications():

    try:
        db = get_supabase()

        items = (
            db.table("community_notifications")
            .select(
                "id,request_id,title,message,"
                "is_read,created_at"
            )
            .eq("recipient_uid", g.firebase_uid)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )

        unread = (
            db.table("community_notifications")
            .select("id", count="exact")
            .eq("recipient_uid", g.firebase_uid)
            .eq("is_read", False)
            .limit(1)
            .execute()
        )

        return jsonify({
            "notifications": items.data or [],
            "unread_count": unread.count or 0,
        })

    except Exception:
        current_app.logger.exception(
            "Faculty notification listing failed"
        )

        return jsonify({
            "error": "Unable to load notifications"
        }), 503


# ==========================================
# FACULTY: MARK NOTIFICATION AS READ
# ==========================================

@faculty_community_bp.patch(
    "/api/faculty/community/notifications/<notification_id>/read"
)
@require_role("faculty")
def mark_read(notification_id):

    notification_id = valid_uuid(notification_id)

    if not notification_id:
        return jsonify({
            "error": "Invalid notification ID"
        }), 400

    result = (
        get_supabase()
        .table("community_notifications")
        .update({
            "is_read": True,
            "read_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", notification_id)
        .eq("recipient_uid", g.firebase_uid)
        .execute()
    )

    if not result.data:
        return jsonify({
            "error": "Notification not found"
        }), 404

    return jsonify({
        "message": "Notification marked as read"
    })


# ==========================================
# FACULTY: MARK ALL NOTIFICATIONS AS READ
# ==========================================

@faculty_community_bp.patch(
    "/api/faculty/community/notifications/read-all"
)
@require_role("faculty")
def mark_all_read():

    (
        get_supabase()
        .table("community_notifications")
        .update({
            "is_read": True,
            "read_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("recipient_uid", g.firebase_uid)
        .eq("is_read", False)
        .execute()
    )

    return jsonify({
        "message": "All notifications marked as read"
    })

