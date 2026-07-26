"""
Admin analytics dashboard for ResumeHub.

Registered from resumehub_api.register path — does not alter AI model chains.
"""

from __future__ import annotations

import datetime
import json

from flask import request


def html_escape(val):
    if val is None:
        return ""
    import html as html_mod
    return html_mod.escape(str(val))


def html_escape_js(val):
    if val is None:
        return ""
    s = str(val)
    return (s.replace("\\", "\\\\")
             .replace("`", "\\`")
             .replace("'", "\\'")
             .replace('"', '\\"')
             .replace("\n", "\\n")
             .replace("\r", "\\r")
             .replace("</", "<\\/"))





def register_admin_routes(app, *, get_db, ADMIN_SECRET, FREE_MODE, PARSE_MODELS, SALARY_MODELS, REWRITE_MODELS, oracle_ai):
    """Attach GET /admin with the same behavior as the previous inline route."""

    def admin_dashboard():
        """
        GET /admin?secret=ADMIN_SECRET
        Analytics dashboard — reads live data from SQLite.
        """
        secret = request.args.get("secret", "")
        if not ADMIN_SECRET or secret != ADMIN_SECRET:
            return "<h2 style='font-family:sans-serif;margin:40px'>401 — Unauthorized</h2>", 401

        now_iso   = datetime.datetime.utcnow().isoformat()
        today_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        auth_qs   = f"?secret={secret}" if secret else "?"

        with get_db() as db:
            # Metric counts
            total_users     = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            total_resumes   = db.execute("SELECT COUNT(*) FROM resumes").fetchone()[0]
            total_telemetry = db.execute("SELECT COUNT(*) FROM telemetry").fetchone()[0]
            telemetry_today = db.execute(
                "SELECT COUNT(*) FROM telemetry WHERE date(timestamp) = ?", (today_str,)
            ).fetchone()[0]
            total_ai_calls  = db.execute("SELECT COALESCE(SUM(count),0) FROM ai_usage").fetchone()[0]
            ai_today        = db.execute(
                "SELECT COALESCE(SUM(count),0) FROM ai_usage WHERE date = ?", (today_str,)
            ).fetchone()[0]
            dau_today       = db.execute(
                "SELECT COUNT(DISTINCT user_id) FROM telemetry WHERE event_type='dau_ping' AND date(timestamp)=?",
                (today_str,)
            ).fetchone()[0]

            # 30-day user signups trend
            signups_30d = db.execute(
                """SELECT date(created_at) as day, COUNT(*) as cnt
                   FROM users WHERE created_at > datetime('now','-30 days')
                   GROUP BY day ORDER BY day"""
            ).fetchall()

            # 14-day telemetry trend
            telem_14d = db.execute(
                """SELECT date(timestamp) as day, COUNT(*) as cnt
                   FROM telemetry WHERE timestamp > datetime('now','-14 days')
                   GROUP BY day ORDER BY day"""
            ).fetchall()

            # 14-day resumes saved trend
            resumes_14d = db.execute(
                """SELECT date(uploaded_at) as day, COUNT(*) as cnt
                   FROM resumes WHERE uploaded_at > datetime('now','-14 days')
                   GROUP BY day ORDER BY day"""
            ).fetchall()

            # 14-day DAU trend
            dau_14d = db.execute(
                """SELECT date(timestamp) as day, COUNT(DISTINCT user_id) as cnt
                   FROM telemetry WHERE event_type='dau_ping' AND timestamp > datetime('now','-14 days')
                   GROUP BY day ORDER BY day"""
            ).fetchall()

            # Top AI Users
            top_ai_users = db.execute(
                """SELECT user_id, SUM(count) as total
                   FROM ai_usage GROUP BY user_id ORDER BY total DESC LIMIT 10"""
            ).fetchall()

            # Telemetry Type Breakdown (Multi-period)
            telem_7d = db.execute(
                """SELECT event_type, COUNT(*) as cnt
                   FROM telemetry WHERE timestamp > datetime('now','-7 days')
                   GROUP BY event_type ORDER BY cnt DESC"""
            ).fetchall()

            telem_30d = db.execute(
                """SELECT event_type, COUNT(*) as cnt
                   FROM telemetry WHERE timestamp > datetime('now','-30 days')
                   GROUP BY event_type ORDER BY cnt DESC"""
            ).fetchall()

            telem_90d = db.execute(
                """SELECT event_type, COUNT(*) as cnt
                   FROM telemetry WHERE timestamp > datetime('now','-90 days')
                   GROUP BY event_type ORDER BY cnt DESC"""
            ).fetchall()

            telem_all = db.execute(
                """SELECT event_type, COUNT(*) as cnt
                   FROM telemetry GROUP BY event_type ORDER BY cnt DESC"""
            ).fetchall()

            telem_daily_events_90d = db.execute(
                """SELECT date(timestamp) as day, event_type, COUNT(*) as cnt
                   FROM telemetry
                   WHERE timestamp > datetime('now','-90 days')
                   GROUP BY day, event_type
                   ORDER BY day ASC"""
            ).fetchall()

            # Recent Users list
            recent_users = db.execute(
                """SELECT user_id, username, email, created_at, last_seen
                   FROM users ORDER BY last_seen DESC LIMIT 25"""
            ).fetchall()

            # Resumes List
            recent_resumes = db.execute(
                """SELECT r.id, r.user_id, r.filename, r.mime_type, r.uploaded_at, r.parsed_json,
                          u.username, u.email
                   FROM resumes r
                   LEFT JOIN users u ON r.user_id = u.user_id
                   ORDER BY r.uploaded_at DESC LIMIT 25"""
            ).fetchall()

            # Telemetry Log
            recent_telem = db.execute(
                """SELECT user_id, event_type, timestamp, metadata
                   FROM telemetry ORDER BY timestamp DESC LIMIT 30"""
            ).fetchall()

            # Salary Cache
            recent_salaries = db.execute(
                """SELECT job_title, company, location, tc, currency, last_updated
                   FROM salary_cache ORDER BY last_updated DESC LIMIT 25"""
            ).fetchall()

        # Prep Chart.js variables — align series onto shared label axes
        today = datetime.date.today()
        chart_30_labels = [(today - datetime.timedelta(days=i)).isoformat() for i in range(29, -1, -1)]
        signup_map = {r["day"]: r["cnt"] for r in signups_30d}
        dau_map = {r["day"]: r["cnt"] for r in dau_14d}
        signup_data = [signup_map.get(d, 0) for d in chart_30_labels]
        dau_data = [dau_map.get(d, 0) for d in chart_30_labels]

        telem_map = {r["day"]: r["cnt"] for r in telem_14d}
        res_map = {r["day"]: r["cnt"] for r in resumes_14d}
        volume_labels = sorted(set(telem_map) | set(res_map))
        telem_data = [telem_map.get(d, 0) for d in volume_labels]
        res_data = [res_map.get(d, 0) for d in volume_labels]

        # Prep JSON datasets for client-side multi-period telemetry analytics
        telem_periods_json = json.dumps({
            "7d": [{"event_type": r["event_type"], "cnt": r["cnt"]} for r in telem_7d],
            "30d": [{"event_type": r["event_type"], "cnt": r["cnt"]} for r in telem_30d],
            "90d": [{"event_type": r["event_type"], "cnt": r["cnt"]} for r in telem_90d],
            "all": [{"event_type": r["event_type"], "cnt": r["cnt"]} for r in telem_all]
        })
        telem_daily_json = json.dumps([
            {"day": r["day"], "event_type": r["event_type"], "cnt": r["cnt"]}
            for r in telem_daily_events_90d
        ])

        html_top_ai_users = ""
        if top_ai_users:
            for r in top_ai_users:
                html_top_ai_users += f"<tr><td>{html_escape(r['user_id'])}</td><td><b>{r['total']}</b></td></tr>"
        else:
            html_top_ai_users = "<tr><td colspan='2' class='empty'>No AI calls logged</td></tr>"

        html_recent_resumes = ""
        if recent_resumes:
            for r in recent_resumes:
                username_val = html_escape(r['username'] or 'Anonymous')
                email_val = html_escape(r['email'] or 'N/A')
                filename_val = html_escape(r['filename'] or 'N/A')
                mime_val = html_escape(r['mime_type'])
                uploaded_val = r['uploaded_at']
                user_id_or_username = html_escape(r['username'] or r['user_id'])
                parsed_json_val = html_escape_js(r['parsed_json'] or "{}")
                html_recent_resumes += f"<tr><td><b>{username_val}</b></td><td>{email_val}</td><td>{filename_val}</td><td>{mime_val}</td><td>{uploaded_val}</td><td><span class='clickable' onclick='openJsonModal(\"Parsed JSON: {user_id_or_username}\",\"{parsed_json_val}\")'>View JSON</span></td></tr>"
        else:
            html_recent_resumes = "<tr><td colspan='6' class='empty'>No resumes uploaded yet</td></tr>"

        html_recent_salaries = ""
        if recent_salaries:
            for r in recent_salaries:
                title_val = html_escape(r['job_title'] or 'N/A')
                company_val = html_escape(r['company'] or 'N/A')
                loc_val = html_escape(r['location'] or 'N/A')
                tc_val = html_escape(r['tc'])
                curr_val = html_escape(r['currency'])
                updated_val = r['last_updated']
                html_recent_salaries += f"<tr><td><b>{title_val}</b></td><td>{company_val}</td><td>{loc_val}</td><td><span class='badge bg'>{tc_val}</span></td><td><b>{curr_val}</b></td><td>{updated_val}</td></tr>"
        else:
            html_recent_salaries = "<tr><td colspan='6' class='empty'>No salary cache data</td></tr>"

        html_recent_telem = ""
        if recent_telem:
            for r in recent_telem:
                uid_val = html_escape(r['user_id'])
                ev_val = html_escape(r['event_type'])
                ts_val = r['timestamp']
                meta_raw = r['metadata'] or ''
                meta_val = html_escape(meta_raw)
                meta_js = html_escape_js(meta_raw)
                is_error = 'fail' in (r['event_type'] or '') or 'error' in (r['event_type'] or '')
                badge_cls = 'badge badge-red' if is_error else 'badge bo'
                view_action = ""
                meta_stripped = meta_raw.strip()
                has_payload = meta_stripped and meta_stripped not in ('{}', 'null', 'None')
                if has_payload:
                    has_html = 'cardHtml' in meta_stripped
                    link_label = '[View Card HTML]' if has_html else '[View Details]'
                    view_action = f" <span class='clickable' onclick='openJsonModal(\"Telemetry Details: {ev_val}\",\"{meta_js}\")'>{link_label}</span>"
                # Truncate inline metadata so the table stays readable
                meta_preview = meta_val if len(meta_val) <= 120 else meta_val[:117] + '...'
                html_recent_telem += f"<tr><td>{uid_val}</td><td><span class='{badge_cls}'>{ev_val}</span></td><td>{ts_val}</td><td style='font-family:monospace;font-size:10px'>{meta_preview}{view_action}</td></tr>"
        else:
            html_recent_telem = "<tr><td colspan='4' class='empty'>No activity logged</td></tr>"

        html_recent_users = ""
        if recent_users:
            for r in recent_users:
                uid_val = html_escape(r['user_id'])
                uname_val = html_escape(r['username'] or 'Anonymous')
                email_val = html_escape(r['email'] or 'N/A')
                created_val = r['created_at']
                seen_val = r['last_seen']
                html_recent_users += f"<tr><td>{uid_val}</td><td><b>{uname_val}</b></td><td>{email_val}</td><td>{created_val}</td><td>{seen_val}</td></tr>"
        else:
            html_recent_users = "<tr><td colspan='5' class='empty'>No users registered</td></tr>"

        suspended = []
        try:
            with oracle_ai.get_shared_db() as sdb:
                now_iso = datetime.datetime.utcnow().isoformat()
                rows = sdb.execute("SELECT model_id, resume_time FROM model_exhaustion WHERE resume_time > ?", (now_iso,)).fetchall()
                for r in rows:
                    res_dt = datetime.datetime.fromisoformat(r["resume_time"])
                    suspended.append(f"{r['model_id']} (until {res_dt.strftime('%H:%M:%S UTC')})")
        except Exception as e:
            print(f"[ERR] Failed to get suspensions: {e}")
        exhausted_display = ", ".join(suspended) or "none"
        model_chain = (
            "<b>Salary:</b> " + " &rarr; ".join(m["id"].split("/")[-1] for m in SALARY_MODELS) + "<br>" +
            "<b>Rewrite:</b> " + " &rarr; ".join(m["id"].split("/")[-1] for m in REWRITE_MODELS) + "<br>" +
            "<b>Parser:</b> " + " &rarr; ".join(m["id"].split("/")[-1] for m in PARSE_MODELS)
        )
        free_mode_display = "✓ ON — all users pro" if FREE_MODE else "✗ OFF — gating active"

        html = f"""<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>ResumeHub AI — Analytics</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
      :root {{
        --bg:#08070d;--card:#100f1c;--border:#1e1b30;
        --text:#f3f4f6;--muted:#8b8fa3;
        --accent:#8b5cf6;--green:#10b981;--blue:#3b82f6;--orange:#f59e0b;--red:#ef4444;
      }}
      *{{box-sizing:border-box;margin:0;padding:0;}}
      body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            background:var(--bg);color:var(--text);padding:24px;font-size:14px;}}
      h1{{font-size:22px;font-weight:700;margin-bottom:4px;background: linear-gradient(135deg, #a78bfa, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;}}
      h2{{font-size:13px;font-weight:700;margin:28px 0 14px;color:var(--muted);
          text-transform:uppercase;letter-spacing:.06em;}}
      .subtitle{{color:var(--muted);font-size:12px;margin-bottom:24px;}}
      .cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px;}}
      .card{{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;box-shadow: 0 4px 12px rgba(0,0,0,0.3);}}
      .card-label{{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;}}
      .card-value{{font-size:24px;font-weight:700;}}
      .card-value.accent{{color:var(--accent);}} .card-value.green{{color:var(--green);}}
      .card-value.blue{{color:var(--blue);}} .card-value.orange{{color:var(--orange);}} .card-value.red{{color:var(--red);}}
      .card-sub{{color:var(--muted);font-size:10px;margin-top:3px;}}
      .g2{{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}}
      @media(max-width:800px){{.g2{{grid-template-columns:1fr;}}}}
      .chart-box{{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;box-shadow: 0 4px 12px rgba(0,0,0,0.3);}}
      .chart-title{{font-size:12px;font-weight:600;margin-bottom:10px;color:var(--muted);text-transform:uppercase;}}
      .section{{background:var(--card);border:1px solid var(--border);border-radius:10px;
                padding:16px;margin-bottom:14px;overflow:hidden;box-shadow: 0 4px 12px rgba(0,0,0,0.3);}}
      .section-title{{font-size:12px;font-weight:600;margin-bottom:10px;color:var(--muted);text-transform:uppercase;}}
      .tw{{overflow-x:auto;max-height: 400px; overflow-y: auto;}}
      table{{width:100%;border-collapse:collapse;font-size:11px;}}
      th{{color:var(--muted);text-align:left;padding:7px 10px;font-weight:600;
          border-bottom:1px solid var(--border);white-space:nowrap;}}
      td{{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:top;
          max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}}
      tr:last-child td{{border-bottom:none;}}
      tr:hover td {{background: rgba(255,255,255,0.02);}}
      .badge{{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;}}
      .bp{{background:rgba(139, 92, 246, 0.2);color:#c084fc;border:1px solid rgba(139, 92, 246, 0.4);}}
      .bg{{background:rgba(16, 185, 129, 0.2);color:#34d399;border:1px solid rgba(16, 185, 129, 0.4);}}
      .bo{{background:rgba(245, 158, 11, 0.2);color:#fbbf24;border:1px solid rgba(245, 158, 11, 0.4);}}
      .empty{{color:var(--muted);font-size:11px;padding:12px 0;text-align:center;}}
      .clickable{{cursor:pointer;color:var(--accent);text-decoration:underline dotted;font-weight:600;}}
      #lhModal{{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;
                align-items:center;justify-content:center;backdrop-filter:blur(4px);}}
      #lhModal.open{{display:flex;}}
      #lhModalBox{{background:#121124;border:1px solid var(--border);border-radius:10px;
                    padding:28px 24px 20px;max-width:720px;width:92%;max-height:80vh;
                    overflow-y:auto;position:relative;box-shadow:0 10px 30px rgba(0,0,0,0.5);}}
      #lhModalLabel{{font-size:12px;font-weight:700;letter-spacing:.05em;
                      text-transform:uppercase;color:var(--accent);margin-bottom:12px;}}
      #lhModalText{{white-space:pre-wrap;word-break:break-word;font-size:12px;
                     color:#e2e8f0;margin:0;font-family:monospace;line-height:1.6;background:#090912;padding:14px;border-radius:6px;border:1px solid var(--border);}}
      #lhModalClose{{position:absolute;top:14px;right:16px;background:none;border:none;
                     color:var(--muted);font-size:22px;cursor:pointer;line-height:1;}}
      .infobar{{background:#1e2d40;border:1px solid var(--border);border-radius:8px;
                padding:9px 14px;font-size:11px;color:var(--muted);margin-bottom:18px;word-break:break-all;}}
      .infobar b{{color:var(--text);}}
      .btn-group {{display:inline-flex;gap:4px;background:rgba(255,255,255,0.03);border:1px solid var(--border);padding:3px;border-radius:6px;}}
      .btn-tab {{background:transparent;border:none;color:var(--muted);padding:4px 10px;font-size:11px;font-weight:600;border-radius:4px;cursor:pointer;transition:all 0.2s ease;}}
      .btn-tab.active {{background:var(--accent);color:#fff;}}
      .badge-red {{background:rgba(239, 68, 68, 0.2);color:#fca5a5;border:1px solid rgba(239, 68, 68, 0.4);}}
    </style>
    </head>
    <body>
    <div id="lhModal" onclick="if(event.target===this)closeLHModal()">
      <div id="lhModalBox">
        <button id="lhModalClose" onclick="closeLHModal()">&#x2715;</button>
        <div id="lhModalLabel"></div>
        <pre id="lhModalText"></pre>
      </div>
    </div>
    <h1>ResumeHub AI Analytics</h1>
    <p class="subtitle">Live System Analytics · SQLite ·
      <a href="{auth_qs}" style="color:var(--accent);text-decoration:none">Refresh</a> ·
      {datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}</p>

    <div class="infobar">
      <b>FREE_MODE:</b> {free_mode_display}
      &nbsp;|&nbsp;
      <b>Chain:</b> {model_chain}
      &nbsp;|&nbsp;
      <b>Exhausted:</b> {exhausted_display}
    </div>

    <div class="cards">
      <div class="card">
        <div class="card-label">Total Users</div>
        <div class="card-value accent">{total_users}</div>
        <div class="card-sub">all-time installs</div>
      </div>
      <div class="card">
        <div class="card-label">Saved Resumes</div>
        <div class="card-value green">{total_resumes}</div>
        <div class="card-sub">parsed & backup</div>
      </div>
      <div class="card">
        <div class="card-label">DAU Today</div>
        <div class="card-value blue">{dau_today}</div>
        <div class="card-sub">unique active users</div>
      </div>
      <div class="card">
        <div class="card-label">AI Calls Today</div>
        <div class="card-value orange">{ai_today}</div>
        <div class="card-sub">limit-monitored</div>
      </div>
      <div class="card">
        <div class="card-label">Total AI Calls</div>
        <div class="card-value red">{total_ai_calls}</div>
        <div class="card-sub">cumulative load</div>
      </div>
    </div>
 
    <div class="g2">
      <div class="chart-box">
        <div class="chart-title">DAU & Signups Trend (Last 30 Days)</div>
        <canvas id="signupChart" style="max-height:220px"></canvas>
      </div>
      <div class="chart-box">
        <div class="chart-title">Action & Parsing Volume (Last 14 Days)</div>
        <canvas id="volumeChart" style="max-height:220px"></canvas>
      </div>
    </div>
 
    <div class="g2">
      <div class="section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div class="section-title" style="margin-bottom:0">Telemetry Event Breakdown <span id="telemPeriodBadge" class="badge bp">7 Days</span></div>
          <div class="btn-group">
            <button class="btn-tab active" onclick="setTelemPeriod('7d', this)">7 Days</button>
            <button class="btn-tab" onclick="setTelemPeriod('30d', this)">30 Days</button>
            <button class="btn-tab" onclick="setTelemPeriod('90d', this)">90 Days</button>
            <button class="btn-tab" onclick="setTelemPeriod('all', this)">All Time</button>
          </div>
        </div>
        <div id="telemTrendSummary" style="font-size:11px;color:var(--muted);margin-bottom:10px;"></div>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody id="telemBreakdownBody">
            </tbody>
          </table>
        </div>
      </div>
 
      <div class="section">
        <div class="section-title">Extraction Errors Trend (90 Days)</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">Daily <code>ui_extraction_failed</code> count — use this to see if errors are rising or dropping</div>
        <canvas id="errorTrendChart" style="max-height:260px"></canvas>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Top AI Usage Users</div>
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Total AI Calls</th>
            </tr>
          </thead>
          <tbody>
            {html_top_ai_users}
          </tbody>
        </table>
      </div>
    </div>
 
    <div class="section">
      <div class="section-title">Recent Uploaded Resumes ({len(recent_resumes)})</div>
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>User Name</th>
              <th>Email</th>
              <th>File Name</th>
              <th>MIME Type</th>
              <th>Uploaded At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {html_recent_resumes}
          </tbody>
        </table>
      </div>
    </div>
 
    <div class="section">
      <div class="section-title">Recent Salary Estimates Cache ({len(recent_salaries)})</div>
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Company</th>
              <th>Location</th>
              <th>Compensation Range</th>
              <th>Currency</th>
              <th>Cached At</th>
            </tr>
          </thead>
          <tbody>
            {html_recent_salaries}
          </tbody>
        </table>
      </div>
    </div>
 
    <div class="section">
      <div class="section-title">Recent Activity Log (Telemetry)</div>
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Event Type</th>
              <th>Timestamp</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {html_recent_telem}
          </tbody>
        </table>
      </div>
    </div>
 
    <div class="section">
      <div class="section-title">Recent Registered Users</div>
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Extracted Name</th>
              <th>Extracted Email</th>
              <th>First Seen</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {html_recent_users}
          </tbody>
        </table>
      </div>
    </div>
 
    <script>
      const telemPeriods = {telem_periods_json};
      const telemDaily = {telem_daily_json};

      function countFailures(items) {{
        return (items || [])
          .filter(r => (r.event_type || '').includes('fail') || (r.event_type || '').includes('error'))
          .reduce((sum, r) => sum + (r.cnt || 0), 0);
      }}

      function renderTelemBreakdown(periodKey) {{
        const tbody = document.getElementById('telemBreakdownBody');
        const badge = document.getElementById('telemPeriodBadge');
        const summary = document.getElementById('telemTrendSummary');
        if (!tbody) return;

        const labels = {{ '7d': '7 Days', '30d': '30 Days', '90d': '90 Days', 'all': 'All Time' }};
        if (badge) badge.textContent = labels[periodKey] || periodKey;

        const items = telemPeriods[periodKey] || [];
        if (items.length === 0) {{
          tbody.innerHTML = "<tr><td colspan='2' class='empty'>No telemetry recorded for this period</td></tr>";
          if (summary) summary.textContent = '';
          return;
        }}

        let html = "";
        items.forEach(r => {{
          const isError = r.event_type.includes('fail') || r.event_type.includes('error');
          const badgeClass = isError ? 'badge badge-red' : 'badge bp';
          html += `<tr><td><span class="${{badgeClass}}">${{r.event_type}}</span></td><td><b>${{r.cnt.toLocaleString()}}</b></td></tr>`;
        }});
        tbody.innerHTML = html;

        if (summary) {{
          const fail7 = countFailures(telemPeriods['7d']);
          const fail30 = countFailures(telemPeriods['30d']);
          const fail90 = countFailures(telemPeriods['90d']);
          const avg7of30 = fail30 / 4.2857; // ~30/7
          let trendNote = 'stable vs monthly pace';
          let trendColor = 'var(--muted)';
          if (fail7 > avg7of30 * 1.15) {{ trendNote = '↑ errors rising vs monthly pace'; trendColor = '#fca5a5'; }}
          else if (fail7 < avg7of30 * 0.85) {{ trendNote = '↓ errors dropping vs monthly pace'; trendColor = '#6ee7b7'; }}
          summary.innerHTML = `Failures — 7d: <b style="color:var(--text)">${{fail7.toLocaleString()}}</b> · 30d: <b style="color:var(--text)">${{fail30.toLocaleString()}}</b> · 90d: <b style="color:var(--text)">${{fail90.toLocaleString()}}</b> · <span style="color:${{trendColor}}">${{trendNote}}</span>`;
        }}
      }}

      function setTelemPeriod(periodKey, btnEl) {{
        if (btnEl && btnEl.parentElement) {{
          btnEl.parentElement.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
          btnEl.classList.add('active');
        }}
        renderTelemBreakdown(periodKey);
      }}

      setTimeout(() => renderTelemBreakdown('7d'), 50);

      function openJsonModal(title, jsonText) {{
        document.getElementById('lhModalLabel').textContent = title;
        try {{
          const parsed = JSON.parse(jsonText);
          if (parsed && typeof parsed === 'object' && parsed.cardHtml) {{
            const {{ cardHtml, ...rest }} = parsed;
            const metaBlock = JSON.stringify(rest, null, 2);
            document.getElementById('lhModalText').textContent =
              metaBlock + '\\n\\n----- Card HTML -----\\n' + cardHtml;
          }} else {{
            document.getElementById('lhModalText').textContent = JSON.stringify(parsed, null, 2);
          }}
        }} catch(e) {{
          document.getElementById('lhModalText').textContent = jsonText;
        }}
        document.getElementById('lhModal').classList.add('open');
      }}
      function closeLHModal() {{
        document.getElementById('lhModal').classList.remove('open');
      }}
 
      // ── Charts Setup ──
      const ctxSignup = document.getElementById('signupChart').getContext('2d');
      new Chart(ctxSignup, {{
        type: 'line',
        data: {{
          labels: {json.dumps(chart_30_labels)},
          datasets: [
            {{
              label: 'New Registrations',
              data: {json.dumps(signup_data)},
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              fill: true,
              tension: 0.3,
              borderWidth: 2
            }},
            {{
              label: 'Daily Active Users (DAU)',
              data: {json.dumps(dau_data)},
              borderColor: '#3b82f6',
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              tension: 0.3,
              borderWidth: 2
            }}
          ]
        }},
        options: {{
          responsive: true,
          scales: {{
            y: {{ grid: {{ color: '#1e1b30' }}, ticks: {{ color: '#8b8fa3' }} }},
            x: {{ grid: {{ display: false }}, ticks: {{ color: '#8b8fa3' }} }}
          }},
          plugins: {{ legend: {{ labels: {{ color: '#f3f4f6' }} }} }}
        }}
      }});
 
      const ctxVolume = document.getElementById('volumeChart').getContext('2d');
      new Chart(ctxVolume, {{
        type: 'bar',
        data: {{
          labels: {json.dumps(volume_labels)},
          datasets: [
            {{
              label: 'Telemetry Events',
              data: {json.dumps(telem_data)},
              backgroundColor: '#3b82f6',
              borderRadius: 4
            }},
            {{
              label: 'Resumes Saved',
              data: {json.dumps(res_data)},
              backgroundColor: '#10b981',
              borderRadius: 4
            }}
          ]
        }},
        options: {{
          responsive: true,
          scales: {{
            y: {{ grid: {{ color: '#1e1b30' }}, ticks: {{ color: '#8b8fa3' }} }},
            x: {{ grid: {{ display: false }}, ticks: {{ color: '#8b8fa3' }} }}
          }},
          plugins: {{ legend: {{ labels: {{ color: '#f3f4f6' }} }} }}
        }}
      }});

      // Daily ui_extraction_failed trend (90d)
      (function renderErrorTrend() {{
        const canvas = document.getElementById('errorTrendChart');
        if (!canvas) return;
        const byDay = {{}};
        (telemDaily || []).forEach(row => {{
          if (row.event_type === 'ui_extraction_failed') {{
            byDay[row.day] = (byDay[row.day] || 0) + (row.cnt || 0);
          }}
        }});
        const days = Object.keys(byDay).sort();
        const values = days.map(d => byDay[d]);
        new Chart(canvas.getContext('2d'), {{
          type: 'line',
          data: {{
            labels: days,
            datasets: [{{
              label: 'ui_extraction_failed',
              data: values,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              fill: true,
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 2
            }}]
          }},
          options: {{
            responsive: true,
            scales: {{
              y: {{ beginAtZero: true, grid: {{ color: '#1e1b30' }}, ticks: {{ color: '#8b8fa3' }} }},
              x: {{ grid: {{ display: false }}, ticks: {{ color: '#8b8fa3', maxTicksLimit: 12 }} }}
            }},
            plugins: {{ legend: {{ labels: {{ color: '#f3f4f6' }} }} }}
          }}
        }});
      }})();
    </script>
    </body>
    </html>"""
        return html

    app.add_url_rule("/admin", view_func=admin_dashboard, methods=["GET"])
