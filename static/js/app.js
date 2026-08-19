import {api,esc,roleLabel,initials,slug} from './api.js';
import {applyTheme,setTheme} from './theme.js';

let me=null,tickets=[];

const $=s=>document.querySelector(s);

const toast=(m,bad=false)=>{
    const t=$('#toast');
    if(t){
        t.innerHTML=`<div class="toast ${bad?'bad':''}">${bad?'!':'✓'} ${esc(m)}</div>`;
        setTimeout(()=>t.innerHTML='',2800);
    }
};

const go=p=>location.href=p;


/* =========================================================
   GLOBAL CREATE TICKET BUTTON
   This works even when the dashboard is rendered dynamically.
   ========================================================= */
document.addEventListener('click',function(e){
    const button=e.target.closest('#newTicket');

    if(!button) return;

    e.preventDefault();
    e.stopPropagation();

    ticketModal();
});


/* =========================================================
   APP BOOT
   ========================================================= */
async function boot(){
    try{
        me=(await api('/api/me')).user;
        applyTheme();
        shell();
        page();
    }catch{
        location.href='/';
    }
}


/* =========================================================
   NAVIGATION SHELL
   ========================================================= */
function shell(){

    document.body.className='';

    $('#nav').innerHTML=`
        <div class="nav-inner">

            <a class="brand" href="/dashboard">
                <span>✦</span>
                CAMPUS<span class="brand-accent">HELPDESK</span>
            </a>

            <div class="nav-links">
                <a href="/dashboard">⌂ Overview</a>

                <a href="/tickets">
                    ▣ ${me.role==='student'?'My Tickets':'Assigned Tickets'}
                </a>

                ${me.role==='admin'
                    ?'<a href="/accounts">▤ Manage Accounts</a>'
                    :''
                }
            </div>

            <div class="nav-right">

                <button
                    class="icon-btn"
                    onclick="location.href='/settings'">
                    ⚙
                </button>

                <button
                    class="profile-mini"
                    onclick="location.href='/profile'">

                    <span class="avatar">
                        ${initials(me.name)}
                    </span>

                    <span>
                        <b>${esc(me.name)}</b>
                        <small>${roleLabel(me.role)}</small>
                    </span>

                </button>

                <button id="logout" class="soft logout-btn">
                    ↪ Log out
                </button>

            </div>
        </div>
    `;

    $('#logout').onclick=async()=>{
        await api('/api/logout',{method:'POST'});
        location.href='/';
    };
}


/* =========================================================
   PAGE ROUTER
   ========================================================= */
function page(){

    const p=location.pathname;

    if(p==='/dashboard'||p==='/')
        return dashboard();

    if(p==='/tickets')
        return ticketsPage();

    if(p.startsWith('/ticket/'))
        return ticketPage(Number(p.split('/').pop()));

    if(p==='/profile')
        return profilePage();

    if(p==='/password')
        return passwordPage();

    if(p==='/settings')
        return settingsPage();

    if(p==='/accounts')
        return accountsPage();

    dashboard();
}


/* =========================================================
   COMMON LAYOUT
   ========================================================= */
function layout(title,sub,body,action=''){

    app.innerHTML=`
        <div class="page">

            <div class="page-head">

                <div>
                    <div class="eyebrow">
                        ${roleLabel(me.role).toUpperCase()}
                    </div>

                    <h1>${title}</h1>

                    <p class="muted">
                        ${sub}
                    </p>
                </div>

                <div class="head-actions">
                    ${action}
                </div>

            </div>

            ${body}

        </div>
    `;
}


/* =========================================================
   DASHBOARD
   ========================================================= */
async function dashboard(){

    const s=await api('/api/stats');

    layout(
        me.role==='student'
            ?'Good to see you.'
            :'Support command center.',

        me.role==='student'
            ?'Track your requests and keep every conversation in one place.'
            :'Monitor assigned work, resolve issues and route complex cases to the right authority.',

        `
        <div class="hero-card">

            <div>

                <span class="live-dot"></span>
                LIVE CAMPUS OPERATIONS

                <h2>
                    ${
                        me.role==='student'
                        ?'Your support journey, simplified.'
                        :'Resolve faster. Communicate clearly. Escalate intelligently.'
                    }
                </h2>

                <p>
                    ${
                        me.role==='student'
                        ?'Raise a detailed request and follow its full timeline.'
                        :'Every ticket shows the student contact profile, priority and complete transfer history.'
                    }
                </p>

            </div>

            ${
                me.role==='student'
                ?'<button type="button" class="primary" id="newTicket">＋ Create new ticket</button>'
                :'<a class="primary" href="/tickets">Open work queue →</a>'
            }

        </div>

        <div class="stats-grid">

            ${stat('Total',s.total,'▣')}
            ${stat('Open',s.open,'○')}
            ${stat('In Progress',s.progress,'◒')}
            ${stat('Resolved',s.resolved,'✓')}

        </div>

        <div class="section-title">

            <h2>Recent activity</h2>

            <a class="soft" href="/tickets">
                View all →
            </a>

        </div>

        <div id="recent" class="ticket-grid"></div>
        `
    );

    loadTickets('recent');
}


/* =========================================================
   STAT CARD
   ========================================================= */
function stat(k,v,i){

    return `
        <div class="stat-card">

            <div class="stat-icon">
                ${i}
            </div>

            <div>
                <b>${v}</b>
                <span>${k}</span>
            </div>

        </div>
    `;
}


/* =========================================================
   LOAD TICKETS
   ========================================================= */
async function loadTickets(target){

    tickets=(await api('/api/tickets')).tickets;

    const box=$('#'+target);

    if(box){

        box.innerHTML=
            tickets.slice(0,6).map(card).join('')
            ||
            empty(
                'No tickets yet',
                'Your workspace is ready for activity.'
            );

    }
}


/* =========================================================
   TICKET CARD
   ========================================================= */
function card(t){

    return `
        <article
            class="ticket-card"
            data-id="${t.id}">

            <div class="ticket-top">

                <span class="ticket-no">
                    ${esc(t.ticket_no)}
                </span>

                <span class="status ${slug(t.status)}">
                    ${esc(t.status)}
                </span>

            </div>

            <h3>
                ${esc(t.subject)}
            </h3>

            <p>
                ${esc(t.description).slice(0,130)}
            </p>

            <div class="chips">

                <span>
                    ${esc(t.category)}
                </span>

                <span>
                    ${esc(t.priority)}
                </span>

                ${
                    t.assigned
                    ?`<span>→ ${esc(t.assigned.name)}</span>`
                    :''
                }

            </div>

            ${
                me.role!=='student'&&t.student
                ?
                `
                <div class="student-strip">

                    <span class="avatar sm">
                        ${initials(t.student.name)}
                    </span>

                    <span>

                        <b>
                            ${esc(t.student.name)}
                        </b>

                        <small>
                            ${esc(t.student.enrollment_no||'No enrollment')}
                            ·
                            ${esc(t.student.phone||'No mobile')}
                        </small>

                    </span>

                </div>
                `
                :''
            }

        </article>
    `;
}


/* =========================================================
   CARD CLICK
   ========================================================= */
function bindCards(){

    document
        .querySelectorAll('.ticket-card')
        .forEach(x=>{

            x.onclick=()=>{
                go('/ticket/'+x.dataset.id);
            };

        });
}


/* =========================================================
   TICKETS PAGE
   ========================================================= */
async function ticketsPage(){

    layout(
        me.role==='student'
            ?'My tickets'
            :'Assigned tickets',

        me.role==='student'
            ?'Every request you create appears here.'
            :'Only tickets currently assigned to you appear here.',

        `
        <div class="toolbar">

            <div class="search">

                <span>⌕</span>

                <input
                    id="q"
                    placeholder="Search ticket, subject or student…">

            </div>

            ${
                me.role==='student'
                ?
                '<button type="button" class="primary" id="newTicket">＋ New ticket</button>'
                :''
            }

        </div>

        <div
            id="allTickets"
            class="ticket-grid">
        </div>
        `
    );

    await loadTickets('allTickets');

    renderFilter();

    bindCards();
}


/* =========================================================
   SEARCH FILTER
   ========================================================= */
function renderFilter(){

    const render=()=>{

        const q=($('#q')?.value||'').toLowerCase();

        $('#allTickets').innerHTML=
            tickets
                .filter(t=>[
                    t.ticket_no,
                    t.subject,
                    t.student?.name,
                    t.student?.enrollment_no
                ]
                .some(x=>
                    String(x||'')
                    .toLowerCase()
                    .includes(q)
                ))
                .map(card)
                .join('')
            ||
            empty(
                'No matching tickets',
                'Try another search term.'
            );

        bindCards();
    };

    $('#q').oninput=render;
}


/* =========================================================
   SINGLE TICKET PAGE
   ========================================================= */
async function ticketPage(id){

    const t=(await api('/api/tickets/'+id)).ticket;

    layout(
        'Ticket '+t.ticket_no,
        'Detailed request view, communication history and workflow controls.',

        `
        <div class="detail-grid">

            <div class="detail-main">

                <div class="panel">

                    <div class="ticket-top">

                        <span class="eyebrow">
                            ${esc(t.category)} · ${esc(t.priority)}
                        </span>

                        <span class="status ${slug(t.status)}">
                            ${esc(t.status)}
                        </span>

                    </div>

                    <h2>
                        ${esc(t.subject)}
                    </h2>

                    <p class="description">
                        ${esc(t.description)}
                    </p>

                    <div class="timeline">

                        ${t.timeline.map(x=>`

                            <div class="timeline-item">

                                <div class="timeline-dot"></div>

                                <div>

                                    <b>
                                        ${esc(x.action)}
                                    </b>

                                    <p>
                                        ${esc(x.note)}
                                    </p>

                                    <small>
                                        ${new Date(x.created_at).toLocaleString()}
                                        ·
                                        ${esc(x.actor_name)}
                                    </small>

                                </div>

                            </div>

                        `).join('')}

                    </div>

                </div>

                ${me.role!=='student'?actions(t):''}

            </div>

            <aside class="detail-side">

                ${studentPanel(t)}

                ${assignedPanel(t)}

            </aside>

        </div>
        `
    );
}


/* =========================================================
   STUDENT INFORMATION
   ========================================================= */
function studentPanel(t){

    const s=t.student;

    return `
        <div class="panel profile-panel">

            <div class="panel-title">
                <span>STUDENT PROFILE</span>
            </div>

            <div class="person">

                <span class="avatar lg">
                    ${initials(s.name)}
                </span>

                <div>

                    <h3>
                        ${esc(s.name)}
                    </h3>

                    <span>
                        ${esc(s.department||'')}
                    </span>

                </div>

            </div>

            <div class="contact-list">

                <div>
                    <i>⌁</i>
                    <span>
                        <small>Enrollment</small>
                        <b>${esc(s.enrollment_no||'—')}</b>
                    </span>
                </div>

                <div>
                    <i>☎</i>
                    <span>
                        <small>Mobile</small>
                        <b>${esc(s.phone||'—')}</b>
                    </span>
                </div>

                <div>
                    <i>✉</i>
                    <span>
                        <small>Email</small>
                        <b>${esc(s.email)}</b>
                    </span>
                </div>

                <div>
                    <i>⌘</i>
                    <span>
                        <small>Department</small>
                        <b>${esc(s.department||'—')}</b>
                    </span>
                </div>

            </div>

            <div class="contact-actions">

                <a
                    class="soft"
                    href="tel:${esc(s.phone||'')}">
                    ☎ Call
                </a>

                <a
                    class="soft"
                    href="mailto:${esc(s.email)}">
                    ✉ Email
                </a>

            </div>

        </div>
    `;
}


/* =========================================================
   ASSIGNED PANEL
   ========================================================= */
function assignedPanel(t){

    return `
        <div class="panel">

            <div class="panel-title">
                <span>ASSIGNED TO</span>
            </div>

            <div class="assigned">

                <span class="avatar">
                    ${initials(t.assigned?.name||'U')}
                </span>

                <div>

                    <b>
                        ${esc(t.assigned?.name||'Unassigned')}
                    </b>

                    <small>
                        ${roleLabel(t.assigned?.role||'')}
                    </small>

                </div>

            </div>

        </div>
    `;
}


/* =========================================================
   WORKFLOW ACTIONS
   ========================================================= */
function actions(t){

    return `
        <div class="panel action-panel">

            <div class="panel-title">
                <span>WORKFLOW ACTIONS</span>
            </div>

            <select id="status">

                <option ${t.status==='In Progress'?'selected':''}>
                    In Progress
                </option>

                <option ${t.status==='Resolved'?'selected':''}>
                    Resolved
                </option>

                <option ${t.status==='Closed'?'selected':''}>
                    Closed
                </option>

            </select>

            <textarea
                id="reply"
                placeholder="Write a reply or resolution note…">
            </textarea>

            <button
                class="primary wide"
                id="save">
                Save update
            </button>

            <div class="divider">
                TRANSFER TICKET
            </div>

            <select id="transfer">

                <option value="">
                    Select destination…
                </option>

                <option value="hod">
                    Head of Department
                </option>

                <option value="exam_cell">
                    Exam Cell
                </option>

                <option value="admin">
                    Administration
                </option>

                <option value="professor">
                    Another Professor
                </option>

            </select>

            <input
                id="reason"
                placeholder="Transfer reason">

            <button
                class="soft wide"
                id="transferBtn">
                Transfer ticket
            </button>

        </div>
    `;
}


/* =========================================================
   PROFILE
   ========================================================= */
async function profilePage(){

    layout(
        'My profile',
        'Your identity, contact information and academic details.',

        `
        <div class="profile-grid">

            <div class="panel profile-hero">

                <span class="avatar xl">
                    ${initials(me.name)}
                </span>

                <h2>
                    ${esc(me.name)}
                </h2>

                <p class="muted">
                    ${roleLabel(me.role)}
                </p>

                <div class="profile-badges">

                    <span>
                        ${esc(me.department||'Campus')}
                    </span>

                    ${
                        me.enrollment_no
                        ?`<span>${esc(me.enrollment_no)}</span>`
                        :''
                    }

                    ${
                        me.semester
                        ?`<span>Semester ${me.semester}</span>`
                        :''
                    }

                </div>

            </div>

            <form id="profileForm" class="panel form-panel">

                <div class="two">

                    <label>
                        Full name
                        <input
                            name="name"
                            value="${esc(me.name)}">
                    </label>

                    <label>
                        Mobile number
                        <input
                            name="phone"
                            value="${esc(me.phone)}">
                    </label>

                </div>

                <div class="two">

                    <label>
                        Email address
                        <input
                            value="${esc(me.email)}"
                            disabled>
                    </label>

                    <label>
                        Department
                        <input
                            name="department"
                            value="${esc(me.department)}">
                    </label>

                </div>

                <div class="two">

                    <label>
                        Enrollment number
                        <input
                            name="enrollment_no"
                            value="${esc(me.enrollment_no)}">
                    </label>

                    <label>
                        Semester
                        <input
                            name="semester"
                            type="number"
                            min="1"
                            max="12"
                            value="${me.semester||''}">
                    </label>

                </div>

                <button class="primary">
                    Save profile
                </button>

                <div id="profileMsg"></div>

            </form>

            <div class="panel shortcut-panel">

                <div>
                    <b>Security</b>
                    <p class="muted">
                        Update your password from the dedicated security page.
                    </p>
                </div>

                <a class="soft" href="/password">
                    Change password →
                </a>

            </div>

        </div>
        `
    );

    $('#profileForm').onsubmit=async e=>{

        e.preventDefault();

        const f=new FormData(e.target);

        try{

            me=(await api('/api/profile',{
                method:'PATCH',
                body:JSON.stringify(
                    Object.fromEntries(f)
                )
            })).user;

            $('#profileMsg').innerHTML=
                '<span class="saved">✓ Profile updated</span>';

            shell();

        }catch(x){

            $('#profileMsg').innerHTML=
                '<span class="errorline">'+
                esc(x.message)+
                '</span>';

        }
    };
}


/* =========================================================
   PASSWORD
   ========================================================= */
function passwordPage(){

    layout(
        'Change password',
        'Protect your account with a strong, unique password.',

        `
        <div class="security-grid">

            <div class="panel security-hero">

                <div class="security-icon">
                    ⌑
                </div>

                <h2>
                    Account security
                </h2>

                <p class="muted">
                    Your password is stored as a secure hash.
                    Never share it with anyone.
                </p>

                <div class="security-list">

                    <div>✓ Minimum 8 characters</div>
                    <div>✓ Current password required</div>
                    <div>✓ Session remains protected</div>

                </div>

            </div>

            <form id="pw" class="panel form-panel">

                <label>
                    Current password
                    <input
                        name="current_password"
                        type="password"
                        required
                        autocomplete="current-password">
                </label>

                <label>
                    New password
                    <input
                        name="new_password"
                        type="password"
                        required
                        minlength="8"
                        autocomplete="new-password">
                </label>

                <label>
                    Confirm new password
                    <input
                        name="confirm"
                        type="password"
                        required
                        minlength="8">
                </label>

                <button class="primary">
                    Update password
                </button>

                <div id="pwmsg"></div>

            </form>

        </div>
        `
    );

    $('#pw').onsubmit=async e=>{

        e.preventDefault();

        const f=Object.fromEntries(
            new FormData(e.target)
        );

        if(f.new_password!==f.confirm){

            return $('#pwmsg').innerHTML=
                '<span class="errorline">Passwords do not match.</span>';

        }

        try{

            await api('/api/change-password',{
                method:'POST',
                body:JSON.stringify(f)
            });

            e.target.reset();

            $('#pwmsg').innerHTML=
                '<span class="saved">✓ Password changed successfully</span>';

        }catch(x){

            $('#pwmsg').innerHTML=
                '<span class="errorline">'+
                esc(x.message)+
                '</span>';

        }
    };
}


/* =========================================================
   ADMIN ACCOUNTS
   ========================================================= */
async function accountsPage(){

    if(me.role!=='admin')
        return go('/dashboard');

    layout(
        'Manage accounts',
        'Administration workspace for creating and reviewing campus identities.',

        `
        <div class="account-layout">

            <form id="accountForm" class="panel form-panel">

                <div class="setting-icon">
                    ▤
                </div>

                <h2>
                    Create account
                </h2>

                <div class="two">

                    <label>
                        Full name
                        <input name="name" required>
                    </label>

                    <label>
                        Role

                        <select name="role">

                            <option value="student">
                                Student
                            </option>

                            <option value="professor">
                                Professor / Faculty
                            </option>

                            <option value="hod">
                                HOD
                            </option>

                            <option value="exam_cell">
                                Exam Cell
                            </option>

                            <option value="admin">
                                Administration
                            </option>

                        </select>

                    </label>

                </div>

                <div class="two">

                    <label>
                        Email
                        <input
                            name="email"
                            type="email"
                            required>
                    </label>

                    <label>
                        Mobile
                        <input name="phone">
                    </label>

                </div>

                <div class="two">

                    <label>
                        Department
                        <input name="department">
                    </label>

                    <label>
                        Semester
                        <input
                            name="semester"
                            type="number"
                            min="1"
                            max="12">
                    </label>

                </div>

                <div class="two">

                    <label>
                        Enrollment number
                        <input name="enrollment_no">
                    </label>

                    <label>
                        Temporary password
                        <input
                            name="password"
                            minlength="8"
                            required>
                    </label>

                </div>

                <button class="primary">
                    Create account
                </button>

                <div id="acctMsg"></div>

            </form>

            <div class="panel">

                <div class="panel-title">

                    <span>
                        ACCOUNT DIRECTORY
                    </span>

                    <span id="count"></span>

                </div>

                <div
                    id="accounts"
                    class="account-list">
                </div>

            </div>

        </div>
        `
    );

    const data=await api('/api/users');

    $('#count').textContent=
        data.users.length+' accounts';

    $('#accounts').innerHTML=
        data.users.map(u=>`

            <div class="account-row">

                <span class="avatar sm">
                    ${initials(u.name)}
                </span>

                <div>

                    <b>
                        ${esc(u.name)}
                    </b>

                    <small>
                        ${esc(u.email)}
                        ·
                        ${esc(u.phone||'No mobile')}
                    </small>

                </div>

                <span class="role-pill">
                    ${roleLabel(u.role)}
                </span>

            </div>

        `).join('');

    $('#accountForm').onsubmit=async e=>{

        e.preventDefault();

        try{

            await api('/api/users',{
                method:'POST',
                body:JSON.stringify(
                    Object.fromEntries(
                        new FormData(e.target)
                    )
                )
            });

            toast('Account created successfully');

            e.target.reset();

            accountsPage();

        }catch(x){

            $('#acctMsg').innerHTML=
                '<span class="errorline">'+
                esc(x.message)+
                '</span>';

        }
    };
}


/* =========================================================
   SETTINGS
   ========================================================= */
function settingsPage(){

    layout(
        'Settings',
        'Personalize your workspace and manage account shortcuts.',

        `
        <div class="settings-grid">

            <div class="setting-card">

                <div class="setting-icon">
                    ◐
                </div>

                <div>

                    <h3>
                        Appearance
                    </h3>

                    <p class="muted">
                        Switch between light and dark mode.
                    </p>

                </div>

                <div class="theme-switch">

                    <button data-t="light">
                        ☀ Light
                    </button>

                    <button data-t="dark">
                        ☾ Dark
                    </button>

                </div>

            </div>


            <div class="setting-card">

                <div class="setting-icon">
                    ◉
                </div>

                <div>

                    <h3>
                        Profile
                    </h3>

                    <p class="muted">
                        Update your contact and academic information.
                    </p>

                </div>

                <a class="soft" href="/profile">
                    Open profile →
                </a>

            </div>


            <div class="setting-card">

                <div class="setting-icon">
                    ⌑
                </div>

                <div>

                    <h3>
                        Password & security
                    </h3>

                    <p class="muted">
                        Change your account password.
                    </p>

                </div>

                <a class="soft" href="/password">
                    Security →
                </a>

            </div>


            ${
                me.role==='admin'
                ?
                `
                <div class="setting-card">

                    <div class="setting-icon">
                        ▤
                    </div>

                    <div>

                        <h3>
                            Administration
                        </h3>

                        <p class="muted">
                            Create and review campus accounts.
                        </p>

                    </div>

                    <a class="soft" href="/accounts">
                        Manage accounts →
                    </a>

                </div>
                `
                :''
            }


            <div class="setting-card">

                <div class="setting-icon">
                    ↪
                </div>

                <div>

                    <h3>
                        Sign out
                    </h3>

                    <p class="muted">
                        End your current session on this device.
                    </p>

                </div>

                <button
                    id="settingsLogout"
                    class="soft">
                    Log out
                </button>

            </div>

        </div>
        `
    );

    const cur=
        localStorage.getItem('campus-theme')||'light';

    document
        .querySelectorAll('[data-t]')
        .forEach(b=>{

            b.classList.toggle(
                'selected',
                b.dataset.t===cur
            );

            b.onclick=()=>{
                setTheme(b.dataset.t);
                settingsPage();
            };

        });

    $('#settingsLogout').onclick=async()=>{
        await api('/api/logout',{
            method:'POST'
        });

        location.href='/';
    };
}


/* =========================================================
   EMPTY STATE
   ========================================================= */
function empty(h,p){

    return `
        <div class="empty">

            <div class="empty-icon">
                ✦
            </div>

            <h3>
                ${h}
            </h3>

            <p>
                ${p}
            </p>

        </div>
    `;
}


/* =========================================================
   CREATE TICKET MODAL
   ========================================================= */
function ticketModal(){

    /* Prevent duplicate modal */
    if(document.querySelector('.modal-backdrop'))
        return;

    const wrap=document.createElement('div');

    wrap.className='modal-backdrop';

    wrap.innerHTML=`

        <form class="modal" id="ticketForm">

            <div class="modal-head">

                <div>

                    <div class="eyebrow">
                        NEW REQUEST
                    </div>

                    <h2>
                        Create support ticket
                    </h2>

                </div>

                <button
                    type="button"
                    class="soft"
                    id="close">
                    ×
                </button>

            </div>


            <label>

                Subject

                <input
                    name="subject"
                    required
                    autocomplete="off">

            </label>


            <div class="two">

                <label>

                    Category

                    <select name="category">

                        <option>Academic</option>
                        <option>Exam Cell</option>
                        <option>Fees</option>
                        <option>Technical</option>
                        <option>Library</option>
                        <option>Hostel</option>
                        <option>Administration</option>
                        <option>Other</option>

                    </select>

                </label>


                <label>

                    Priority

                    <select name="priority">

                        <option>Low</option>

                        <option selected>
                            Medium
                        </option>

                        <option>
                            High
                        </option>

                        <option>
                            Urgent
                        </option>

                    </select>

                </label>

            </div>


            <label>

                Description

                <textarea
                    name="description"
                    rows="6"
                    required>
                </textarea>

            </label>


            <button
                type="submit"
                class="primary">
                Submit ticket →
            </button>

        </form>
    `;

    document.body.appendChild(wrap);


    /* Close button */
    const closeBtn=wrap.querySelector('#close');

    if(closeBtn){

        closeBtn.onclick=()=>{
            wrap.remove();
        };

    }


    /* Click outside modal = close */
    wrap.addEventListener('click',e=>{

        if(e.target===wrap){
            wrap.remove();
        }

    });


    /* ESC key = close */
    const escHandler=e=>{

        if(e.key==='Escape'){

            wrap.remove();

            document.removeEventListener(
                'keydown',
                escHandler
            );

        }

    };

    document.addEventListener(
        'keydown',
        escHandler
    );


    /* Submit ticket */
    const form=wrap.querySelector('#ticketForm');

    form.onsubmit=async e=>{

        e.preventDefault();

        const submitBtn=form.querySelector(
            'button[type="submit"]'
        );

        try{

            submitBtn.disabled=true;

            submitBtn.textContent=
                'Creating ticket...';

            const formData=
                Object.fromEntries(
                    new FormData(form)
                );

            await api('/api/tickets',{
                method:'POST',
                body:JSON.stringify(formData)
            });

            wrap.remove();

            toast(
                'Ticket created and routed to your professor'
            );

            setTimeout(()=>{
                location.href='/tickets';
            },400);

        }catch(x){

            submitBtn.disabled=false;

            submitBtn.textContent=
                'Submit ticket →';

            toast(
                x.message||'Unable to create ticket',
                true
            );

        }

    };
}


/* =========================================================
   START APPLICATION
   ========================================================= */
boot();