import { useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeftRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  PenLine,
  Phone,
  PieChart,
  ShieldCheck,
  Sigma,
} from "lucide-react";
import { fallbackHomeData } from "./parentDemoData";
import { ParentShell } from "./ParentShell";
import type { ParentChildSummary, ParentHomeData, ParentPageAction } from "./parentTypes";
import "./parent-pages.css";

export interface ParentHomePageProps {
  data?: ParentHomeData;
  onSelectChild?: (childId: string) => ParentPageAction;
  onContactTeacher?: () => ParentPageAction;
}
function MetricCard({
  label,
  icon,
  value,
  children,
  tone,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  children: ReactNode;
  tone?: "positive";
}) {
  return (
    <article className="metric-card">
      <div className="metric-card__header">
        <span>{label}</span>
        {icon}
      </div>
      <strong className={tone === "positive" ? "metric-card__value is-positive" : "metric-card__value"}>{value}</strong>
      <div className="metric-card__detail">{children}</div>
    </article>
  );
}

function StudentAvatar({ child }: { child: ParentChildSummary }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = child.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="student-avatar-wrap">
      {child.avatarUrl && !imageFailed ? (
        <img className="student-avatar" src={child.avatarUrl} alt="" onError={() => setImageFailed(true)} />
      ) : (
        <span className="student-avatar student-avatar--fallback" aria-hidden="true">{initials}</span>
      )}

    </div>
  );
}

export function ParentHomePage({
  data = fallbackHomeData,
  onSelectChild,
  onContactTeacher,
}: ParentHomePageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedStudentId = searchParams.get("student_id") ?? data.child.id;
  const parentPath = (path: string) =>
    selectedStudentId ? `${path}${path.includes("?") ? "&" : "?"}student_id=${encodeURIComponent(selectedStudentId)}` : path;
  const pendingLeave = data.pendingLeave;
  const currentPeriod = data.currentPeriod;

  const openLeaveReview = (clarification = false) => {
    if (!pendingLeave) return;
    const params = new URLSearchParams();
    params.set("leave_id", pendingLeave.id);
    if (selectedStudentId) params.set("student_id", selectedStudentId);
    if (clarification) params.set("clarify", "1");
    void navigate(`/parent/leave?${params.toString()}`);
  };

  return (
    <ParentShell
      active="home"
      pageLabel="Home"
      child={data.child}
      onSelectChild={onSelectChild}
    >
      <div className="parent-stack home-page">
        <section className="surface-card child-status-card" aria-labelledby="child-name">
          <div className="child-status-card__identity">
            <StudentAvatar key={`${data.child.id}-${data.child.avatarUrl ?? "fallback"}`} child={data.child} />
            <div className="child-status-card__text">
              <div className="title-row">
                <h1 id="child-name">{data.child.name}</h1>
                <span className="quiet-pill">Roll #{data.child.rollNumber}</span>
              </div>
              <p>{data.child.grade} • Section {data.child.section} • {data.child.board}</p>
            </div>
            {data.sibling ? (
              <button className="sibling-button" type="button" onClick={() => void onSelectChild?.(data.sibling!.id)}>
                <ArrowLeftRight size={17} />
                <span>{data.sibling.name}</span>
              </button>
            ) : null}
          </div>
          <div className={`presence-banner${data.presence.status === "In School" ? " is-present" : " is-neutral"}`}>
            <span className="live-indicator"><span /></span>
            <strong>{data.presence.status}</strong>
            <span className="dot-divider">•</span>
            <span>{data.presence.detail}</span>
            {data.presence.status === "In School" ? <ShieldCheck size={17} /> : null}
          </div>
        </section>

        <section className="home-action-section" aria-labelledby="action-required-heading">
          <div className="section-eyebrow-row">
            <h2 id="action-required-heading">{pendingLeave ? <span className="alert-dot" /> : null}{pendingLeave ? "Action Required" : "Guardian Actions"}</h2>
            {pendingLeave ? (
              <span className="status-pill status-pill--danger">1 Pending Sign</span>
            ) : null}
          </div>
          <article className="surface-card urgent-leave-card" aria-live="polite">
            {!pendingLeave ? (
              <div className="completed-message">
                <CheckCircle2 size={23} />
                <div><strong>No guardian action required</strong><span>New leave sign-offs will appear here when the school receives them.</span></div>
              </div>
            ) : (
              <div className="urgent-leave-card__body">
                <div className="action-icon action-icon--danger"><PenLine size={23} /></div>
                <div className="urgent-leave-card__content">
                  <div className="title-row title-row--spread">
                    <h3>{pendingLeave.title}</h3>
                    <span className="time-label">{pendingLeave.submittedLabel}</span>
                  </div>
                  <p>{pendingLeave.summary} • <strong>{pendingLeave.durationLabel}</strong></p>
                  <div className="button-row">
                    <button className="button button--primary button--grow" type="button" onClick={() => openLeaveReview()}>
                      <CheckCircle2 size={17} />Review & Sign
                    </button>
                    <button className="button button--soft" type="button" onClick={() => openLeaveReview(true)}>Ask clarification</button>
                  </div>
                </div>
              </div>
            )}
          </article>
          <button className="surface-card diary-unread-card" type="button" onClick={() => navigate(parentPath("/parent/diary"))}>
            <span className="action-icon"><BookOpen size={19} /></span>
            <span><strong>{data.unreadDiaryCount > 0 ? `${data.unreadDiaryCount} Diary Sign-off${data.unreadDiaryCount === 1 ? "" : "s"}` : "No diary sign-offs pending"}</strong><small>{data.unreadDiaryCount > 0 ? `From ${data.diarySender}` : data.diarySender}</small></span>
            <ChevronRight size={20} />
          </button>
        </section>

        <section className="surface-card pulse-card" aria-labelledby="pulse-heading">
          <div className="card-heading-row">
            <h2 id="pulse-heading"><Clock3 size={20} />Today’s classes</h2>
            <span className={data.presence.status === "In School" ? "status-pill status-pill--success" : "status-pill"}><CheckCircle2 size={14} />{data.presence.status}</span>
          </div>
          {currentPeriod ? <div className="current-period">
            <div className="current-period__meta">
              <span className="period-badge">Period {currentPeriod.number}</span>
              <span>{currentPeriod.startsAt} – {currentPeriod.endsAt}</span>
              <strong>{currentPeriod.remainingLabel}</strong>
            </div>
            <div className="current-period__subject">
              <div><h3>{currentPeriod.subject} • {currentPeriod.topic}</h3><p>{currentPeriod.room} • {currentPeriod.teacher}</p></div>
              <span className="subject-icon"><Sigma size={21} /></span>
            </div>
            <div className="progress-track" aria-label={`${currentPeriod.progressPercent}% of period complete`}>
              <span style={{ width: `${currentPeriod.progressPercent}%` }} />
            </div>
          </div> : <div className="completed-message completed-message--neutral"><CalendarDays size={22} /><div><strong>No classes scheduled today</strong><span>The timetable has no periods for this date.</span></div></div>}
          <button className="parent-text-action" type="button" onClick={() => navigate(parentPath("/parent/timetable"))}>View full timetable <ChevronRight size={16} /></button>
          {data.nextPeriod ? <div className="next-period">
            <ChevronRight size={17} />
            <span>Next: <strong>Period {data.nextPeriod.number} • {data.nextPeriod.subject}</strong> ({data.nextPeriod.room})</span>
            <time>{data.nextPeriod.startsAt}</time>
          </div> : null}
        </section>

        <section aria-labelledby="metrics-heading">
          <div className="section-eyebrow-row">
            <h2 id="metrics-heading">At a glance</h2>
            <span className="section-link-label">{data.metrics.termLabel}</span>
          </div>
          <div className="metric-grid">
            <MetricCard label="Attendance" icon={<PieChart size={19} />} value={data.metrics.attendance}>
              <span className={`mini-pill${data.metrics.attendanceStatus === "On track" ? " mini-pill--success" : ""}`}>{data.metrics.attendanceStatus}</span><span>{data.metrics.threshold}</span>
            </MetricCard>
            <MetricCard label="Schedule" icon={<CalendarDays size={19} />} value={`${data.metrics.periodsToday} Periods`}>
              <span>Dismissal:</span><strong className="blue-text">{data.metrics.dismissal}</strong>
            </MetricCard>
            <MetricCard label="Homework" icon={<ClipboardList size={19} />} value={`${data.metrics.homeworkTasks} Tasks`}>
              <span className="blue-dot" /><span>{data.metrics.homeworkDetail}</span>
            </MetricCard>
            <MetricCard label="Dues Status" icon={<CheckCircle2 size={19} />} value={data.metrics.duesStatus}>
              <span>{data.metrics.duesDetail}</span>
            </MetricCard>
          </div>
        </section>

        <section aria-labelledby="shortcuts-heading">
          <div className="section-eyebrow-row"><h2 id="shortcuts-heading">Quick actions</h2></div>
          <div className="surface-card shortcut-list">
            <button type="button" disabled={!onContactTeacher} aria-disabled={!onContactTeacher} onClick={() => void onContactTeacher?.()}>
              <span className="shortcut-icon"><Phone size={19} /></span>
              <span><strong>{onContactTeacher ? "Contact Homeroom Teacher" : "Teacher contact unavailable"}</strong><small>{data.homeroomTeacher.name} • {data.homeroomTeacher.availability}</small></span>
              <ChevronRight size={21} />
            </button>
            <button type="button" onClick={() => navigate(parentPath("/parent/leave?tab=apply"))}>
              <span className="shortcut-icon"><CalendarDays size={19} /></span>
              <span><strong>Submit Future Leave Application</strong><small>Medical, family, or personal leave</small></span>
              <ChevronRight size={21} />
            </button>

          </div>
        </section>
      </div>
    </ParentShell>
  );
}
