--
-- PostgreSQL database dump
--

\restrict VOoUimZ7Gy7PIV4esbLTRfhiaxCTnmdEGw9QA5rtmfGqJUfSWa9JBZ1kmFT6z5n

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id bigint NOT NULL,
    user_id bigint,
    entity_type character varying(50) NOT NULL,
    entity_id bigint,
    action character varying(50) NOT NULL,
    details jsonb NOT NULL,
    ip_address character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_logs_id_seq OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: ai_insights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_insights (
    id bigint NOT NULL,
    task_id bigint,
    employee_id bigint,
    insight_category character varying(40) NOT NULL,
    title character varying(200) NOT NULL,
    insight_text text NOT NULL,
    recommended_action text NOT NULL,
    supporting_data jsonb NOT NULL,
    review_status character varying(30) NOT NULL,
    reviewed_by_user_id bigint,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_insights OWNER TO postgres;

--
-- Name: ai_insights_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_insights_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_insights_id_seq OWNER TO postgres;

--
-- Name: ai_insights_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_insights_id_seq OWNED BY public.ai_insights.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: confirmation_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.confirmation_records (
    id bigint NOT NULL,
    probation_record_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    confirmation_due_date date NOT NULL,
    effective_confirmation_date date,
    approved_by_manager_id bigint,
    approved_by_hr_id bigint,
    confirmation_letter_issued boolean NOT NULL,
    status character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.confirmation_records OWNER TO postgres;

--
-- Name: confirmation_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.confirmation_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.confirmation_records_id_seq OWNER TO postgres;

--
-- Name: confirmation_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.confirmation_records_id_seq OWNED BY public.confirmation_records.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id bigint NOT NULL,
    department_code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    head_of_department_id bigint,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.departments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: document_requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_requirements (
    id bigint NOT NULL,
    requirement_code character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    lifecycle_stage character varying(40) NOT NULL,
    is_mandatory boolean NOT NULL,
    file_format_allowed character varying(50) NOT NULL,
    description text,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.document_requirements OWNER TO postgres;

--
-- Name: document_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_requirements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_requirements_id_seq OWNER TO postgres;

--
-- Name: document_requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_requirements_id_seq OWNED BY public.document_requirements.id;


--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_documents (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    requirement_id bigint NOT NULL,
    document_name character varying(200) NOT NULL,
    file_path character varying(500) NOT NULL,
    submission_date date NOT NULL,
    status character varying(30) NOT NULL,
    verified_by_id bigint,
    verification_notes text,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employee_documents OWNER TO postgres;

--
-- Name: employee_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_documents_id_seq OWNER TO postgres;

--
-- Name: employee_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_documents_id_seq OWNED BY public.employee_documents.id;


--
-- Name: employee_lifecycle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_lifecycle (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    current_stage character varying(40) NOT NULL,
    stage_start_date date NOT NULL,
    stage_target_date date NOT NULL,
    stage_status character varying(30) NOT NULL,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employee_lifecycle OWNER TO postgres;

--
-- Name: employee_lifecycle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_lifecycle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_lifecycle_id_seq OWNER TO postgres;

--
-- Name: employee_lifecycle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_lifecycle_id_seq OWNED BY public.employee_lifecycle.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id bigint NOT NULL,
    employee_code character varying(20) NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    email character varying(150) NOT NULL,
    phone_number character varying(25) NOT NULL,
    department_id bigint NOT NULL,
    designation character varying(100) NOT NULL,
    location character varying(50) NOT NULL,
    employment_status character varying(30) NOT NULL,
    date_of_joining date NOT NULL,
    manager_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employees_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_id_seq OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: escalations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.escalations (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    escalated_by_user_id bigint NOT NULL,
    escalated_to_user_id bigint NOT NULL,
    escalation_level integer NOT NULL,
    reason text NOT NULL,
    status character varying(30) NOT NULL,
    resolved_at timestamp with time zone,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.escalations OWNER TO postgres;

--
-- Name: escalations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.escalations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.escalations_id_seq OWNER TO postgres;

--
-- Name: escalations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.escalations_id_seq OWNED BY public.escalations.id;


--
-- Name: follow_ups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.follow_ups (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    initiator_user_id bigint NOT NULL,
    target_user_id bigint NOT NULL,
    follow_up_date date NOT NULL,
    notes text NOT NULL,
    response_received boolean NOT NULL,
    response_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.follow_ups OWNER TO postgres;

--
-- Name: follow_ups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.follow_ups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.follow_ups_id_seq OWNER TO postgres;

--
-- Name: follow_ups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.follow_ups_id_seq OWNED BY public.follow_ups.id;


--
-- Name: ml_predictions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ml_predictions (
    id bigint NOT NULL,
    task_snapshot_id bigint NOT NULL,
    task_id bigint NOT NULL,
    model_version character varying(50) NOT NULL,
    predicted_delay_probability numeric(5,4) NOT NULL,
    predicted_label integer NOT NULL,
    confidence_score numeric(5,4) NOT NULL,
    prediction_timestamp timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ml_predictions OWNER TO postgres;

--
-- Name: ml_predictions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ml_predictions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ml_predictions_id_seq OWNER TO postgres;

--
-- Name: ml_predictions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ml_predictions_id_seq OWNED BY public.ml_predictions.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    task_id bigint,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    notification_type character varying(30) NOT NULL,
    is_read boolean NOT NULL,
    read_at timestamp with time zone,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: offboarding_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offboarding_records (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    resignation_date date NOT NULL,
    last_working_day date NOT NULL,
    exit_interview_completed boolean NOT NULL,
    asset_recovery_status character varying(30) NOT NULL,
    kt_status character varying(30) NOT NULL,
    clearance_status character varying(30) NOT NULL,
    overall_status character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.offboarding_records OWNER TO postgres;

--
-- Name: offboarding_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.offboarding_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.offboarding_records_id_seq OWNER TO postgres;

--
-- Name: offboarding_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.offboarding_records_id_seq OWNED BY public.offboarding_records.id;


--
-- Name: onboarding_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.onboarding_records (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    start_date date NOT NULL,
    target_completion_date date NOT NULL,
    actual_completion_date date,
    buddy_id bigint,
    it_asset_status character varying(30) NOT NULL,
    bgv_status character varying(30) NOT NULL,
    orientation_completed boolean NOT NULL,
    overall_status character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.onboarding_records OWNER TO postgres;

--
-- Name: onboarding_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.onboarding_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.onboarding_records_id_seq OWNER TO postgres;

--
-- Name: onboarding_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.onboarding_records_id_seq OWNED BY public.onboarding_records.id;


--
-- Name: performance_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.performance_reviews (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    review_cycle character varying(30) NOT NULL,
    reviewer_id bigint NOT NULL,
    self_review_status character varying(30) NOT NULL,
    manager_review_status character varying(30) NOT NULL,
    rating numeric(3,2),
    review_submission_deadline date NOT NULL,
    completion_date date,
    status character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.performance_reviews OWNER TO postgres;

--
-- Name: performance_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.performance_reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.performance_reviews_id_seq OWNER TO postgres;

--
-- Name: performance_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.performance_reviews_id_seq OWNED BY public.performance_reviews.id;


--
-- Name: probation_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.probation_records (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    probation_start_date date NOT NULL,
    probation_end_date date NOT NULL,
    extended_end_date date,
    extension_reason text,
    manager_feedback text,
    hr_evaluation text,
    status character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.probation_records OWNER TO postgres;

--
-- Name: probation_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.probation_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.probation_records_id_seq OWNER TO postgres;

--
-- Name: probation_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.probation_records_id_seq OWNED BY public.probation_records.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    role_code character varying(30) NOT NULL,
    role_name character varying(100) NOT NULL,
    description text,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: task_dependencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_dependencies (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    prerequisite_task_id bigint NOT NULL,
    dependency_type character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_no_self_dependency CHECK ((task_id <> prerequisite_task_id))
);


ALTER TABLE public.task_dependencies OWNER TO postgres;

--
-- Name: task_dependencies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_dependencies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_dependencies_id_seq OWNER TO postgres;

--
-- Name: task_dependencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_dependencies_id_seq OWNED BY public.task_dependencies.id;


--
-- Name: task_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_snapshots (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    snapshot_timestamp timestamp with time zone NOT NULL,
    task_category character varying(40) NOT NULL,
    days_remaining integer NOT NULL,
    current_status character varying(30) NOT NULL,
    reminder_count integer NOT NULL,
    owner_previous_delay_rate numeric(5,4) NOT NULL,
    owner_current_workload integer NOT NULL,
    dependency_status character varying(30) NOT NULL,
    task_priority character varying(20) NOT NULL,
    is_eligible_for_prediction boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_snapshots OWNER TO postgres;

--
-- Name: task_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_snapshots_id_seq OWNER TO postgres;

--
-- Name: task_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_snapshots_id_seq OWNED BY public.task_snapshots.id;


--
-- Name: task_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_status_history (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    old_status character varying(30) NOT NULL,
    new_status character varying(30) NOT NULL,
    old_owner_id bigint,
    new_owner_id bigint,
    old_due_date date,
    new_due_date date,
    changed_by_user_id bigint NOT NULL,
    change_reason text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_status_history OWNER TO postgres;

--
-- Name: task_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_status_history_id_seq OWNER TO postgres;

--
-- Name: task_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_status_history_id_seq OWNED BY public.task_status_history.id;


--
-- Name: task_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_templates (
    id bigint NOT NULL,
    template_code character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    category character varying(40) NOT NULL,
    default_priority character varying(20) NOT NULL,
    estimated_duration_days integer NOT NULL,
    default_role_code character varying(30) NOT NULL,
    description text,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_templates OWNER TO postgres;

--
-- Name: task_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_templates_id_seq OWNER TO postgres;

--
-- Name: task_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_templates_id_seq OWNED BY public.task_templates.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id bigint NOT NULL,
    task_code character varying(50) NOT NULL,
    template_id bigint,
    employee_id bigint NOT NULL,
    owner_id bigint NOT NULL,
    category character varying(40) NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    priority character varying(20) NOT NULL,
    status character varying(30) NOT NULL,
    due_date date NOT NULL,
    start_date date,
    completed_at timestamp with time zone,
    deadline_extension_count integer NOT NULL,
    last_deadline_change_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    employee_id bigint,
    email character varying(150) NOT NULL,
    full_name character varying(150) NOT NULL,
    role_id bigint NOT NULL,
    is_active boolean NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: ai_insights id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_insights ALTER COLUMN id SET DEFAULT nextval('public.ai_insights_id_seq'::regclass);


--
-- Name: confirmation_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.confirmation_records ALTER COLUMN id SET DEFAULT nextval('public.confirmation_records_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: document_requirements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_requirements ALTER COLUMN id SET DEFAULT nextval('public.document_requirements_id_seq'::regclass);


--
-- Name: employee_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents ALTER COLUMN id SET DEFAULT nextval('public.employee_documents_id_seq'::regclass);


--
-- Name: employee_lifecycle id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_lifecycle ALTER COLUMN id SET DEFAULT nextval('public.employee_lifecycle_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: escalations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escalations ALTER COLUMN id SET DEFAULT nextval('public.escalations_id_seq'::regclass);


--
-- Name: follow_ups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups ALTER COLUMN id SET DEFAULT nextval('public.follow_ups_id_seq'::regclass);


--
-- Name: ml_predictions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ml_predictions ALTER COLUMN id SET DEFAULT nextval('public.ml_predictions_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: offboarding_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offboarding_records ALTER COLUMN id SET DEFAULT nextval('public.offboarding_records_id_seq'::regclass);


--
-- Name: onboarding_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_records ALTER COLUMN id SET DEFAULT nextval('public.onboarding_records_id_seq'::regclass);


--
-- Name: performance_reviews id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.performance_reviews ALTER COLUMN id SET DEFAULT nextval('public.performance_reviews_id_seq'::regclass);


--
-- Name: probation_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.probation_records ALTER COLUMN id SET DEFAULT nextval('public.probation_records_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: task_dependencies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies ALTER COLUMN id SET DEFAULT nextval('public.task_dependencies_id_seq'::regclass);


--
-- Name: task_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_snapshots ALTER COLUMN id SET DEFAULT nextval('public.task_snapshots_id_seq'::regclass);


--
-- Name: task_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_status_history ALTER COLUMN id SET DEFAULT nextval('public.task_status_history_id_seq'::regclass);


--
-- Name: task_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_templates ALTER COLUMN id SET DEFAULT nextval('public.task_templates_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_insights ai_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_insights
    ADD CONSTRAINT ai_insights_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: confirmation_records confirmation_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.confirmation_records
    ADD CONSTRAINT confirmation_records_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: document_requirements document_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_requirements
    ADD CONSTRAINT document_requirements_pkey PRIMARY KEY (id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_lifecycle employee_lifecycle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_lifecycle
    ADD CONSTRAINT employee_lifecycle_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: escalations escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_pkey PRIMARY KEY (id);


--
-- Name: follow_ups follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_pkey PRIMARY KEY (id);


--
-- Name: ml_predictions ml_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ml_predictions
    ADD CONSTRAINT ml_predictions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offboarding_records offboarding_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offboarding_records
    ADD CONSTRAINT offboarding_records_pkey PRIMARY KEY (id);


--
-- Name: onboarding_records onboarding_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_records
    ADD CONSTRAINT onboarding_records_pkey PRIMARY KEY (id);


--
-- Name: performance_reviews performance_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.performance_reviews
    ADD CONSTRAINT performance_reviews_pkey PRIMARY KEY (id);


--
-- Name: probation_records probation_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.probation_records
    ADD CONSTRAINT probation_records_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: task_dependencies task_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_pkey PRIMARY KEY (id);


--
-- Name: task_snapshots task_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_snapshots
    ADD CONSTRAINT task_snapshots_pkey PRIMARY KEY (id);


--
-- Name: task_status_history task_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_status_history
    ADD CONSTRAINT task_status_history_pkey PRIMARY KEY (id);


--
-- Name: task_templates task_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: task_dependencies unique_task_dependency_pair; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT unique_task_dependency_pair UNIQUE (task_id, prerequisite_task_id);


--
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_activity_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_activity_logs_action ON public.activity_logs USING btree (action);


--
-- Name: ix_activity_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_activity_logs_created_at ON public.activity_logs USING btree (created_at);


--
-- Name: ix_activity_logs_entity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_activity_logs_entity_id ON public.activity_logs USING btree (entity_id);


--
-- Name: ix_activity_logs_entity_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_activity_logs_entity_type ON public.activity_logs USING btree (entity_type);


--
-- Name: ix_activity_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: ix_ai_insights_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_insights_employee_id ON public.ai_insights USING btree (employee_id);


--
-- Name: ix_ai_insights_insight_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_insights_insight_category ON public.ai_insights USING btree (insight_category);


--
-- Name: ix_ai_insights_review_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_insights_review_status ON public.ai_insights USING btree (review_status);


--
-- Name: ix_ai_insights_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_insights_task_id ON public.ai_insights USING btree (task_id);


--
-- Name: ix_confirmation_records_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_confirmation_records_employee_id ON public.confirmation_records USING btree (employee_id);


--
-- Name: ix_confirmation_records_probation_record_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_confirmation_records_probation_record_id ON public.confirmation_records USING btree (probation_record_id);


--
-- Name: ix_confirmation_records_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_confirmation_records_status ON public.confirmation_records USING btree (status);


--
-- Name: ix_departments_department_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_departments_department_code ON public.departments USING btree (department_code);


--
-- Name: ix_document_requirements_lifecycle_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_document_requirements_lifecycle_stage ON public.document_requirements USING btree (lifecycle_stage);


--
-- Name: ix_document_requirements_requirement_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_document_requirements_requirement_code ON public.document_requirements USING btree (requirement_code);


--
-- Name: ix_employee_documents_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_documents_employee_id ON public.employee_documents USING btree (employee_id);


--
-- Name: ix_employee_documents_requirement_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_documents_requirement_id ON public.employee_documents USING btree (requirement_id);


--
-- Name: ix_employee_documents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_documents_status ON public.employee_documents USING btree (status);


--
-- Name: ix_employee_lifecycle_current_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_lifecycle_current_stage ON public.employee_lifecycle USING btree (current_stage);


--
-- Name: ix_employee_lifecycle_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_lifecycle_employee_id ON public.employee_lifecycle USING btree (employee_id);


--
-- Name: ix_employee_lifecycle_stage_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_lifecycle_stage_status ON public.employee_lifecycle USING btree (stage_status);


--
-- Name: ix_employees_date_of_joining; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employees_date_of_joining ON public.employees USING btree (date_of_joining);


--
-- Name: ix_employees_department_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employees_department_id ON public.employees USING btree (department_id);


--
-- Name: ix_employees_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_employees_email ON public.employees USING btree (email);


--
-- Name: ix_employees_employee_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_employees_employee_code ON public.employees USING btree (employee_code);


--
-- Name: ix_employees_employment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employees_employment_status ON public.employees USING btree (employment_status);


--
-- Name: ix_employees_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employees_location ON public.employees USING btree (location);


--
-- Name: ix_employees_manager_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employees_manager_id ON public.employees USING btree (manager_id);


--
-- Name: ix_escalations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_escalations_status ON public.escalations USING btree (status);


--
-- Name: ix_escalations_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_escalations_task_id ON public.escalations USING btree (task_id);


--
-- Name: ix_follow_ups_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_follow_ups_task_id ON public.follow_ups USING btree (task_id);


--
-- Name: ix_ml_predictions_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ml_predictions_task_id ON public.ml_predictions USING btree (task_id);


--
-- Name: ix_ml_predictions_task_snapshot_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ml_predictions_task_snapshot_id ON public.ml_predictions USING btree (task_snapshot_id);


--
-- Name: ix_notifications_notification_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_notifications_notification_type ON public.notifications USING btree (notification_type);


--
-- Name: ix_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: ix_offboarding_records_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_offboarding_records_employee_id ON public.offboarding_records USING btree (employee_id);


--
-- Name: ix_offboarding_records_overall_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_offboarding_records_overall_status ON public.offboarding_records USING btree (overall_status);


--
-- Name: ix_onboarding_records_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_onboarding_records_employee_id ON public.onboarding_records USING btree (employee_id);


--
-- Name: ix_onboarding_records_overall_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_onboarding_records_overall_status ON public.onboarding_records USING btree (overall_status);


--
-- Name: ix_performance_reviews_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_performance_reviews_employee_id ON public.performance_reviews USING btree (employee_id);


--
-- Name: ix_performance_reviews_review_cycle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_performance_reviews_review_cycle ON public.performance_reviews USING btree (review_cycle);


--
-- Name: ix_performance_reviews_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_performance_reviews_status ON public.performance_reviews USING btree (status);


--
-- Name: ix_probation_records_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_probation_records_employee_id ON public.probation_records USING btree (employee_id);


--
-- Name: ix_probation_records_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_probation_records_status ON public.probation_records USING btree (status);


--
-- Name: ix_roles_role_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_roles_role_code ON public.roles USING btree (role_code);


--
-- Name: ix_task_dependencies_prerequisite_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_task_dependencies_prerequisite_task_id ON public.task_dependencies USING btree (prerequisite_task_id);


--
-- Name: ix_task_dependencies_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_task_dependencies_task_id ON public.task_dependencies USING btree (task_id);


--
-- Name: ix_task_snapshots_is_eligible_for_prediction; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_task_snapshots_is_eligible_for_prediction ON public.task_snapshots USING btree (is_eligible_for_prediction);


--
-- Name: ix_task_snapshots_snapshot_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_task_snapshots_snapshot_timestamp ON public.task_snapshots USING btree (snapshot_timestamp);


--
-- Name: ix_task_snapshots_task_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_task_snapshots_task_category ON public.task_snapshots USING btree (task_category);


--
-- Name: ix_task_snapshots_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_task_snapshots_task_id ON public.task_snapshots USING btree (task_id);


--
-- Name: ix_task_status_history_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_task_status_history_changed_at ON public.task_status_history USING btree (changed_at);


--
-- Name: ix_task_status_history_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_task_status_history_task_id ON public.task_status_history USING btree (task_id);


--
-- Name: ix_task_templates_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_task_templates_category ON public.task_templates USING btree (category);


--
-- Name: ix_task_templates_template_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_task_templates_template_code ON public.task_templates USING btree (template_code);


--
-- Name: ix_tasks_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_category ON public.tasks USING btree (category);


--
-- Name: ix_tasks_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_due_date ON public.tasks USING btree (due_date);


--
-- Name: ix_tasks_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_employee_id ON public.tasks USING btree (employee_id);


--
-- Name: ix_tasks_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_owner_id ON public.tasks USING btree (owner_id);


--
-- Name: ix_tasks_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_priority ON public.tasks USING btree (priority);


--
-- Name: ix_tasks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_status ON public.tasks USING btree (status);


--
-- Name: ix_tasks_task_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_tasks_task_code ON public.tasks USING btree (task_code);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_role_id ON public.users USING btree (role_id);


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_insights ai_insights_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_insights
    ADD CONSTRAINT ai_insights_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: ai_insights ai_insights_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_insights
    ADD CONSTRAINT ai_insights_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_insights ai_insights_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_insights
    ADD CONSTRAINT ai_insights_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: confirmation_records confirmation_records_approved_by_hr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.confirmation_records
    ADD CONSTRAINT confirmation_records_approved_by_hr_id_fkey FOREIGN KEY (approved_by_hr_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: confirmation_records confirmation_records_approved_by_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.confirmation_records
    ADD CONSTRAINT confirmation_records_approved_by_manager_id_fkey FOREIGN KEY (approved_by_manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: confirmation_records confirmation_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.confirmation_records
    ADD CONSTRAINT confirmation_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: confirmation_records confirmation_records_probation_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.confirmation_records
    ADD CONSTRAINT confirmation_records_probation_record_id_fkey FOREIGN KEY (probation_record_id) REFERENCES public.probation_records(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.document_requirements(id) ON DELETE RESTRICT;


--
-- Name: employee_documents employee_documents_verified_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_verified_by_id_fkey FOREIGN KEY (verified_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_lifecycle employee_lifecycle_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_lifecycle
    ADD CONSTRAINT employee_lifecycle_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;


--
-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: escalations escalations_escalated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_escalated_by_user_id_fkey FOREIGN KEY (escalated_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: escalations escalations_escalated_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_escalated_to_user_id_fkey FOREIGN KEY (escalated_to_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: escalations escalations_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escalations
    ADD CONSTRAINT escalations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: follow_ups follow_ups_initiator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_initiator_user_id_fkey FOREIGN KEY (initiator_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: follow_ups follow_ups_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: follow_ups follow_ups_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: ml_predictions ml_predictions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ml_predictions
    ADD CONSTRAINT ml_predictions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: ml_predictions ml_predictions_task_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ml_predictions
    ADD CONSTRAINT ml_predictions_task_snapshot_id_fkey FOREIGN KEY (task_snapshot_id) REFERENCES public.task_snapshots(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: offboarding_records offboarding_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offboarding_records
    ADD CONSTRAINT offboarding_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: onboarding_records onboarding_records_buddy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_records
    ADD CONSTRAINT onboarding_records_buddy_id_fkey FOREIGN KEY (buddy_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: onboarding_records onboarding_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_records
    ADD CONSTRAINT onboarding_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: performance_reviews performance_reviews_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.performance_reviews
    ADD CONSTRAINT performance_reviews_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: performance_reviews performance_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.performance_reviews
    ADD CONSTRAINT performance_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: probation_records probation_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.probation_records
    ADD CONSTRAINT probation_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_prerequisite_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_prerequisite_task_id_fkey FOREIGN KEY (prerequisite_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_snapshots task_snapshots_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_snapshots
    ADD CONSTRAINT task_snapshots_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_status_history task_status_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_status_history
    ADD CONSTRAINT task_status_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: task_status_history task_status_history_new_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_status_history
    ADD CONSTRAINT task_status_history_new_owner_id_fkey FOREIGN KEY (new_owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_status_history task_status_history_old_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_status_history
    ADD CONSTRAINT task_status_history_old_owner_id_fkey FOREIGN KEY (old_owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_status_history task_status_history_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_status_history
    ADD CONSTRAINT task_status_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: tasks tasks_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.task_templates(id) ON DELETE SET NULL;


--
-- Name: users users_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict VOoUimZ7Gy7PIV4esbLTRfhiaxCTnmdEGw9QA5rtmfGqJUfSWa9JBZ1kmFT6z5n

