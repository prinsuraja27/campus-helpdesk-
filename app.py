import os, secrets, smtplib
from datetime import datetime
from email.message import EmailMessage
from functools import wraps
from flask import Flask, request, jsonify, render_template, session
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import create_engine, String, Integer, Boolean, DateTime, ForeignKey, Text, select, func, or_
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker, joinedload

BASE=os.path.dirname(os.path.abspath(__file__))
DB_URL=os.getenv('DATABASE_URL','sqlite:///'+os.path.join(BASE,'campus_helpdesk.db'))
if DB_URL.startswith('postgres://'): DB_URL=DB_URL.replace('postgres://','postgresql+psycopg2://',1)
elif DB_URL.startswith('postgresql://'): DB_URL=DB_URL.replace('postgresql://','postgresql+psycopg2://',1)
engine=create_engine(DB_URL, pool_pre_ping=True, connect_args={'check_same_thread':False} if DB_URL.startswith('sqlite') else {})
SessionLocal=sessionmaker(bind=engine, expire_on_commit=False)

class Base(DeclarativeBase): pass
class User(Base):
    __tablename__='users'; id:Mapped[int]=mapped_column(primary_key=True); name:Mapped[str]=mapped_column(String(160)); email:Mapped[str]=mapped_column(String(255),unique=True,index=True); password:Mapped[str]=mapped_column(String(255)); phone:Mapped[str]=mapped_column(String(40),default=''); role:Mapped[str]=mapped_column(String(30)); department:Mapped[str]=mapped_column(String(120),default=''); semester:Mapped[int|None]=mapped_column(Integer,nullable=True); enrollment_no:Mapped[str]=mapped_column(String(80),default=''); is_active:Mapped[bool]=mapped_column(Boolean,default=True); created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
class Ticket(Base):
    __tablename__='tickets'; id:Mapped[int]=mapped_column(primary_key=True); ticket_no:Mapped[str]=mapped_column(String(40),unique=True,index=True); student_id:Mapped[int]=mapped_column(ForeignKey('users.id')); assigned_to:Mapped[int|None]=mapped_column(ForeignKey('users.id'),nullable=True); department:Mapped[str]=mapped_column(String(120),default=''); category:Mapped[str]=mapped_column(String(40),default='Academic'); priority:Mapped[str]=mapped_column(String(20),default='Medium'); subject:Mapped[str]=mapped_column(String(240)); description:Mapped[str]=mapped_column(Text); status:Mapped[str]=mapped_column(String(30),default='Open'); resolution:Mapped[str]=mapped_column(Text,default=''); transfer_reason:Mapped[str]=mapped_column(Text,default=''); created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow); updated_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow,onupdate=datetime.utcnow)
class Message(Base):
    __tablename__='messages'; id:Mapped[int]=mapped_column(primary_key=True); ticket_id:Mapped[int]=mapped_column(ForeignKey('tickets.id')); sender_id:Mapped[int]=mapped_column(ForeignKey('users.id')); sender_name:Mapped[str]=mapped_column(String(160)); sender_role:Mapped[str]=mapped_column(String(30)); text:Mapped[str]=mapped_column(Text); created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
class Timeline(Base):
    __tablename__='timeline'; id:Mapped[int]=mapped_column(primary_key=True); ticket_id:Mapped[int]=mapped_column(ForeignKey('tickets.id')); action:Mapped[str]=mapped_column(String(120)); note:Mapped[str]=mapped_column(Text,default=''); actor_name:Mapped[str]=mapped_column(String(160)); created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)

Base.metadata.create_all(engine)
ROLES=['student','professor','hod','admin','exam_cell']; STATUSES=['Open','In Progress','Transferred','Resolved','Closed']
app=Flask(__name__); app.secret_key=os.getenv('SECRET_KEY','CHANGE_ME_USE_A_LONG_RANDOM_SECRET'); app.config['SESSION_COOKIE_HTTPONLY']=True; app.config['SESSION_COOKIE_SAMESITE']='Lax'; app.config['SESSION_COOKIE_SECURE']=os.getenv('COOKIE_SECURE','0')=='1'

def seed():
    with SessionLocal() as s:
        if s.scalar(select(User.id).limit(1)): return
        seeds=[('Campus Administrator','admin@campus.local','Admin@123','admin','','',''),('Rahul Professor','professor@campus.local','Prof@123','professor','Computer Science','',''),('Department HOD','hod@campus.local','Hod@123','hod','Computer Science','',''),('Exam Cell','exam@campus.local','Exam@123','exam_cell','','',''),('Demo Student','student@campus.local','Student@123','student','Computer Science','3','250905050029')]
        for name,email,pw,role,dept,sem,enr in seeds: s.add(User(name=name,email=email,password=generate_password_hash(pw),role=role,department=dept,semester=int(sem) if sem else None,enrollment_no=enr))
        s.commit()
seed()

def current():
    uid=session.get('uid');
    if not uid:return None
    with SessionLocal() as s:
        u=s.get(User,uid); return user_dict(u) if u and u.is_active else None

def user_dict(u): return {'id':u.id,'name':u.name,'email':u.email,'phone':u.phone or '','role':u.role,'department':u.department or '','semester':u.semester,'enrollment_no':u.enrollment_no or '','is_active':bool(u.is_active),'created_at':u.created_at.isoformat() if u.created_at else None}
def email_notify(to,subject,body):
    user=os.getenv('SMTP_USER',''); pw=os.getenv('SMTP_PASSWORD','')
    if not user or not pw:return False
    try:
        m=EmailMessage(); m['From']=os.getenv('SMTP_FROM',user); m['To']=to; m['Subject']=subject; m.set_content(body)
        with smtplib.SMTP(os.getenv('SMTP_HOST','smtp.gmail.com'),int(os.getenv('SMTP_PORT','587')),timeout=15) as x:x.starttls();x.login(user,pw);x.send_message(m)
        return True
    except Exception:return False

def auth(fn):
    @wraps(fn)
    def w(u=None,*a,**kw):
        cu=current()
        if not cu:return jsonify({'message':'Authentication required'}),401
        return fn(cu,*a,**kw)
    return w

def ticket_dict(t,s,a,session):
    msgs=session.scalars(select(Message).where(Message.ticket_id==t.id).order_by(Message.created_at)).all(); tl=session.scalars(select(Timeline).where(Timeline.ticket_id==t.id).order_by(Timeline.created_at)).all()
    return {'id':t.id,'ticket_no':t.ticket_no,'student_id':t.student_id,'assigned_to':t.assigned_to,'department':t.department,'category':t.category,'priority':t.priority,'subject':t.subject,'description':t.description,'status':t.status,'resolution':t.resolution,'transfer_reason':t.transfer_reason,'created_at':t.created_at.isoformat(),'updated_at':t.updated_at.isoformat(),'student':user_dict(s) if s else None,'assigned':user_dict(a) if a else None,'messages':[{'id':m.id,'sender_name':m.sender_name,'sender_role':m.sender_role,'text':m.text,'created_at':m.created_at.isoformat()} for m in msgs],'timeline':[{'id':x.id,'action':x.action,'note':x.note,'actor_name':x.actor_name,'created_at':x.created_at.isoformat()} for x in tl]}

def get_ticket(session,t):
    s=session.get(User,t.student_id); a=session.get(User,t.assigned_to) if t.assigned_to else None; return ticket_dict(t,s,a,session)

@app.get('/')
def index(): return render_template('login.html') if not current() else render_template('dashboard.html')
@app.get('/dashboard')
@app.get('/tickets')
@app.get('/ticket/<int:tid>')
@app.get('/profile')
@app.get('/password')
@app.get('/settings')
@app.get('/accounts')
def page():
    if not current(): return render_template('login.html')
    return render_template('app_page.html')

@app.post('/api/login')
def login():
    d=request.json or {}; email=str(d.get('email','')).lower().strip()
    with SessionLocal() as s:
        u=s.scalar(select(User).where(User.email==email,User.is_active==True))
        if not u or not check_password_hash(u.password,d.get('password','')): return jsonify({'message':'Invalid email or password'}),401
        session.clear(); session['uid']=u.id; return jsonify({'user':user_dict(u)})
@app.post('/api/logout')
def logout():session.clear();return jsonify({'ok':True})
@app.get('/api/me')
@auth
def me(u):return jsonify({'user':u})
@app.patch('/api/profile')
@auth
def update_profile(u):
    d=request.json or {}; allowed={'name','phone','department','semester','enrollment_no'}
    with SessionLocal() as s:
        x=s.get(User,u['id']);
        for k in allowed:
            if k in d:
                if k=='name' and not str(d[k]).strip():return jsonify({'message':'Name cannot be empty'}),400
                setattr(x,k,d[k])
        s.commit();return jsonify({'user':user_dict(x)})
@app.post('/api/change-password')
@auth
def change_password(u):
    d=request.json or {}; old=d.get('current_password',''); new=d.get('new_password','')
    if len(new)<8:return jsonify({'message':'New password must be at least 8 characters'}),400
    with SessionLocal() as s:
        x=s.get(User,u['id'])
        if not check_password_hash(x.password,old):return jsonify({'message':'Current password is incorrect'}),401
        x.password=generate_password_hash(new);s.commit()
    return jsonify({'ok':True,'message':'Password changed successfully'})
@app.get('/api/users')
@auth
def users(u):
    if u['role'] not in ('admin','hod'):return jsonify({'message':'Permission denied'}),403
    with SessionLocal() as s:return jsonify({'users':[user_dict(x) for x in s.scalars(select(User).order_by(User.created_at.desc())).all()]})
@app.post('/api/users')
@auth
def create_user(u):
    if u['role']!='admin':return jsonify({'message':'Only administration can create accounts'}),403
    d=request.json or {}
    if not all(d.get(x) for x in ('name','email','password','role')):return jsonify({'message':'Name, email, password and role are required'}),400
    if d['role'] not in ROLES:return jsonify({'message':'Invalid role'}),400
    with SessionLocal() as s:
        if s.scalar(select(User).where(User.email==d['email'].lower().strip())):return jsonify({'message':'Email already registered'}),409
        x=User(name=d['name'].strip(),email=d['email'].lower().strip(),password=generate_password_hash(d['password']),phone=d.get('phone',''),role=d['role'],department=d.get('department',''),semester=d.get('semester') or None,enrollment_no=d.get('enrollment_no',''));s.add(x);s.commit();return jsonify({'ok':True,'user':user_dict(x)})
@app.get('/api/tickets')
@auth
def tickets(u):
    with SessionLocal() as s:
        stmt=select(Ticket).order_by(Ticket.updated_at.desc())
        if u['role']=='student':stmt=stmt.where(Ticket.student_id==u['id'])
        elif u['role'] in ('professor','hod','exam_cell'):stmt=stmt.where(Ticket.assigned_to==u['id'])
        rows=s.scalars(stmt).all();return jsonify({'tickets':[get_ticket(s,t) for t in rows]})
@app.post('/api/tickets')
@auth
def create_ticket(u):
    if u['role']!='student':return jsonify({'message':'Students only'}),403
    d=request.json or {}
    if not d.get('subject') or not d.get('description'):return jsonify({'message':'Subject and description are required'}),400
    with SessionLocal() as s:
        dept=d.get('department') or u['department']; prof=s.scalar(select(User).where(User.role=='professor',User.department==dept,User.is_active==True)) or s.scalar(select(User).where(User.role=='professor',User.is_active==True))
        no=f"CH-{datetime.now().year}-{secrets.token_hex(3).upper()}"; t=Ticket(ticket_no=no,student_id=u['id'],assigned_to=prof.id if prof else None,department=dept,category=d.get('category','Academic'),priority=d.get('priority','Medium'),subject=d['subject'],description=d['description'],status='In Progress' if prof else 'Open');s.add(t);s.flush();s.add(Timeline(ticket_id=t.id,action='Ticket Created',note='Submitted by student',actor_name=u['name']));
        if prof:s.add(Timeline(ticket_id=t.id,action='Automatically Assigned',note=f'Assigned to {prof.name} (Professor)',actor_name=u['name']))
        s.commit(); out=get_ticket(s,t)
    email_notify(u['email'],f'Campus Helpdesk • {no}',f'Your ticket has been created.\nTicket: {no}\nSubject: {d["subject"]}')
    return jsonify({'ticket':out})
@app.get('/api/tickets/<int:tid>')
@auth
def one_ticket(u,tid):
    with SessionLocal() as s:
        t=s.get(Ticket,tid)
        if not t:return jsonify({'message':'Ticket not found'}),404
        if u['role']=='student' and t.student_id!=u['id']:return jsonify({'message':'Permission denied'}),403
        if u['role'] in ('professor','hod','exam_cell') and t.assigned_to!=u['id']:return jsonify({'message':'Permission denied'}),403
        return jsonify({'ticket':get_ticket(s,t)})
@app.patch('/api/tickets/<int:tid>')
@auth
def update_ticket(u,tid):
    if u['role'] not in ('professor','hod','admin','exam_cell'):return jsonify({'message':'Permission denied'}),403
    with SessionLocal() as s:
        t=s.get(Ticket,tid)
        if not t:return jsonify({'message':'Ticket not found'}),404
        if u['role'] in ('professor','hod','exam_cell') and t.assigned_to!=u['id']:return jsonify({'message':'This ticket is not assigned to you'}),403
        d=request.json or {}; status=d.get('status')
        if status and status not in STATUSES:return jsonify({'message':'Invalid status'}),400
        if d.get('transfer_role'):
            target=s.scalar(select(User).where(User.role==d['transfer_role'],User.is_active==True,or_(User.department==t.department,User.department=='',User.department.is_(None)))) or s.scalar(select(User).where(User.role==d['transfer_role'],User.is_active==True))
            if not target:return jsonify({'message':'No active target account found'}),404
            t.assigned_to=target.id;t.status='Transferred';t.transfer_reason=d.get('transfer_reason','');s.add(Timeline(ticket_id=t.id,action='Ticket Transferred',note=f'Transferred to {target.name} ({target.role})',actor_name=u['name']))
        else:
            if status:t.status=status
            if d.get('resolution') is not None:t.resolution=d['resolution']
            s.add(Timeline(ticket_id=t.id,action='Ticket Updated',note=d.get('reply') or d.get('resolution') or f'Status changed to {t.status}',actor_name=u['name']))
        if d.get('reply'):s.add(Message(ticket_id=t.id,sender_id=u['id'],sender_name=u['name'],sender_role=u['role'],text=d['reply']))
        t.updated_at=datetime.utcnow();s.commit();out=get_ticket(s,t)
    email_notify(out['student']['email'],f'Campus Helpdesk • {out["ticket_no"]}',f'Your ticket was updated by {u["name"]}.\nStatus: {out["status"]}')
    return jsonify({'ticket':out})
@app.get('/api/stats')
@auth
def stats(u):
    with SessionLocal() as s:
        stmt=select(func.count(Ticket.id));
        if u['role']=='student':stmt=stmt.where(Ticket.student_id==u['id'])
        elif u['role'] in ('professor','hod','exam_cell'):stmt=stmt.where(Ticket.assigned_to==u['id'])
        total=s.scalar(stmt) or 0
        def count_status(vals):
            q=select(func.count(Ticket.id)).where(Ticket.status.in_(vals));
            if u['role']=='student':q=q.where(Ticket.student_id==u['id'])
            elif u['role'] in ('professor','hod','exam_cell'):q=q.where(Ticket.assigned_to==u['id'])
            return s.scalar(q) or 0
        return jsonify({'total':total,'open':count_status(['Open']),'progress':count_status(['In Progress','Transferred']),'resolved':count_status(['Resolved','Closed'])})
@app.get('/health')
def health():return jsonify({'ok':True,'database':'postgresql' if 'postgresql' in DB_URL else 'sqlite','email_configured':bool(os.getenv('SMTP_USER') and os.getenv('SMTP_PASSWORD'))})

if __name__=='__main__':app.run(host='0.0.0.0',port=int(os.getenv('PORT',5000)),debug=os.getenv('FLASK_DEBUG','0')=='1')
