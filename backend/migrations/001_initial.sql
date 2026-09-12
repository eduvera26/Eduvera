CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(150) NOT NULL UNIQUE,
  email varchar(254) NOT NULL,
  password_hash text NOT NULL,
  first_name varchar(150) NOT NULL,
  last_name varchar(150) NOT NULL,
  role varchar(16) NOT NULL CHECK (role IN ('student', 'parent', 'staff', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(180) NOT NULL,
  code varchar(32) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL CHECK (role IN ('student', 'guardian', 'staff', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id, role)
);
CREATE INDEX IF NOT EXISTS memberships_user_active_idx ON school_memberships(user_id, is_active);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  admission_number varchar(64) NOT NULL,
  date_of_birth date,
  blood_group varchar(8),
  emergency_contact varchar(32),
  avatar_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, admission_number)
);

CREATE TABLE IF NOT EXISTS parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  phone varchar(32) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guardian_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship varchar(16) NOT NULL CHECK (relationship IN ('mother', 'father', 'guardian')),
  is_primary boolean NOT NULL DEFAULT false,
  can_authorize_leave boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guardian_id, student_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_primary_guardian_per_student
  ON guardian_relationships(student_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year varchar(9) NOT NULL,
  name varchar(100) NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  attendance_threshold numeric(5,2) NOT NULL DEFAULT 85.00,
  is_active boolean NOT NULL DEFAULT true,
  CHECK (ends_on >= starts_on),
  UNIQUE (school_id, academic_year, name)
);

CREATE TABLE IF NOT EXISTS class_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year varchar(9) NOT NULL,
  grade varchar(16) NOT NULL,
  section varchar(16) NOT NULL,
  board varchar(100) NOT NULL DEFAULT '',
  room_number varchar(32) NOT NULL DEFAULT '',
  UNIQUE (school_id, academic_year, grade, section)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_section_id uuid NOT NULL REFERENCES class_sections(id) ON DELETE RESTRICT,
  term_id uuid NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  roll_number smallint NOT NULL CHECK (roll_number > 0),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (student_id, term_id),
  UNIQUE (class_section_id, term_id, roll_number)
);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code varchar(16) NOT NULL,
  name varchar(100) NOT NULL,
  short_name varchar(40) NOT NULL,
  color varchar(16) NOT NULL DEFAULT '#1D4ED8',
  icon varchar(40) NOT NULL DEFAULT 'book-open',
  UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS subject_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  classes_held integer NOT NULL DEFAULT 0 CHECK (classes_held >= 0),
  classes_attended integer NOT NULL DEFAULT 0 CHECK (classes_attended >= 0),
  classes_excused integer NOT NULL DEFAULT 0 CHECK (classes_excused >= 0),
  CHECK (classes_attended <= classes_held),
  UNIQUE (student_id, subject_id, term_id)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_section_id uuid NOT NULL REFERENCES class_sections(id) ON DELETE RESTRICT,
  date date NOT NULL,
  status varchar(16) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'half_day')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  remarks varchar(500) NOT NULL DEFAULT '',
  marked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
CREATE INDEX IF NOT EXISTS attendance_student_date_idx ON attendance_records(student_id, date DESC);

CREATE TABLE IF NOT EXISTS gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  direction varchar(4) NOT NULL CHECK (direction IN ('in', 'out')),
  gate varchar(80) NOT NULL,
  source varchar(32) NOT NULL DEFAULT 'rfid',
  device_reference varchar(80) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS gate_student_time_idx ON gate_events(student_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_section_id uuid NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  period_number smallint NOT NULL CHECK (period_number > 0),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  slot_type varchar(16) NOT NULL DEFAULT 'class' CHECK (slot_type IN ('class', 'break', 'activity')),
  title varchar(120) NOT NULL DEFAULT '',
  room varchar(80) NOT NULL DEFAULT '',
  teacher_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  teacher_designation varchar(120) NOT NULL DEFAULT '',
  CHECK (ends_at > starts_at),
  UNIQUE (class_section_id, term_id, weekday, period_number)
);

CREATE TABLE IF NOT EXISTS attendance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL UNIQUE REFERENCES academic_terms(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  minimum_percentage numeric(5,2) NOT NULL,
  medical_document_after_days smallint NOT NULL DEFAULT 2,
  policy_text text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  term_id uuid NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category varchar(16) NOT NULL CHECK (category IN ('medical', 'family', 'travel', 'personal')),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  reason text NOT NULL,
  status varchar(24) NOT NULL CHECK (status IN ('draft', 'pending_guardian', 'authorized', 'declined', 'school_approved', 'school_rejected', 'withdrawn')),
  submitted_at timestamptz,
  guardian_authorized_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  guardian_authorized_at timestamptz,
  decided_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  CHECK (ends_on <= starts_on + 30)
);
CREATE INDEX IF NOT EXISTS leave_student_status_idx ON leave_requests(student_id, status);

CREATE TABLE IF NOT EXISTS leave_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  original_name varchar(255) NOT NULL,
  content_type varchar(120) NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 0 AND 10485760),
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leave_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action varchar(32) NOT NULL CHECK (action IN ('submitted', 'document_added', 'clarification_requested', 'authorized', 'declined', 'approved', 'rejected', 'withdrawn')),
  from_status varchar(24) NOT NULL,
  to_status varchar(24) NOT NULL,
  note varchar(500) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_section_id uuid NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  date date NOT NULL,
  item_type varchar(16) NOT NULL CHECK (item_type IN ('note', 'homework', 'announcement', 'schedule')),
  subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
  title varchar(180) NOT NULL,
  body text NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  due_at timestamptz,
  requires_acknowledgement boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS diary_section_date_idx ON diary_items(class_section_id, date DESC);

CREATE TABLE IF NOT EXISTS diary_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES diary_items(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  acknowledged_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, student_id)
);

CREATE TABLE IF NOT EXISTS diary_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES diary_items(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL CHECK (kind IN ('attendance', 'leave', 'diary', 'general')),
  title varchar(180) NOT NULL,
  body varchar(500) NOT NULL,
  link varchar(255) NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_unread_idx ON notifications(recipient_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS school_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  label varchar(100) NOT NULL,
  name varchar(150) NOT NULL,
  phone varchar(32) NOT NULL DEFAULT '',
  email varchar(254) NOT NULL DEFAULT '',
  availability varchar(120) NOT NULL DEFAULT '',
  priority smallint NOT NULL DEFAULT 0,
  UNIQUE (school_id, label)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip_hash char(64),
  user_agent varchar(500) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action varchar(120) NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  target_type varchar(80) NOT NULL DEFAULT '',
  target_id uuid,
  request_id uuid NOT NULL,
  ip_hash char(64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_actor_time_idx ON audit_events(actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title varchar(80) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_conversation_owner_idx ON ai_conversations(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider varchar(40) NOT NULL,
  model varchar(120) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'error')),
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
