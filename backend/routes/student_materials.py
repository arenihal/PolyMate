from services.pdf_preview import secure_pdf_response
from flask import Blueprint, request, jsonify, g
from middleware.role_auth import require_role
from services.supabase_client import get_supabase

student_materials_bp = Blueprint(
    "student_materials", __name__
)

BUCKET = "study-materials"

MATERIAL_FIELDS = (
    "id,title,subject_name,branch,semester,"
    "material_type,created_at"
)

ALLOWED_TYPES = {
    "notes",
    "question-paper",
    "syllabus",
    "lab-manual"
}


@student_materials_bp.get("/api/student/materials")
@require_role("student")
def list_materials():
    branch = request.args.get("branch", "").strip()
    semester = request.args.get("semester", "").strip()
    subject = request.args.get("subject", "").strip()
    search = request.args.get("search", "").strip()

    if len(search) > 120 or len(subject) > 200:
        return jsonify({
            "error": "Search or subject filter is too long"
        }), 400
    material_type = request.args.get(
        "material_type", ""
    ).strip()

    if material_type and material_type not in ALLOWED_TYPES:
        return jsonify({
            "error": "Invalid material type"
        }), 400

    if semester:
        try:
            semester = int(semester)
            if semester not in range(1, 7):
                raise ValueError()
        except ValueError:
            return jsonify({
                "error": "Invalid semester"
            }), 400

    try:
        page = int(request.args.get("page", "1"))
        limit = int(request.args.get("limit", "30"))

        if page < 1 or limit < 1 or limit > 100:
            raise ValueError()

    except ValueError:
        return jsonify({
            "error": "Invalid pagination"
        }), 400

    try:
        query = (
            get_supabase()
            .table("study_materials")
            .select(MATERIAL_FIELDS, count="exact")
            .eq("status", "published")
        )

        if branch:
            query = query.eq("branch", branch)

        if semester:
            query = query.eq("semester", semester)

        if material_type:
            query = query.eq(
                "material_type", material_type
            )

        if subject:
            query = query.eq("subject_name", subject)

        if search:
            # Escape LIKE wildcards and PostgREST quoted values.
            escaped = (
                search.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
                .replace("*", "\\*")
            )
            pattern = f"%{escaped}%"
            quoted = (
                pattern.replace("\\", "\\\\")
                .replace('"', '\\"')
            )
            query = query.or_(
                f'title.ilike."{quoted}",'
                f'subject_name.ilike."{quoted}"'
            )

        start = (page - 1) * limit

        result = (
            query
            .order("created_at", desc=True)
            .order("id", desc=True)
            .range(start, start + limit - 1)
            .execute()
        )

        response = jsonify({
            "materials": result.data or [],
            "total": result.count or 0,
            "page": page,
            "limit": limit
        })

        response.headers["Cache-Control"] = "no-store"

        return response

    except Exception:
        return jsonify({
            "error": "Unable to load study materials"
        }), 503


@student_materials_bp.get(
    "/api/student/materials/recent"
)
@require_role("student")
def recent_materials():
    try:
        result = (
            get_supabase()
            .table("study_materials")
            .select(MATERIAL_FIELDS)
            .eq("status", "published")
            .order("created_at", desc=True)
            .order("id", desc=True)
            .limit(3)
            .execute()
        )

        response = jsonify({
            "materials": result.data or []
        })

        response.headers["Cache-Control"] = "no-store"

        return response

    except Exception:
        return jsonify({
            "error": "Unable to load recent materials"
        }), 503


@student_materials_bp.get(
    "/api/student/materials/<uuid:material_id>/preview"
)
@require_role("student")
def preview_material(material_id):
    try:
        db = get_supabase()

        result = (
            db.table("study_materials")
            .select("id,title,storage_path")
            .eq("status", "published")
            .eq("id", str(material_id))
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "PDF not found"
            }), 404

        material = result.data[0]

        return secure_pdf_response(db, BUCKET, material)

    except Exception:
        return jsonify({
            "error": "Unable to open PDF preview"
        }), 503


@student_materials_bp.get("/api/student/materials/subjects")
@require_role("student")
def material_subjects():
    branch = request.args.get("branch", "").strip()
    semester = request.args.get("semester", "").strip()
    material_type = request.args.get("material_type", "").strip()

    if material_type and material_type not in ALLOWED_TYPES:
        return jsonify({"error": "Invalid material type"}), 400

    if semester:
        try:
            semester = int(semester)
            if semester not in range(1, 7):
                raise ValueError()
        except ValueError:
            return jsonify({"error": "Invalid semester"}), 400

    try:
        db = get_supabase()
        subjects = set()
        offset = 0
        batch_size = 500

        while True:
            query = (
                db.table("study_materials")
                .select("subject_name")
                .eq("status", "published")
            )

            if branch:
                query = query.eq("branch", branch)

            if semester:
                query = query.eq("semester", semester)

            if material_type:
                query = query.eq("material_type", material_type)

            result = (
                query
                .order("subject_name")
                .order("id")
                .range(offset, offset + batch_size - 1)
                .execute()
            )

            rows = result.data or []

            for row in rows:
                name = row.get("subject_name")
                if name:
                    subjects.add(name)

            if len(rows) < batch_size:
                break

            offset += batch_size

        response = jsonify({
            "subjects": sorted(subjects, key=str.casefold)
        })

        response.headers["Cache-Control"] = "no-store"

        return response

    except Exception:
        return jsonify({
            "error": "Unable to load subject options"
        }), 503


@student_materials_bp.get(
    "/api/student/materials/<uuid:material_id>"
)
@require_role("student")
def get_shared_material(material_id):
    try:
        result = (
            get_supabase()
            .table("study_materials")
            .select(MATERIAL_FIELDS)
            .eq("id", str(material_id))
            .eq("status", "published")
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "This material is unavailable or has been removed."
            }), 404

        response = jsonify({
            "material": result.data[0]
        })

        response.headers["Cache-Control"] = "no-store"

        return response

    except Exception:
        return jsonify({
            "error": "Unable to load study material."
        }), 503




REPORT_REASONS = {
    "Wrong PDF",
    "Incorrect subject or semester",
    "Incomplete notes",
    "PDF not opening",
    "Poor quality",
    "Other",
}


@student_materials_bp.post(
    "/api/student/materials/<uuid:material_id>/report"
)
@require_role("student")
def submit_material_report(material_id):

    body = request.get_json(silent=True)

    if not isinstance(body, dict):
        return jsonify({"error": "Invalid report data"}), 400

    reason = body.get("reason", "")
    details = body.get("details", "")

    if not isinstance(reason, str) or not isinstance(details, str):
        return jsonify({"error": "Invalid report details"}), 400

    reason = reason.strip()
    details = details.strip()

    if reason not in REPORT_REASONS:
        return jsonify({"error": "Select a valid report reason"}), 400

    if len(details) > 1000:
        return jsonify({
            "error": "Details must be 1000 characters or fewer"
        }), 400

    try:
        db = get_supabase()

        result = (
            db.table("study_materials")
            .select("id,title,faculty_uid")
            .eq("id", str(material_id))
            .eq("status", "published")
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "Material unavailable"
            }), 404

        material = result.data[0]

        if not material.get("faculty_uid"):
            return jsonify({
                "error": "Uploading faculty unavailable"
            }), 409

        existing = (
            db.table("material_reports")
            .select("id")
            .eq("material_id", str(material_id))
            .eq("student_uid", g.firebase_uid)
            .eq("status", "pending")
            .limit(1)
            .execute()
        )

        if existing.data:
            return jsonify({
                "error": "You already have a pending report for this material."
            }), 409

        saved = (
            db.table("material_reports")
            .insert({
                "material_id": str(material_id),
                "student_uid": g.firebase_uid,
                "faculty_uid": material["faculty_uid"],
                "material_title": material["title"],
                "reason": reason,
                "details": details,
                "status": "pending"
            })
            .execute()
        )

        if not saved.data:
            raise RuntimeError("Report insert failed")

        return jsonify({
            "message": "Report sent to the uploading faculty.",
            "report_id": saved.data[0]["id"]
        }), 201

    except Exception as err:

        if getattr(err, "code", None) == "23505":
            return jsonify({
                "error": "You already have a pending report for this material."
            }), 409

        return jsonify({
            "error": "Unable to submit report"
        }), 503


@student_materials_bp.get("/api/student/reports")
@require_role("student")
def list_student_reports():

    try:
        result = (
            get_supabase()
            .table("material_reports")
            .select(
                "id,material_id,material_title,reason,details,"
                "status,faculty_response,created_at,resolved_at,"
                "student_read_at"
            )
            .eq("student_uid", g.firebase_uid)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )

        response = jsonify({
            "reports": result.data or []
        })

        response.headers["Cache-Control"] = "no-store"

        return response

    except Exception:
        return jsonify({
            "error": "Unable to load reports"
        }), 503


@student_materials_bp.post(
    "/api/student/reports/<uuid:report_id>/read"
)
@require_role("student")
def mark_report_response_read(report_id):

    from datetime import datetime, timezone

    try:
        result = (
            get_supabase()
            .table("material_reports")
            .update({
                "student_read_at": datetime.now(
                    timezone.utc
                ).isoformat()
            })
            .eq("id", str(report_id))
            .eq("student_uid", g.firebase_uid)
            .eq("status", "resolved")
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "Report response not found"
            }), 404

        return jsonify({"success": True})

    except Exception:
        return jsonify({
            "error": "Unable to mark response as read"
        }), 503
