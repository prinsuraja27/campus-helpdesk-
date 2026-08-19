# Campus Helpdesk — Production-ready version

## Local run
python -m venv venv
venv\\Scripts\\activate
pip install -r requirements.txt
python app.py

## Default demo accounts
- Administration: admin@campus.local / Admin@123
- Professor: professor@campus.local / Prof@123
- HOD: hod@campus.local / Hod@123
- Exam Cell: exam@campus.local / Exam@123
- Student: student@campus.local / Student@123

## Production database
Set `DATABASE_URL` to a managed PostgreSQL connection string (Supabase/Neon are suitable free-tier options). The app automatically uses PostgreSQL when this variable is present and SQLite locally when it is not.

## Render
Use the included `render.yaml`, connect your GitHub repository, and add the database/SMTP environment variables. Do not put secrets into GitHub.
