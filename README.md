# PolyMate — Polytechnic Learning Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?logo=flask)
![Firebase](https://img.shields.io/badge/Firebase-DD2C00?logo=firebase&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)

**[Live Website](https://polymate-frontend.vercel.app/)** |
**[GitHub Repository](https://github.com/arenihal/PolyMate)**

## Overview

PolyMate is an educational web application developed for Telangana diploma and polytechnic students and faculty.

It provides centralized access to notes, question papers, syllabuses, and laboratory manuals.

## Application Screenshots

### Landing Page
![PolyMate Landing Page](docs/screenshots/01-landing-page.png)

### Login Page
![PolyMate Login Page](docs/screenshots/03-login-page.png)

### Student Dashboard
![Student Dashboard](docs/screenshots/02-student-dashboard.png)

### Student Subject Notes
![Student Subject Notes](docs/screenshots/04-student-subject-notes.png)

### Secure PDF Preview
![Secure PDF Preview](docs/screenshots/05-secure-pdf-preview.png)

### Faculty Dashboard
![Faculty Dashboard](docs/screenshots/06-faculty-dashboard.png)

### Faculty PDF Upload
![Faculty PDF Upload](docs/screenshots/07-faculty-pdf-upload.png)

### Faculty Materials Management
![Faculty Materials Management](docs/screenshots/08-faculty-materials.png)

### Faculty Management Demonstration
This screenshot shows the faculty-management interface used for project demonstration; it is not presented as a live student/faculty role.
![Faculty Management Demonstration](docs/screenshots/09-faculty-management-demo.png)

## Features

### Student Features

- Student registration and secure login
- Firebase Authentication and email verification
- Supported Google Sign-In
- Student dashboard
- Browse academic study materials
- Filter by branch, semester, subject, and material type
- Secure PDF preview
- Bookmark study materials
- Report issues with uploaded PDFs
- Student profile management

### Faculty Features

- Faculty registration and authentication
- Faculty dashboard
- Upload PDF study materials
- View and manage uploaded materials
- Edit material information
- Preview uploaded PDFs
- Receive and resolve student material reports
- Replace reported PDFs
- Move materials to Trash
- Restore or permanently delete trashed materials
- Faculty profile management

### Additional Features

- Telangana polytechnic institution directory
- Light and dark mode
- Responsive user interface
- Progressive Web App support
- REST API integration

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 16, React, TypeScript |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend | Python Flask |
| Production Server | Gunicorn |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage |
| Authentication | Firebase Authentication |
| Token Verification | Firebase Admin SDK |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Version Control | Git and GitHub |

## Project Structure

```text
PolyMate/
├── frontend/
├── backend/
├── database/
└── README.md
```

## Getting Started

### Requirements

- Node.js and npm
- Python
- Firebase configuration
- Supabase configuration

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Configure environment variables before running the application.

## Deployment

Frontend: https://polymate-frontend.vercel.app/

Backend: https://polymate-1.onrender.com/api/health

## Security

- Firebase Admin SDK verifies authentication tokens.
- Protected endpoints require authorization.
- PDF previews use authenticated backend routes.
- Never commit service-account credentials or private keys.

## Project Status

Under active development.

---

Developed as an educational software project.
