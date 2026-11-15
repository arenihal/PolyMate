from datetime import datetime, timezone
from services.pdf_preview import secure_pdf_response
import uuid
from flask import Blueprint, request, jsonify, g
from werkzeug.utils import secure_filename

from middleware.role_auth import require_role
from services.supabase_client import get_supabase
from services.profiles import get_profile

faculty_materials_bp = Blueprint("faculty_materials", __name__)




BUCKET = "study-materials"
MAX_SIZE = 20 * 1024 * 1024
ALLOWED_TYPES = {"notes", "question-paper", "syllabus", "lab-manual"}


@faculty_materials_bp.get("/api/faculty/subjects")
@require_role("faculty")
def get_assigned_subjects():
    try:
        result = (
            get_supabase()
            .table("study_materials")
            .select("branch,semester,subject_name")
            .eq("faculty_uid", g.firebase_uid)
            .neq("status", "trash")
            .execute()
        )

        subjects = []
        seen = set()

        for item in result.data or []:
            key = (
                item["branch"],
                item["semester"],
                item["subject_name"]
            )

            if key not in seen:
                seen.add(key)
                subjects.append(item)

        return jsonify({"subjects": subjects})

    except Exception:
        return jsonify({"error": "Unable to load subjects"}), 503


@faculty_materials_bp.post("/api/faculty/materials/upload")
@require_role("faculty")
def upload_pdf():

    title = request.form.get("title", "").strip()
    subject = request.form.get("subject_name", "").strip()
    semester = request.form.get("semester", "").strip()
    material_type = request.form.get("material_type", "").strip()
    pdf = request.files.get("file")

    if not title or not subject or not semester or pdf is None:
        return jsonify({
            "error": "Complete all fields and select a PDF"
        }), 400

    if len(title) > 120 or len(subject) > 100:
        return jsonify({"error": "Invalid material details"}), 400

    if material_type not in ALLOWED_TYPES:
        return jsonify({"error": "Invalid material type"}), 400

    try:
        semester = int(semester)
        if semester not in range(1, 7):
            raise ValueError()
    except ValueError:
        return jsonify({"error": "Invalid semester"}), 400

    filename = secure_filename(pdf.filename or "")

    if not filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are allowed"}), 400

    content = pdf.stream.read(MAX_SIZE + 1)

    if not content or len(content) > MAX_SIZE:
        return jsonify({
            "error": "PDF must be 20 MB or smaller"
        }), 400

    if not content.startswith(b"%PDF-"):
        return jsonify({"error": "Invalid PDF file"}), 400

    try:
        profile = get_profile(g.firebase_uid)

        if not profile:
            return jsonify({"error": "Faculty profile not found"}), 404

        branch = (profile.get("faculty_branch") or "").strip()

        if not branch:
            return jsonify({
                "error": "Your registered branch is missing from your profile."
            }), 400

        db = get_supabase()

        material_id = str(uuid.uuid4())
        storage_path = f"{g.firebase_uid}/{material_id}.pdf"

        db.storage.from_(BUCKET).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": "application/pdf"}
        )

    except Exception:
        return jsonify({"error": "PDF storage upload failed"}), 503

    try:
        record = {
            "id": material_id,
            "faculty_uid": g.firebase_uid,
            "branch": branch,
            "semester": semester,
            "subject_name": subject,
            "title": title,
            "material_type": material_type,
            "original_filename": filename,
            "storage_path": storage_path,
            "file_size_bytes": len(content)
        }

        saved = db.table("study_materials").insert(record).execute()

        if not saved.data:
            raise RuntimeError("Database insert failed")

    except Exception:
        try:
            db.storage.from_(BUCKET).remove([storage_path])
        except Exception:
            pass

        return jsonify({
            "error": "Unable to save material details"
        }), 503


    return jsonify({
        "message": "PDF uploaded successfully",
        "material": saved.data[0],
    }), 201


@faculty_materials_bp.get("/api/faculty/materials")
@require_role("faculty")
def get_materials():
    try:
        result = (
            get_supabase()
            .table("study_materials")
            .select(
                "id,title,subject_name,branch,semester,"
                "material_type,created_at"
            )
            .eq("faculty_uid", g.firebase_uid)
            .neq("status", "trash")
            .order("created_at", desc=True)
            .execute()
        )

        return jsonify({"materials": result.data or []})

    except Exception:
        return jsonify({"error": "Unable to load materials"}), 503


@faculty_materials_bp.get("/api/faculty/materials/<uuid:material_id>/preview")
@require_role("faculty")
def preview_pdf(material_id):
    try:
        db = get_supabase()

        result = (
            db.table("study_materials")
            .select("id,title,storage_path")
            .eq("id", str(material_id))
            .eq("faculty_uid", g.firebase_uid)
            .neq("status", "trash")
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "PDF not found or access denied"
            }), 404

        material = result.data[0]

        return secure_pdf_response(db, BUCKET, material)

    except Exception:
        return jsonify({
            "error": "Unable to open PDF preview"
        }), 503


def find_owned_material(material_id):
    db = get_supabase()

    result = (
        db.table("study_materials")
        .select("*")
        .eq("id", str(material_id))
        .eq("faculty_uid", g.firebase_uid)
        .neq("status", "trash")
        .limit(1)
        .execute()
    )

    material = result.data[0] if result.data else None

    return db, material


@faculty_materials_bp.patch("/api/faculty/materials/<uuid:material_id>")
@require_role("faculty")
def update_material(material_id):
    body = request.get_json(silent=True) or {}

    title = str(body.get("title", "")).strip()
    subject = str(body.get("subject_name", "")).strip()
    material_type = str(body.get("material_type", "")).strip()

    if not title or not subject:
        return jsonify({"error": "Complete all material details"}), 400

    if len(title) > 120 or len(subject) > 100:
        return jsonify({"error": "Invalid material details"}), 400

    if material_type not in ALLOWED_TYPES:
        return jsonify({"error": "Invalid material type"}), 400

    try:
        semester = int(body.get("semester", 0))

        if semester not in range(1, 6):
            raise ValueError()

    except (ValueError, TypeError):
        return jsonify({"error": "Invalid semester"}), 400

    try:
        db, material = find_owned_material(material_id)

        if not material:
            return jsonify({"error": "Material not found"}), 404

        changes = {
            "title": title,
            "subject_name": subject,
            "semester": semester,
            "material_type": material_type
        }

        result = (
            db.table("study_materials")
            .update(changes)
            .eq("id", str(material_id))
            .eq("faculty_uid", g.firebase_uid)
            .neq("status", "trash")
            .execute()
        )

        if not result.data:
            return jsonify({"error": "Unable to update material"}), 409

        return jsonify({
            "message": "Material updated successfully",
            "material": result.data[0]
        })

    except Exception:
        return jsonify({"error": "Unable to update material"}), 503


@faculty_materials_bp.put("/api/faculty/materials/<uuid:material_id>/replace")
@require_role("faculty")
def replace_material_pdf(material_id):
    pdf = request.files.get("file")

    if pdf is None:
        return jsonify({"error": "Select a PDF file"}), 400

    filename = secure_filename(pdf.filename or "")

    if not filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are allowed"}), 400

    content = pdf.stream.read(MAX_SIZE + 1)

    if not content or len(content) > MAX_SIZE:
        return jsonify({"error": "PDF must be 20 MB or smaller"}), 400

    if not content.startswith(b"%PDF-"):
        return jsonify({"error": "Invalid PDF file"}), 400

    try:
        db, material = find_owned_material(material_id)

        if not material:
            return jsonify({"error": "Material not found"}), 404

        old_path = material["storage_path"]

        new_path = (
            f"{g.firebase_uid}/"
            f"{material_id}-{uuid.uuid4()}.pdf"
        )

        db.storage.from_(BUCKET).upload(
            path=new_path,
            file=content,
            file_options={"content-type": "application/pdf"}
        )

    except Exception:
        return jsonify({"error": "Replacement upload failed"}), 503

    try:
        result = (
            db.table("study_materials")
            .update({
                "storage_path": new_path,
                "original_filename": filename,
                "file_size_bytes": len(content)
            })
            .eq("id", str(material_id))
            .eq("faculty_uid", g.firebase_uid)
            .eq("storage_path", old_path)
            .execute()
        )

        if not result.data:
            raise RuntimeError("Replacement update failed")

    except Exception:
        try:
            db.storage.from_(BUCKET).remove([new_path])
        except Exception:
            pass

        return jsonify({
            "error": "Unable to save replacement PDF"
        }), 503


    try:
        db.storage.from_(BUCKET).remove([old_path])
    except Exception:
        return jsonify({
            "message": "PDF replaced successfully",
            "warning": "Previous storage file requires cleanup",
        })

    return jsonify({
        "message": "PDF replaced successfully",
        "material": result.data[0],
    })


@faculty_materials_bp.delete("/api/faculty/materials/<uuid:material_id>")
@require_role("faculty")
def delete_material(material_id):
    from flask import current_app

    try:
        db = get_supabase()

        result = (
            db.table("study_materials")
            .select("*")
            .eq("id", str(material_id))
            .eq("faculty_uid", g.firebase_uid)
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "Material not found"
            }), 404

        material = result.data[0]

        # Already deleted: safely return success.
        if material.get("status") == "trash":
            return jsonify({
                "message": "Material already moved to Trash"
            }), 200

        timestamp = datetime.now(
            timezone.utc
        ).isoformat()

        updated = (
            db.table("study_materials")
            .update({
                "status": "trash",
                "deleted_at": timestamp,
                "deleted_by": g.firebase_uid,
                "updated_at": timestamp
            })
            .eq("id", str(material_id))
            .eq("faculty_uid", g.firebase_uid)
            .eq("status", material["status"])
            .execute()
        )

        if not updated.data:
            return jsonify({
                "error": "Material changed. Try again."
            }), 409

        return jsonify({
            "message": "PDF moved to Trash successfully",
            "material_id": str(material_id),
            "status": "trash"
        }), 200

    except Exception:
        current_app.logger.exception(
            "Faculty material trash operation failed"
        )

        return jsonify({
            "error": "Unable to delete material"
        }), 503







# ============================================================
# FACULTY TRASH
# ============================================================

@faculty_materials_bp.get("/api/faculty/materials/trash")
@require_role("faculty")
def list_trashed_faculty_materials():
    from flask import current_app

    try:
        result = (
            get_supabase()
            .table("study_materials")
            .select(
                "id,title,branch,semester,subject_name,"
                "material_type,created_at,deleted_at"
            )
            .eq("faculty_uid", g.firebase_uid)
            .eq("status", "trash")
            .order("deleted_at", desc=True)
            .execute()
        )

        response = jsonify({
            "materials": result.data or []
        })
        response.headers["Cache-Control"] = "no-store"
        return response, 200

    except Exception:
        current_app.logger.exception(
            "Unable to load faculty trash"
        )
        return jsonify({
            "error": "Unable to load Trash"
        }), 503


@faculty_materials_bp.get(
    "/api/faculty/materials/<uuid:material_id>/trash/preview"
)
@require_role("faculty")
def preview_trashed_faculty_material(material_id):
    from flask import current_app

    try:
        result = (
            get_supabase()
            .table("study_materials")
            .select("id,title,storage_path")
            .eq("id", str(material_id))
            .eq("faculty_uid", g.firebase_uid)
            .eq("status", "trash")
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "Trashed material not found"
            }), 404

        material = result.data[0]

        if not material.get("storage_path"):
            return jsonify({
                "error": "PDF storage path missing"
            }), 404

        return secure_pdf_response(
            get_supabase(),
            BUCKET,
            material
        )

    except Exception:
        current_app.logger.exception(
            "Unable to preview trashed material"
        )
        return jsonify({
            "error": "Unable to preview PDF"
        }), 503


@faculty_materials_bp.patch(
    "/api/faculty/materials/<uuid:material_id>/restore"
)
@require_role("faculty")
def restore_trashed_faculty_material(material_id):
    from flask import current_app

    try:
        db = get_supabase()

        result = (
            db.table("study_materials")
            .select("id,status,storage_path")
            .eq("id", str(material_id))
            .eq("faculty_uid", g.firebase_uid)
            .eq("status", "trash")
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "Trashed material not found"
            }), 404

        material = result.data[0]

        # Check that the PDF still exists before restoring.
        pdf_bytes = db.storage.from_(BUCKET).download(
            material["storage_path"]
        )

        if not pdf_bytes or not pdf_bytes.startswith(b"%PDF-"):
            return jsonify({
                "error": "Stored PDF is missing or invalid"
            }), 409

        timestamp = datetime.now(
            timezone.utc
        ).isoformat()

        updated = (
            db.table("study_materials")
            .update({
                "status": "published",
                "deleted_at": None,
                "deleted_by": None,
                "updated_at": timestamp
            })
            .eq("id", str(material_id))
            .eq("faculty_uid", g.firebase_uid)
            .eq("status", "trash")
            .execute()
        )

        if not updated.data:
            return jsonify({
                "error": "Material changed. Please try again."
            }), 409

        return jsonify({
            "message": "Material restored successfully",
            "material_id": str(material_id),
            "status": "published"
        }), 200

    except Exception:
        current_app.logger.exception(
            "Unable to restore faculty material"
        )

        return jsonify({
            "error": "Unable to restore material"
        }), 503

@faculty_materials_bp.get("/api/faculty/reports")
@require_role("faculty")
def list_faculty_reports():

    try:
        db = get_supabase()

        result = (
            db.table("material_reports")
            .select(
                "id,material_id,material_title,reason,details,"
                "status,faculty_response,created_at,resolved_at,"
                "faculty_read_at"
            )
            .eq("faculty_uid", g.firebase_uid)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )

        pending = (
            db.table("material_reports")
            .select("id", count="exact")
            .eq("faculty_uid", g.firebase_uid)
            .eq("status", "pending")
            .limit(1)
            .execute()
        )

        response = jsonify({
            "reports": result.data or [],
            "pending_count": pending.count or 0
        })

        response.headers["Cache-Control"] = "no-store"

        return response

    except Exception:
        return jsonify({
            "error": "Unable to load material reports"
        }), 503


@faculty_materials_bp.post(
    "/api/faculty/reports/<uuid:report_id>/read"
)
@require_role("faculty")
def mark_faculty_report_read(report_id):

    try:
        result = (
            get_supabase()
            .table("material_reports")
            .update({
                "faculty_read_at": datetime.now(
                    timezone.utc
                ).isoformat()
            })
            .eq("id", str(report_id))
            .eq("faculty_uid", g.firebase_uid)
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "Report not found"
            }), 404

        return jsonify({"success": True})

    except Exception:
        return jsonify({
            "error": "Unable to mark report as read"
        }), 503


@faculty_materials_bp.patch(
    "/api/faculty/reports/<uuid:report_id>/resolve"
)
@require_role("faculty")
def resolve_material_report(report_id):

    body = request.get_json(silent=True)

    if not isinstance(body, dict):
        return jsonify({"error": "Invalid response"}), 400

    reply = body.get("response", "")

    if not isinstance(reply, str):
        return jsonify({"error": "Invalid response"}), 400

    reply = reply.strip()

    if not reply:
        return jsonify({
            "error": "A response is required before resolving."
        }), 400

    if len(reply) > 2000:
        return jsonify({
            "error": "Response must be 2000 characters or fewer."
        }), 400

    try:
        db = get_supabase()

        timestamp = datetime.now(
            timezone.utc
        ).isoformat()

        result = (
            db.table("material_reports")
            .update({
                "status": "resolved",
                "faculty_response": reply,
                "resolved_at": timestamp,
                "faculty_read_at": timestamp,
                "student_read_at": None
            })
            .eq("id", str(report_id))
            .eq("faculty_uid", g.firebase_uid)
            .eq("status", "pending")
            .execute()
        )

        if not result.data:
            return jsonify({
                "error": "Report unavailable or already resolved."
            }), 404

        return jsonify({
            "message": "Report resolved. Response saved for the student."
        })

    except Exception:
        return jsonify({
            "error": "Unable to resolve report"
        }), 503
