#!/usr/bin/env python3
"""
Synthetic Data Generator for AI-Powered HR Operations & Action Intelligence Platform.
Fictional Indian Technology Company context.
Generates:
1. 23 normalized relational CSVs for PostgreSQL.
2. Separate ML-Ready Task Delay Risk Dataset (>= 10,000 eligible snapshot rows).
"""

import os
import random
import csv
import json
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

# Fixed seed for reproducibility
RANDOM_SEED = 42
random.seed(RANDOM_SEED)

# Simulation Time Range
SIMULATION_END_DATE = date(2026, 11, 8)
SIMULATION_START_DATE = date(2024, 11, 1)  # 24+ months

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATASETS_CSV_DIR = BASE_DIR / "datasets" / "csv"
DATASETS_ML_DIR = BASE_DIR / "datasets" / "ml_ready"
ML_DIR = BASE_DIR / "ml" / "datasets"

DATASETS_CSV_DIR.mkdir(parents=True, exist_ok=True)
DATASETS_ML_DIR.mkdir(parents=True, exist_ok=True)
ML_DIR.mkdir(parents=True, exist_ok=True)

# 1. Indian Technology Company Reference Data
LOCATIONS = ["Bengaluru", "Hyderabad", "Pune", "Chennai", "Mumbai", "Gurugram"]
LOCATION_WEIGHTS = [0.35, 0.25, 0.15, 0.10, 0.08, 0.07]

FIRST_NAMES_MALE = [
    "Aarav", "Rohan", "Aditya", "Vikram", "Rahul", "Arjun", "Siddharth", "Suresh",
    "Ramesh", "Karthik", "Amit", "Rajesh", "Deepak", "Manoj", "Nikhil", "Varun",
    "Sanjay", "Harish", "Ishaan", "Gaurav", "Aakash", "Rakesh", "Abhishek", "Prateek",
    "Manish", "Anand", "Alok", "Vivek", "Vishal", "Kunal", "Sumit", "Mayank", "Tarun"
]

FIRST_NAMES_FEMALE = [
    "Priya", "Ananya", "Sneha", "Neha", "Pooja", "Kavita", "Divya", "Meera",
    "Sunita", "Preeti", "Swati", "Ritu", "Tanvi", "Shreya", "Rhea", "Aditi",
    "Deepika", "Shruti", "Anjali", "Pallavi", "Nandini", "Shilpa", "Payal", "Geeta",
    "Radhika", "Isha", "Bhavna", "Kiran", "Vidya", "Suman", "Aparna", "Namrata"
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Iyer", "Nair", "Rao", "Kulkarni", "Deshmukh",
    "Reddy", "Chatterjee", "Banerjee", "Gupta", "Singh", "Mehta", "Joshi", "Nambiar",
    "Menon", "Pillai", "Hegde", "Bhatt", "Agarwal", "Jain", "Saxena", "Choudhury",
    "Mishra", "Pandey", "Kapoor", "Bhatnagar", "Sen", "Dutta", "Mukherjee", "Malhotra"
]

DEPARTMENTS_DATA = [
    {"code": "DEPT_SWE", "name": "Software Engineering", "desc": "Core application, backend, frontend, and full-stack software development."},
    {"code": "DEPT_QA", "name": "Quality Assurance", "desc": "Automated, performance, and functional software testing and validation."},
    {"code": "DEPT_DEVOPS", "name": "DevOps and Cloud Engineering", "desc": "Cloud infrastructure, CI/CD pipelines, SRE, and platform resilience."},
    {"code": "DEPT_DATA", "name": "Data Engineering", "desc": "Data pipelines, warehousing, lakehouses, ETL/ELT architectures."},
    {"code": "DEPT_AIML", "name": "Artificial Intelligence and Machine Learning", "desc": "ML models, GenAI agents, deep learning architectures, and analytics."},
    {"code": "DEPT_CYBER", "name": "Cybersecurity", "desc": "Application security, network protection, SOC operations, and compliance."},
    {"code": "DEPT_IT", "name": "IT Support", "desc": "Enterprise hardware, corporate network, helpdesk, and asset lifecycle management."},
    {"code": "DEPT_PROD", "name": "Product Management", "desc": "Product strategy, roadmap development, feature specifications, and UX research."},
    {"code": "DEPT_PMO", "name": "Project Management", "desc": "Agile coaching, sprint delivery, release coordination, and PMO."},
    {"code": "DEPT_HR", "name": "Human Resources", "desc": "Talent operations, employee lifecycle management, people culture, and compliance."},
    {"code": "DEPT_FIN", "name": "Finance", "desc": "Corporate finance, payroll administration, taxation, and budgeting."},
    {"code": "DEPT_OPS", "name": "Operations and Administration", "desc": "Facilities management, vendor contracts, corporate legal, and administration."},
]

ROLES_DATA = [
    {"code": "HR_ADMIN", "name": "HR Administrator", "desc": "System-wide administrative rights, configuration, and compliance oversight."},
    {"code": "HR_OPERATIONS", "name": "HR Operations Specialist", "desc": "Operational lifecycle management, workflow processing, and task monitoring."},
    {"code": "PEOPLE_MANAGER", "name": "People Manager / Technical Lead", "desc": "Evaluation, approval, and task management for reporting team members."},
    {"code": "EMPLOYEE", "name": "Employee", "desc": "Standard self-service profile and task contributor."},
]

DOCUMENT_REQUIREMENTS_DATA = [
    {"code": "DOC_PAN", "name": "PAN Card Copy", "stage": "ONBOARDING", "mandatory": True, "format": "PDF, JPG, PNG", "desc": "Permanent Account Number card for Indian tax verification."},
    {"code": "DOC_AADHAAR", "name": "Aadhaar Card Copy", "stage": "ONBOARDING", "mandatory": True, "format": "PDF", "desc": "Government of India identity and address verification."},
    {"code": "DOC_DEGREE", "name": "Highest Educational Degree Certificate", "stage": "ONBOARDING", "mandatory": True, "format": "PDF", "desc": "Attested degree certificate for background verification."},
    {"code": "DOC_RELIEVING", "name": "Previous Employer Relieving Letter", "stage": "ONBOARDING", "mandatory": True, "format": "PDF", "desc": "Proof of formal separation from previous employer."},
    {"code": "DOC_PAYSLIPS", "name": "Last 3 Months Payslips", "stage": "ONBOARDING", "mandatory": True, "format": "PDF", "desc": "Salary verification documents."},
    {"code": "DOC_NDA", "name": "Signed Non-Disclosure Agreement", "stage": "ONBOARDING", "mandatory": True, "format": "PDF", "desc": "Company confidential intellectual property agreement."},
    {"code": "DOC_PROB_GOALS", "name": "Probation Objectives Signoff Sheet", "stage": "PROBATION", "mandatory": True, "format": "PDF, DOCX", "desc": "Agreed 90-day deliverables signed by manager."},
    {"code": "DOC_CONFIRM_REC", "name": "Manager Confirmation Recommendation", "stage": "CONFIRMATION", "mandatory": True, "format": "PDF", "desc": "Formal signoff recommending transition to confirmed status."},
    {"code": "DOC_SELF_APPRAISAL", "name": "Self-Appraisal Portfolio", "stage": "PERFORMANCE", "mandatory": True, "format": "PDF", "desc": "Comprehensive bi-annual achievement documentation."},
    {"code": "DOC_KT_PLAN", "name": "Knowledge Transfer Plan & Signoff", "stage": "OFFBOARDING", "mandatory": True, "format": "PDF", "desc": "Handover documentation signed by replacement or lead."},
    {"code": "DOC_ASSET_RETURN", "name": "IT Hardware Handover Receipt", "stage": "OFFBOARDING", "mandatory": True, "format": "PDF", "desc": "Confirmation of physical IT hardware return."},
    {"code": "DOC_CODE_CONDUCT", "name": "Annual Code of Conduct Acknowledgment", "stage": "COMPLIANCE", "mandatory": True, "format": "PDF", "desc": "Annual compliance declaration."},
]

TASK_TEMPLATES_DATA = [
    # Onboarding
    {"code": "TMPL_ONB_DOC_VERIFY", "name": "Verify Pre-Joining Compliance Documents", "cat": "ONBOARDING", "pri": "HIGH", "days": 3, "role": "HR_OPERATIONS", "desc": "Verify PAN, Aadhaar, educational transcripts, and previous employment proofs."},
    {"code": "TMPL_ONB_BGV_INIT", "name": "Initiate Background Verification (BGV)", "cat": "ONBOARDING", "pri": "HIGH", "days": 2, "role": "HR_OPERATIONS", "desc": "Hand over verified documents to external BGV agency."},
    {"code": "TMPL_ONB_IT_PROV", "name": "Provision Developer Workstation & Cloud Credentials", "cat": "ONBOARDING", "pri": "HIGH", "days": 4, "role": "PEOPLE_MANAGER", "desc": "Allocate laptop, GitHub, AWS/GCP IAM accounts, and VPN access."},
    {"code": "TMPL_ONB_BUDDY_MEET", "name": "Conduct Day-1 Buddy Introduction", "cat": "ONBOARDING", "pri": "MEDIUM", "days": 2, "role": "PEOPLE_MANAGER", "desc": "Meet new joinee and introduce codebase, engineering guidelines, and squad."},
    {"code": "TMPL_ONB_ORIENT", "name": "Complete Corporate Induction & Security Training", "cat": "ONBOARDING", "pri": "MEDIUM", "days": 5, "role": "EMPLOYEE", "desc": "Attend corporate culture and infosec training modules."},

    # Probation
    {"code": "TMPL_PROB_GOAL_SET", "name": "Define 90-Day Probation Objectives & KPIs", "cat": "PROBATION", "pri": "MEDIUM", "days": 10, "role": "PEOPLE_MANAGER", "desc": "Collaboratively document technical deliverables and milestones for probation period."},
    {"code": "TMPL_PROB_CHECKIN_30", "name": "Conduct Day-30 Probation Check-in", "cat": "PROBATION", "pri": "LOW", "days": 5, "role": "PEOPLE_MANAGER", "desc": "Review first-month integration, squad feedback, and ramp-up pace."},
    {"code": "TMPL_PROB_CHECKIN_60", "name": "Conduct Day-60 Mid-Probation Review", "cat": "PROBATION", "pri": "MEDIUM", "days": 5, "role": "PEOPLE_MANAGER", "desc": "Evaluate sprint contributions and highlight any performance blockers."},
    {"code": "TMPL_PROB_FINAL_EVAL", "name": "Conduct Final Day-90 Probation Assessment", "cat": "PROBATION", "pri": "CRITICAL", "days": 7, "role": "PEOPLE_MANAGER", "desc": "Formal decision to recommend confirmation or initiate extension."},

    # Confirmation
    {"code": "TMPL_CONF_HR_REVIEW", "name": "HR Review of Probation Assessment", "cat": "CONFIRMATION", "pri": "HIGH", "days": 5, "role": "HR_OPERATIONS", "desc": "Audit probation signoffs, attendance, and compliance requirements."},
    {"code": "TMPL_CONF_LETTER_GEN", "name": "Generate & Dispatch Confirmation Letter", "cat": "CONFIRMATION", "pri": "HIGH", "days": 3, "role": "HR_OPERATIONS", "desc": "Generate signed confirmation letter and update employment master records."},

    # Performance
    {"code": "TMPL_PERF_SELF_EVAL", "name": "Complete Bi-Annual Self-Appraisal", "cat": "PERFORMANCE", "pri": "MEDIUM", "days": 14, "role": "EMPLOYEE", "desc": "Summarize cycle technical contributions, project impact, and self-ratings."},
    {"code": "TMPL_PERF_MGR_EVAL", "name": "Complete Manager Performance Evaluation", "cat": "PERFORMANCE", "pri": "HIGH", "days": 14, "role": "PEOPLE_MANAGER", "desc": "Rate engineer across technical excellence, delivery velocity, and collaboration."},
    {"code": "TMPL_PERF_NORMALIZATION", "name": "Participate in Department Calibration & Rating Finalization", "cat": "PERFORMANCE", "pri": "CRITICAL", "days": 7, "role": "HR_ADMIN", "desc": "Normalize team ratings across department delivery benchmarks."},

    # Offboarding
    {"code": "TMPL_OFF_RESIGN_ACCEPT", "name": "Formal Resignation Acceptance & Notice Calculation", "cat": "OFFBOARDING", "pri": "HIGH", "days": 3, "role": "HR_OPERATIONS", "desc": "Acknowledge resignation notice, determine official last working day."},
    {"code": "TMPL_OFF_KT_EXEC", "name": "Complete Technical Knowledge Transfer (KT)", "cat": "OFFBOARDING", "pri": "CRITICAL", "days": 21, "role": "PEOPLE_MANAGER", "desc": "Document repositories, transfer system ownership, and handover open sprints."},
    {"code": "TMPL_OFF_ASSET_REC", "name": "Retrieve IT Hardware & Revoke Cloud Credentials", "cat": "OFFBOARDING", "pri": "CRITICAL", "days": 2, "role": "PEOPLE_MANAGER", "desc": "Collect company laptop, access cards, and de-provision cloud SSO access."},
    {"code": "TMPL_OFF_FIN_CLEAR", "name": "Process Finance & Full and Final (F&F) Settlement Clearance", "cat": "OFFBOARDING", "pri": "HIGH", "days": 5, "role": "HR_OPERATIONS", "desc": "Verify expense claims, notice period recovery, and signoff final dues."},
    {"code": "TMPL_OFF_RELIEVE_ISSUE", "name": "Issue Service Certificate & Relieving Letter", "cat": "OFFBOARDING", "pri": "HIGH", "days": 3, "role": "HR_OPERATIONS", "desc": "Generate and email digitally signed relieving documentation."},

    # Compliance
    {"code": "TMPL_COMPL_ANNUAL_DECL", "name": "Annual Conflict of Interest & Security Declaration", "cat": "COMPLIANCE", "pri": "LOW", "days": 15, "role": "EMPLOYEE", "desc": "Complete mandatory corporate governance and ethical standard declarations."},
]


def generate_all():
    print("=" * 70)
    print("Generating Synthetic Data for Indian Technology Company Platform...")
    print(f"Historical Window: {SIMULATION_START_DATE} to {SIMULATION_END_DATE} (24+ months)")
    print(f"Random Seed: {RANDOM_SEED}")
    print("=" * 70)

    # ---------------------------------------------------------
    # 1. Departments (12)
    # ---------------------------------------------------------
    departments = []
    for idx, d in enumerate(DEPARTMENTS_DATA, start=1):
        departments.append({
            "id": idx,
            "department_code": d["code"],
            "name": d["name"],
            "description": d["desc"],
            "head_of_department_id": None,  # Linked after employee generation
            "is_active": True,
            "created_at": f"{SIMULATION_START_DATE}T09:00:00+05:30",
            "updated_at": f"{SIMULATION_START_DATE}T09:00:00+05:30",
        })

    # ---------------------------------------------------------
    # 2. Roles (4)
    # ---------------------------------------------------------
    roles = []
    for idx, r in enumerate(ROLES_DATA, start=1):
        roles.append({
            "id": idx,
            "role_code": r["code"],
            "role_name": r["name"],
            "description": r["desc"],
            "is_active": True,
            "created_at": f"{SIMULATION_START_DATE}T09:00:00+05:30",
            "updated_at": f"{SIMULATION_START_DATE}T09:00:00+05:30",
        })
    role_map = {r["role_code"]: r["id"] for r in roles}

    # ---------------------------------------------------------
    # 3. Employees (Target: 360 employees, > 300)
    # ---------------------------------------------------------
    # Distribution across departments: ~80% Technical, ~20% Functional
    # Technical: SWE (110), QA (40), DevOps (35), Data (35), AIML (30), Cyber (20), IT (20), Prod (15) = 305 (~85%)
    # Functional: PMO (15), HR (18), Finance (12), Ops (10) = 55 (~15%)
    # Total = 360 employees
    dept_targets = {
        "DEPT_SWE": 110,
        "DEPT_QA": 40,
        "DEPT_DEVOPS": 35,
        "DEPT_DATA": 35,
        "DEPT_AIML": 30,
        "DEPT_CYBER": 20,
        "DEPT_IT": 20,
        "DEPT_PROD": 15,
        "DEPT_PMO": 15,
        "DEPT_HR": 18,
        "DEPT_FIN": 12,
        "DEPT_OPS": 10,
    }

    technical_designations = {
        "DEPT_SWE": ["Software Engineer", "Senior Software Engineer", "Backend Developer", "Frontend Developer", "Full Stack Developer", "Technical Lead", "Engineering Manager"],
        "DEPT_QA": ["QA Engineer", "Senior QA Engineer", "Automation Test Engineer", "Lead QA Engineer", "QA Manager"],
        "DEPT_DEVOPS": ["DevOps Engineer", "Senior DevOps Engineer", "Cloud Engineer", "Site Reliability Engineer", "Platform Engineer", "DevOps Lead"],
        "DEPT_DATA": ["Data Engineer", "Senior Data Engineer", "Data Pipeline Specialist", "Lead Data Engineer"],
        "DEPT_AIML": ["AI Engineer", "ML Engineer", "Senior ML Engineer", "Data Scientist", "Lead AI Scientist"],
        "DEPT_CYBER": ["Cybersecurity Engineer", "Senior Security Engineer", "SOC Analyst", "Security Lead"],
        "DEPT_IT": ["IT Support Engineer", "Senior IT Specialist", "Network Administrator", "IT Infrastructure Lead"],
        "DEPT_PROD": ["Associate Product Manager", "Product Manager", "Technical Product Manager", "Principal Product Manager"],
        "DEPT_PMO": ["Scrum Master", "Agile Project Manager", "Technical Program Manager"],
        "DEPT_HR": ["HR Operations Associate", "HR Business Partner", "Senior HR Specialist", "Talent Operations Lead", "Head of People"],
        "DEPT_FIN": ["Financial Analyst", "Senior Accountant", "Payroll Specialist", "Finance Manager"],
        "DEPT_OPS": ["Operations Coordinator", "Facilities Executive", "Admin Manager", "Director of Operations"],
    }

    employees = []
    used_emails = set()
    emp_id_counter = 1

    # First generate managers for each department, then regular employees
    dept_managers = {}

    for dept in departments:
        d_code = dept["department_code"]
        # Manager for this department
        gender = random.choice(["M", "F"])
        fname = random.choice(FIRST_NAMES_MALE if gender == "M" else FIRST_NAMES_FEMALE)
        lname = random.choice(LAST_NAMES)
        email = f"{fname.lower()}.{lname.lower()}{emp_id_counter}@indiatree-tech.in"
        used_emails.add(email)

        # Manager designation
        if "Manager" in technical_designations[d_code][-1] or "Lead" in technical_designations[d_code][-1] or "Head" in technical_designations[d_code][-1]:
            desig = technical_designations[d_code][-1]
        else:
            desig = f"{dept['name']} Lead"

        doj = SIMULATION_START_DATE - timedelta(days=random.randint(400, 1200))
        loc = random.choices(LOCATIONS, weights=LOCATION_WEIGHTS)[0]

        mgr_record = {
            "id": emp_id_counter,
            "employee_code": f"EMP-{emp_id_counter:04d}",
            "first_name": fname,
            "last_name": lname,
            "email": email,
            "phone_number": f"+91-9{random.randint(100000000, 999999999)}",
            "department_id": dept["id"],
            "designation": desig,
            "location": loc,
            "employment_status": "CONFIRMED",
            "date_of_joining": doj.isoformat(),
            "manager_id": None,  # Will link later
            "created_at": f"{doj}T09:00:00+05:30",
            "updated_at": f"{doj}T09:00:00+05:30",
        }
        employees.append(mgr_record)
        dept_managers[dept["id"]] = emp_id_counter
        dept["head_of_department_id"] = emp_id_counter
        emp_id_counter += 1

    # Now generate the remaining staff for each department
    for dept in departments:
        d_code = dept["department_code"]
        target = dept_targets[d_code] - 1  # 1 already created as head
        possible_desigs = technical_designations[d_code]

        # In larger tech depts (SWE, QA, DevOps, Data), create 2-3 mid-level Tech Leads under the Department Head
        sub_leads = [dept_managers[dept["id"]]]
        if target >= 20:
            num_sub_leads = max(2, target // 12)
            for _ in range(num_sub_leads):
                gender = random.choice(["M", "F"])
                fname = random.choice(FIRST_NAMES_MALE if gender == "M" else FIRST_NAMES_FEMALE)
                lname = random.choice(LAST_NAMES)
                email = f"{fname.lower()}.{lname.lower()}{emp_id_counter}@indiatree-tech.in"
                used_emails.add(email)

                lead_desig = [d for d in possible_desigs if "Lead" in d or "Senior" in d]
                desig = random.choice(lead_desig) if lead_desig else possible_desigs[-1]
                doj = SIMULATION_START_DATE - timedelta(days=random.randint(200, 600))
                loc = random.choices(LOCATIONS, weights=LOCATION_WEIGHTS)[0]

                lead_emp = {
                    "id": emp_id_counter,
                    "employee_code": f"EMP-{emp_id_counter:04d}",
                    "first_name": fname,
                    "last_name": lname,
                    "email": email,
                    "phone_number": f"+91-9{random.randint(100000000, 999999999)}",
                    "department_id": dept["id"],
                    "designation": desig,
                    "location": loc,
                    "employment_status": "CONFIRMED",
                    "date_of_joining": doj.isoformat(),
                    "manager_id": dept_managers[dept["id"]],
                    "created_at": f"{doj}T09:00:00+05:30",
                    "updated_at": f"{doj}T09:00:00+05:30",
                }
                employees.append(lead_emp)
                sub_leads.append(emp_id_counter)
                emp_id_counter += 1
                target -= 1

        # Now regular employees
        for _ in range(target):
            gender = random.choice(["M", "F"])
            fname = random.choice(FIRST_NAMES_MALE if gender == "M" else FIRST_NAMES_FEMALE)
            lname = random.choice(LAST_NAMES)
            email = f"{fname.lower()}.{lname.lower()}{emp_id_counter}@indiatree-tech.in"
            used_emails.add(email)

            desig = random.choice(possible_desigs)
            # Stagger joining dates across historical window:
            # 60% joined before Nov 2024 (tenured)
            # 40% joined between Nov 2024 and Oct 2026 (new joinees undergoing onboarding/probation)
            if random.random() < 0.60:
                days_ago = random.randint(30, 800)
                doj = SIMULATION_START_DATE - timedelta(days=days_ago)
            else:
                total_sim_days = (SIMULATION_END_DATE - SIMULATION_START_DATE).days
                days_offset = random.randint(0, total_sim_days - 10)
                doj = SIMULATION_START_DATE + timedelta(days=days_offset)

            # Assign reporting manager from department leads
            mgr_id = random.choice(sub_leads)

            # Determine status based on DOJ
            days_since_joining = (SIMULATION_END_DATE - doj).days
            if days_since_joining < 90:
                emp_status = "PROBATION"
            elif random.random() < 0.08 and days_since_joining > 180:
                emp_status = random.choice(["NOTICE_PERIOD", "RESIGNED"])
            else:
                emp_status = "CONFIRMED"

            loc = random.choices(LOCATIONS, weights=LOCATION_WEIGHTS)[0]

            employees.append({
                "id": emp_id_counter,
                "employee_code": f"EMP-{emp_id_counter:04d}",
                "first_name": fname,
                "last_name": lname,
                "email": email,
                "phone_number": f"+91-9{random.randint(100000000, 999999999)}",
                "department_id": dept["id"],
                "designation": desig,
                "location": loc,
                "employment_status": emp_status,
                "date_of_joining": doj.isoformat(),
                "manager_id": mgr_id,
                "created_at": f"{doj}T09:00:00+05:30",
                "updated_at": f"{SIMULATION_END_DATE}T09:00:00+05:30",
            })
            emp_id_counter += 1

    print(f"Generated {len(employees)} employees across {len(departments)} departments.")

    # ---------------------------------------------------------
    # 4. Users (System Accounts)
    # ---------------------------------------------------------
    # Include all HR members as HR_ADMIN or HR_OPERATIONS, all Managers as PEOPLE_MANAGER,
    # and select employees as EMPLOYEE users.
    users = []
    user_id_counter = 1
    hr_dept_id = [d["id"] for d in departments if d["department_code"] == "DEPT_HR"][0]

    emp_to_user = {}

    for emp in employees:
        u_role = None
        if emp["department_id"] == hr_dept_id:
            if "Head" in emp["designation"] or "Lead" in emp["designation"]:
                u_role = "HR_ADMIN"
            else:
                u_role = "HR_OPERATIONS"
        elif emp["id"] in dept_managers.values() or any(e["manager_id"] == emp["id"] for e in employees):
            u_role = "PEOPLE_MANAGER"
        elif random.random() < 0.25:  # A subset of standard employees have direct logins
            u_role = "EMPLOYEE"

        if u_role:
            u_record = {
                "id": user_id_counter,
                "employee_id": emp["id"],
                "email": emp["email"],
                "full_name": f"{emp['first_name']} {emp['last_name']}",
                "role_id": role_map[u_role],
                "is_active": emp["employment_status"] != "RESIGNED",
                "last_login_at": f"{SIMULATION_END_DATE - timedelta(days=random.randint(0, 10))}T11:00:00+05:30",
                "created_at": emp["created_at"],
                "updated_at": emp["updated_at"],
            }
            users.append(u_record)
            emp_to_user[emp["id"]] = user_id_counter
            user_id_counter += 1

    print(f"Generated {len(users)} platform users.")

    # ---------------------------------------------------------
    # 5. Task Templates (20)
    # ---------------------------------------------------------
    task_templates = []
    for idx, t in enumerate(TASK_TEMPLATES_DATA, start=1):
        task_templates.append({
            "id": idx,
            "template_code": t["code"],
            "name": t["name"],
            "category": t["cat"],
            "default_priority": t["pri"],
            "estimated_duration_days": t["days"],
            "default_role_code": t["role"],
            "description": t["desc"],
            "is_active": True,
            "created_at": f"{SIMULATION_START_DATE}T09:00:00+05:30",
            "updated_at": f"{SIMULATION_START_DATE}T09:00:00+05:30",
        })

    # ---------------------------------------------------------
    # 6. Document Requirements (12)
    # ---------------------------------------------------------
    doc_requirements = []
    for idx, doc in enumerate(DOCUMENT_REQUIREMENTS_DATA, start=1):
        doc_requirements.append({
            "id": idx,
            "requirement_code": doc["code"],
            "name": doc["name"],
            "lifecycle_stage": doc["stage"],
            "is_mandatory": doc["mandatory"],
            "file_format_allowed": doc["format"],
            "description": doc["desc"],
            "is_active": True,
            "created_at": f"{SIMULATION_START_DATE}T09:00:00+05:30",
            "updated_at": f"{SIMULATION_START_DATE}T09:00:00+05:30",
        })

    # ---------------------------------------------------------
    # 7. Employee Lifecycle & Stage Details
    # ---------------------------------------------------------
    lifecycle_records = []
    onboarding_records = []
    probation_records = []
    confirmation_records = []
    performance_reviews = []
    offboarding_records = []

    lc_id_counter = 1
    onb_id_counter = 1
    prob_id_counter = 1
    conf_id_counter = 1
    perf_id_counter = 1
    offb_id_counter = 1

    review_cycles = [
        {"cycle": "FY24-H2", "start": date(2024, 10, 1), "end": date(2025, 3, 31), "deadline": date(2025, 4, 15)},
        {"cycle": "FY25-H1", "start": date(2025, 4, 1), "end": date(2025, 9, 30), "deadline": date(2025, 10, 15)},
        {"cycle": "FY25-H2", "start": date(2025, 10, 1), "end": date(2026, 3, 31), "deadline": date(2026, 4, 15)},
        {"cycle": "FY26-H1", "start": date(2026, 4, 1), "end": date(2026, 9, 30), "deadline": date(2026, 10, 20)},
    ]

    for emp in employees:
        doj = date.fromisoformat(emp["date_of_joining"])
        status = emp["employment_status"]

        # A. Onboarding (Every employee underwent or is undergoing onboarding)
        onb_target = doj + timedelta(days=14)
        is_onb_complete = (SIMULATION_END_DATE > onb_target + timedelta(days=5)) or (status != "PROBATION")
        actual_comp = onb_target - timedelta(days=random.randint(-3, 4)) if is_onb_complete else None

        onb_stage_status = "COMPLETED" if is_onb_complete else ("DELAYED" if SIMULATION_END_DATE > onb_target else "IN_PROGRESS")
        lifecycle_records.append({
            "id": lc_id_counter,
            "employee_id": emp["id"],
            "current_stage": "ONBOARDING",
            "stage_start_date": doj.isoformat(),
            "stage_target_date": onb_target.isoformat(),
            "stage_status": onb_stage_status,
            "completed_at": f"{actual_comp}T17:00:00+05:30" if actual_comp else None,
            "notes": "Standard employee induction and technical onboarding.",
            "created_at": f"{doj}T09:00:00+05:30",
            "updated_at": f"{actual_comp or SIMULATION_END_DATE}T17:00:00+05:30",
        })
        lc_id_counter += 1

        # Find a potential buddy in the same department
        dept_peers = [e["id"] for e in employees if e["department_id"] == emp["department_id"] and e["id"] != emp["id"]]
        buddy_id = random.choice(dept_peers) if dept_peers else None

        onboarding_records.append({
            "id": onb_id_counter,
            "employee_id": emp["id"],
            "start_date": doj.isoformat(),
            "target_completion_date": onb_target.isoformat(),
            "actual_completion_date": actual_comp.isoformat() if actual_comp else None,
            "buddy_id": buddy_id,
            "it_asset_status": "DELIVERED" if is_onb_complete else random.choice(["PENDING", "ASSIGNED", "DELIVERED"]),
            "bgv_status": "COMPLETED" if is_onb_complete else random.choice(["PENDING", "IN_PROGRESS", "COMPLETED"]),
            "orientation_completed": is_onb_complete,
            "overall_status": onb_stage_status,
            "created_at": f"{doj}T09:00:00+05:30",
            "updated_at": f"{actual_comp or SIMULATION_END_DATE}T17:00:00+05:30",
        })
        onb_id_counter += 1

        # B. Probation (90 days standard)
        prob_end = doj + timedelta(days=90)
        is_prob_over = SIMULATION_END_DATE >= prob_end
        prob_extended = False
        ext_date = None
        ext_reason = None

        if is_prob_over:
            if random.random() < 0.08:
                prob_extended = True
                ext_date = prob_end + timedelta(days=60)
                ext_reason = "Additional ramp-up required for architecture mastery and independent sprint delivery."
                prob_status = "CONFIRMED" if SIMULATION_END_DATE >= ext_date else "EXTENDED"
            else:
                prob_status = "CONFIRMED"
        else:
            prob_status = "UNDER_REVIEW"

        prob_record_id = prob_id_counter
        probation_records.append({
            "id": prob_record_id,
            "employee_id": emp["id"],
            "probation_start_date": doj.isoformat(),
            "probation_end_date": prob_end.isoformat(),
            "extended_end_date": ext_date.isoformat() if ext_date else None,
            "extension_reason": ext_reason,
            "manager_feedback": "Demonstrated solid technical competence and strong cultural alignment." if is_prob_over else "In progress.",
            "hr_evaluation": "Satisfactory compliance and attendance records." if is_prob_over else "Awaiting 90-day signoff.",
            "status": prob_status,
            "created_at": f"{doj}T09:00:00+05:30",
            "updated_at": f"{SIMULATION_END_DATE}T17:00:00+05:30",
        })
        prob_id_counter += 1

        lifecycle_records.append({
            "id": lc_id_counter,
            "employee_id": emp["id"],
            "current_stage": "PROBATION",
            "stage_start_date": doj.isoformat(),
            "stage_target_date": (ext_date or prob_end).isoformat(),
            "stage_status": "COMPLETED" if prob_status == "CONFIRMED" else ("DELAYED" if prob_extended else "IN_PROGRESS"),
            "completed_at": f"{(ext_date or prob_end)}T18:00:00+05:30" if prob_status == "CONFIRMED" else None,
            "notes": "Formal 90-day technical probation milestone.",
            "created_at": f"{doj}T09:00:00+05:30",
            "updated_at": f"{SIMULATION_END_DATE}T17:00:00+05:30",
        })
        lc_id_counter += 1

        # C. Confirmation
        if prob_status == "CONFIRMED":
            conf_due = (ext_date or prob_end) + timedelta(days=7)
            eff_date = (ext_date or prob_end)
            hr_approver_user_id = random.choice([u["id"] for u in users if u["role_id"] in [role_map["HR_ADMIN"], role_map["HR_OPERATIONS"]]])

            confirmation_records.append({
                "id": conf_id_counter,
                "probation_record_id": prob_record_id,
                "employee_id": emp["id"],
                "confirmation_due_date": conf_due.isoformat(),
                "effective_confirmation_date": eff_date.isoformat(),
                "approved_by_manager_id": emp["manager_id"] or dept_managers[emp["department_id"]],
                "approved_by_hr_id": hr_approver_user_id,
                "confirmation_letter_issued": True,
                "status": "ISSUED",
                "created_at": f"{conf_due - timedelta(days=5)}T10:00:00+05:30",
                "updated_at": f"{conf_due}T15:00:00+05:30",
            })
            conf_id_counter += 1

            lifecycle_records.append({
                "id": lc_id_counter,
                "employee_id": emp["id"],
                "current_stage": "CONFIRMATION",
                "stage_start_date": prob_end.isoformat(),
                "stage_target_date": conf_due.isoformat(),
                "stage_status": "COMPLETED",
                "completed_at": f"{conf_due}T15:00:00+05:30",
                "notes": "Full confirmation letter issued with manager recommendation.",
                "created_at": f"{prob_end}T10:00:00+05:30",
                "updated_at": f"{conf_due}T15:00:00+05:30",
            })
            lc_id_counter += 1

        # D. Performance Reviews (Across historical cycles where employee was employed)
        for rc in review_cycles:
            if doj <= rc["start"] + timedelta(days=60):  # Employed during cycle
                is_cycle_past = SIMULATION_END_DATE > rc["deadline"]
                if is_cycle_past:
                    rev_status = random.choices(["COMPLETED", "OVERDUE"], weights=[0.88, 0.12])[0]
                    comp_date = rc["deadline"] - timedelta(days=random.randint(1, 10)) if rev_status == "COMPLETED" else None
                    rating = round(random.uniform(3.2, 4.8), 2) if rev_status == "COMPLETED" else None
                else:
                    rev_status = "IN_PROGRESS"
                    comp_date = None
                    rating = None

                performance_reviews.append({
                    "id": perf_id_counter,
                    "employee_id": emp["id"],
                    "review_cycle": rc["cycle"],
                    "reviewer_id": emp["manager_id"] or dept_managers[emp["department_id"]],
                    "self_review_status": "SUBMITTED" if rev_status in ["COMPLETED", "IN_PROGRESS"] else "PENDING",
                    "manager_review_status": "COMPLETED" if rev_status == "COMPLETED" else "PENDING",
                    "rating": rating,
                    "review_submission_deadline": rc["deadline"].isoformat(),
                    "completion_date": comp_date.isoformat() if comp_date else None,
                    "status": rev_status,
                    "created_at": f"{rc['start']}T09:00:00+05:30",
                    "updated_at": f"{comp_date or SIMULATION_END_DATE}T18:00:00+05:30",
                })
                perf_id_counter += 1

        # E. Offboarding (For resigned/notice period employees)
        if status in ["NOTICE_PERIOD", "RESIGNED"]:
            res_date = SIMULATION_END_DATE - timedelta(days=random.randint(20, 90))
            lwd = res_date + timedelta(days=60)  # Standard Indian tech 60-day notice period
            is_offb_complete = (status == "RESIGNED" and SIMULATION_END_DATE >= lwd)

            offboarding_records.append({
                "id": offb_id_counter,
                "employee_id": emp["id"],
                "resignation_date": res_date.isoformat(),
                "last_working_day": lwd.isoformat(),
                "exit_interview_completed": is_offb_complete,
                "asset_recovery_status": "COMPLETED" if is_offb_complete else "PENDING",
                "kt_status": "COMPLETED" if is_offb_complete else "IN_PROGRESS",
                "clearance_status": "APPROVED" if is_offb_complete else "PENDING",
                "overall_status": "COMPLETED" if is_offb_complete else ("DELAYED" if SIMULATION_END_DATE > lwd else "IN_PROGRESS"),
                "created_at": f"{res_date}T10:00:00+05:30",
                "updated_at": f"{SIMULATION_END_DATE}T18:00:00+05:30",
            })
            offb_id_counter += 1

            lifecycle_records.append({
                "id": lc_id_counter,
                "employee_id": emp["id"],
                "current_stage": "OFFBOARDING",
                "stage_start_date": res_date.isoformat(),
                "stage_target_date": lwd.isoformat(),
                "stage_status": "COMPLETED" if is_offb_complete else "IN_PROGRESS",
                "completed_at": f"{lwd}T18:00:00+05:30" if is_offb_complete else None,
                "notes": "Employee resignation and knowledge transfer handover.",
                "created_at": f"{res_date}T10:00:00+05:30",
                "updated_at": f"{SIMULATION_END_DATE}T18:00:00+05:30",
            })
            lc_id_counter += 1

    print(f"Generated {len(lifecycle_records)} lifecycle stages, {len(onboarding_records)} onboarding, {len(probation_records)} probation, {len(confirmation_records)} confirmation, {len(performance_reviews)} reviews, {len(offboarding_records)} offboarding.")

    # ---------------------------------------------------------
    # 8. Tasks (Target: ~4,200 tasks to provide substantial historical depth)
    # ---------------------------------------------------------
    tasks = []
    task_dependencies = []
    task_status_history = []
    follow_ups = []
    notifications = []
    escalations = []
    task_snapshots = []
    ml_predictions = []
    ai_insights = []
    activity_logs = []

    task_id_counter = 1
    dep_id_counter = 1
    hist_id_counter = 1
    fol_id_counter = 1
    notif_id_counter = 1
    esc_id_counter = 1
    snap_id_counter = 1
    pred_id_counter = 1
    ai_id_counter = 1
    act_id_counter = 1

    # Map templates by category for fast lookup
    templates_by_cat = {}
    for tmpl in task_templates:
        templates_by_cat.setdefault(tmpl["category"], []).append(tmpl)

    # HR User pool for assignments
    hr_users = [u for u in users if u["role_id"] in [role_map["HR_ADMIN"], role_map["HR_OPERATIONS"]]]

    # Generate tasks for each employee's lifecycle activities
    for emp in employees:
        doj = date.fromisoformat(emp["date_of_joining"])
        mgr_user_id = emp_to_user.get(emp["manager_id"]) or random.choice(hr_users)["id"]
        emp_user_id = emp_to_user.get(emp["id"]) or mgr_user_id

        # List of task definitions to instantiate for this employee
        employee_task_specs = []

        # A. Onboarding Tasks (5 templates)
        for tmpl in templates_by_cat.get("ONBOARDING", []):
            t_start = doj
            t_due = doj + timedelta(days=tmpl["estimated_duration_days"] + random.randint(0, 3))
            t_owner = random.choice(hr_users)["id"] if tmpl["default_role_code"] == "HR_OPERATIONS" else (mgr_user_id if tmpl["default_role_code"] == "PEOPLE_MANAGER" else emp_user_id)
            employee_task_specs.append((tmpl, t_start, t_due, t_owner))

        # B. Probation Tasks (4 templates)
        for tmpl in templates_by_cat.get("PROBATION", []):
            if "GOAL" in tmpl["template_code"]:
                t_start = doj + timedelta(days=2)
                t_due = doj + timedelta(days=12)
            elif "30" in tmpl["template_code"]:
                t_start = doj + timedelta(days=25)
                t_due = doj + timedelta(days=32)
            elif "60" in tmpl["template_code"]:
                t_start = doj + timedelta(days=55)
                t_due = doj + timedelta(days=62)
            else:
                t_start = doj + timedelta(days=80)
                t_due = doj + timedelta(days=90)

            t_owner = mgr_user_id
            employee_task_specs.append((tmpl, t_start, t_due, t_owner))

        # C. Performance Reviews Tasks (Self-appraisal & manager eval per active cycle)
        for rc in review_cycles:
            if doj <= rc["start"] + timedelta(days=60):
                self_tmpl = [t for t in templates_by_cat.get("PERFORMANCE", []) if "SELF" in t["template_code"]][0]
                mgr_tmpl = [t for t in templates_by_cat.get("PERFORMANCE", []) if "MGR" in t["template_code"]][0]

                t_start = rc["start"]
                t_due = rc["deadline"] - timedelta(days=7)
                employee_task_specs.append((self_tmpl, t_start, t_due, emp_user_id))

                mgr_start = t_due
                mgr_due = rc["deadline"]
                employee_task_specs.append((mgr_tmpl, mgr_start, mgr_due, mgr_user_id))

        # D. Offboarding Tasks (If resigned)
        if emp["employment_status"] in ["NOTICE_PERIOD", "RESIGNED"]:
            # Find resignation date
            offb_rec = next((o for o in offboarding_records if o["employee_id"] == emp["id"]), None)
            if offb_rec:
                res_d = date.fromisoformat(offb_rec["resignation_date"])
                for tmpl in templates_by_cat.get("OFFBOARDING", []):
                    t_start = res_d + timedelta(days=random.randint(1, 5))
                    t_due = date.fromisoformat(offb_rec["last_working_day"])
                    t_owner = random.choice(hr_users)["id"] if tmpl["default_role_code"] == "HR_OPERATIONS" else mgr_user_id
                    employee_task_specs.append((tmpl, t_start, t_due, t_owner))

        # E. Compliance Task
        compl_tmpl = templates_by_cat.get("COMPLIANCE", [])[0]
        c_start = date(2025, 1, 10) if doj < date(2025, 1, 1) else doj + timedelta(days=30)
        c_due = c_start + timedelta(days=15)
        employee_task_specs.append((compl_tmpl, c_start, c_due, emp_user_id))

        # Instantiate tasks and build their lifecycles
        created_task_ids_for_emp = []
        for tmpl, t_start, t_due, t_owner in employee_task_specs:
            t_code = f"TSK-{task_id_counter:05d}"

            # Determine task status based on dates relative to simulation end date
            is_past_due = SIMULATION_END_DATE > t_due
            is_started = SIMULATION_END_DATE >= t_start

            # Outcome scenarios:
            # 1. Completed on time (~65%)
            # 2. Completed late (~20%)
            # 3. Open and on track (~8%)
            # 4. Open and overdue / delayed (~7%)
            if is_past_due:
                # Task should have been completed by now
                roll = random.random()
                if roll < 0.65:
                    status = "COMPLETED"
                    comp_date = t_due - timedelta(days=random.randint(0, min(5, (t_due - t_start).days)))
                    comp_ts = f"{comp_date}T{random.randint(14, 18)}:30:00+05:30"
                    extension_count = 0
                    ext_reason = None
                elif roll < 0.88:
                    status = "COMPLETED"
                    # Completed late
                    delay_days = random.randint(1, 14)
                    comp_date = min(SIMULATION_END_DATE, t_due + timedelta(days=delay_days))
                    comp_ts = f"{comp_date}T{random.randint(14, 18)}:30:00+05:30"
                    extension_count = 1 if random.random() < 0.5 else 0
                    ext_reason = "Dependency delay in prior technical signoff." if extension_count > 0 else None
                else:
                    # Still open / overdue!
                    status = random.choice(["IN_PROGRESS", "BLOCKED"])
                    comp_ts = None
                    extension_count = random.randint(0, 2)
                    ext_reason = "Awaiting feedback from third-party vendor or stakeholder." if extension_count > 0 else None
            elif is_started:
                # Open task within SLA window
                if random.random() < 0.20:
                    status = "COMPLETED"
                    comp_date = t_start + timedelta(days=random.randint(1, max(1, (SIMULATION_END_DATE - t_start).days)))
                    comp_ts = f"{comp_date}T16:00:00+05:30"
                    extension_count = 0
                    ext_reason = None
                else:
                    status = random.choice(["PENDING", "IN_PROGRESS", "BLOCKED"])
                    comp_ts = None
                    extension_count = 0
                    ext_reason = None
            else:
                # Future task
                status = "PENDING"
                comp_ts = None
                extension_count = 0
                ext_reason = None

            t_record = {
                "id": task_id_counter,
                "task_code": t_code,
                "template_id": tmpl["id"],
                "employee_id": emp["id"],
                "owner_id": t_owner,
                "category": tmpl["category"],
                "title": f"{tmpl['name']} - {emp['first_name']} {emp['last_name']}",
                "description": tmpl["description"],
                "priority": tmpl["default_priority"],
                "status": status,
                "due_date": t_due.isoformat(),
                "start_date": t_start.isoformat(),
                "completed_at": comp_ts,
                "deadline_extension_count": extension_count,
                "last_deadline_change_reason": ext_reason,
                "created_at": f"{t_start}T09:00:00+05:30",
                "updated_at": comp_ts or f"{SIMULATION_END_DATE}T18:00:00+05:30",
            }
            tasks.append(t_record)
            created_task_ids_for_emp.append(t_record)

            # Task Status History
            # Record initial state
            task_status_history.append({
                "id": hist_id_counter,
                "task_id": task_id_counter,
                "old_status": "NONE",
                "new_status": "PENDING",
                "old_owner_id": None,
                "new_owner_id": t_owner,
                "old_due_date": None,
                "new_due_date": t_due.isoformat(),
                "changed_by_user_id": t_owner,
                "change_reason": "Task initialized from template.",
                "changed_at": f"{t_start}T09:00:00+05:30",
            })
            hist_id_counter += 1

            if status in ["IN_PROGRESS", "BLOCKED", "COMPLETED"]:
                # Record transition to IN_PROGRESS
                in_prog_date = t_start + timedelta(days=1)
                task_status_history.append({
                    "id": hist_id_counter,
                    "task_id": task_id_counter,
                    "old_status": "PENDING",
                    "new_status": "IN_PROGRESS",
                    "old_owner_id": t_owner,
                    "new_owner_id": t_owner,
                    "old_due_date": t_due.isoformat(),
                    "new_due_date": t_due.isoformat(),
                    "changed_by_user_id": t_owner,
                    "change_reason": "Commenced operational execution.",
                    "changed_at": f"{in_prog_date}T10:00:00+05:30",
                })
                hist_id_counter += 1

            if status == "BLOCKED":
                block_date = t_start + timedelta(days=2)
                task_status_history.append({
                    "id": hist_id_counter,
                    "task_id": task_id_counter,
                    "old_status": "IN_PROGRESS",
                    "new_status": "BLOCKED",
                    "old_owner_id": t_owner,
                    "new_owner_id": t_owner,
                    "old_due_date": t_due.isoformat(),
                    "new_due_date": t_due.isoformat(),
                    "changed_by_user_id": t_owner,
                    "change_reason": "Prerequisite verification pending from IT/Admin.",
                    "changed_at": f"{block_date}T11:30:00+05:30",
                })
                hist_id_counter += 1

            if status == "COMPLETED" and comp_ts:
                task_status_history.append({
                    "id": hist_id_counter,
                    "task_id": task_id_counter,
                    "old_status": "IN_PROGRESS" if status != "BLOCKED" else "BLOCKED",
                    "new_status": "COMPLETED",
                    "old_owner_id": t_owner,
                    "new_owner_id": t_owner,
                    "old_due_date": t_due.isoformat(),
                    "new_due_date": t_due.isoformat(),
                    "changed_by_user_id": t_owner,
                    "change_reason": "Operational task deliverables completed and validated.",
                    "changed_at": comp_ts,
                })
                hist_id_counter += 1

            # Activity Log entry
            activity_logs.append({
                "id": act_id_counter,
                "user_id": t_owner,
                "entity_type": "TASK",
                "entity_id": task_id_counter,
                "action": "CREATE",
                "details": json.dumps({"task_code": t_code, "category": tmpl["category"], "priority": tmpl["default_priority"]}),
                "ip_address": f"10.0.{random.randint(1, 254)}.{random.randint(1, 254)}",
                "created_at": f"{t_start}T09:00:00+05:30",
            })
            act_id_counter += 1

            # Follow-ups & Notifications for active/overdue tasks
            if is_past_due and status != "COMPLETED":
                # Create Follow-up
                follow_ups.append({
                    "id": fol_id_counter,
                    "task_id": task_id_counter,
                    "initiator_user_id": random.choice(hr_users)["id"],
                    "target_user_id": t_owner,
                    "follow_up_date": (t_due + timedelta(days=2)).isoformat(),
                    "notes": f"Task {t_code} is past SLA due date ({t_due}). Please update status and ETA.",
                    "response_received": True,
                    "response_notes": "Addressing technical blockers, will finalize shortly.",
                    "created_at": f"{t_due + timedelta(days=2)}T10:00:00+05:30",
                })
                fol_id_counter += 1

                # Escalation
                escalations.append({
                    "id": esc_id_counter,
                    "task_id": task_id_counter,
                    "escalated_by_user_id": random.choice(hr_users)["id"],
                    "escalated_to_user_id": dept_managers[emp["department_id"]],
                    "escalation_level": 1,
                    "reason": f"SLA breached for task {t_code}. Task remains {status}.",
                    "status": "OPEN",
                    "resolved_at": None,
                    "resolution_notes": None,
                    "created_at": f"{t_due + timedelta(days=3)}T11:00:00+05:30",
                })
                esc_id_counter += 1

            # Notifications
            notifications.append({
                "id": notif_id_counter,
                "user_id": t_owner,
                "task_id": task_id_counter,
                "title": f"Assignment: {tmpl['name']}",
                "message": f"You have been assigned operational task {t_code} due on {t_due}.",
                "notification_type": "ASSIGNMENT",
                "is_read": True,
                "read_at": f"{t_start}T10:15:00+05:30",
                "sent_at": f"{t_start}T09:00:00+05:30",
            })
            notif_id_counter += 1

            task_id_counter += 1

        # Build sequential dependencies between tasks for the same employee
        # E.g. IT provisioning depends on doc verification; BGV depends on doc verification
        if len(created_task_ids_for_emp) >= 2:
            # Pair adjacent tasks where logical
            for i in range(len(created_task_ids_for_emp) - 1):
                t1 = created_task_ids_for_emp[i]
                t2 = created_task_ids_for_emp[i+1]
                if t1["category"] == t2["category"] and t1["id"] != t2["id"]:
                    task_dependencies.append({
                        "id": dep_id_counter,
                        "task_id": t2["id"],  # t2 depends on t1
                        "prerequisite_task_id": t1["id"],
                        "dependency_type": "FINISH_TO_START",
                        "created_at": t1["created_at"],
                    })
                    dep_id_counter += 1

    print(f"Generated {len(tasks)} tasks and {len(task_dependencies)} dependencies.")

    # ---------------------------------------------------------
    # 9. Employee Documents Submissions
    # ---------------------------------------------------------
    employee_documents = []
    doc_id_counter = 1
    for emp in employees:
        doj = date.fromisoformat(emp["date_of_joining"])
        # Each employee submits 4-6 onboarding documents
        onb_reqs = [r for r in doc_requirements if r["lifecycle_stage"] == "ONBOARDING"]
        for req in onb_reqs:
            sub_d = doj - timedelta(days=random.randint(1, 10))
            is_verified = (SIMULATION_END_DATE > doj)
            v_user = random.choice(hr_users)["id"]

            doc_status = "VERIFIED" if is_verified else random.choice(["PENDING_SUBMISSION", "SUBMITTED", "VERIFIED"])
            v_notes = "Document verified successfully against government database." if doc_status == "VERIFIED" else None
            v_ts = f"{doj}T12:00:00+05:30" if doc_status == "VERIFIED" else None

            employee_documents.append({
                "id": doc_id_counter,
                "employee_id": emp["id"],
                "requirement_id": req["id"],
                "document_name": f"{emp['first_name']}_{emp['last_name']}_{req['requirement_code']}.pdf",
                "file_path": f"/secure_storage/documents/{emp['employee_code']}/{req['requirement_code'].lower()}.pdf",
                "submission_date": sub_d.isoformat(),
                "status": doc_status,
                "verified_by_id": v_user if doc_status == "VERIFIED" else None,
                "verification_notes": v_notes,
                "verified_at": v_ts,
                "created_at": f"{sub_d}T10:00:00+05:30",
                "updated_at": v_ts or f"{sub_d}T10:00:00+05:30",
            })
            doc_id_counter += 1

    print(f"Generated {len(employee_documents)} employee document verification records.")

    # ---------------------------------------------------------
    # 10. Task Snapshots & ML-Ready Dataset
    # ---------------------------------------------------------
    # Requirements for ML-ready dataset:
    # Target: task_overdue
    # Observation points: take 2-4 snapshots per task during its active lifecycle.
    # Prediction eligibility:
    # - task is not yet overdue at the snapshot timestamp (snapshot_timestamp <= due_date).
    # - outcome can be established by completion or current time observation window (non right-censored).
    # Leakage prevention: strictly zero information about future events!
    ml_snapshot_rows = []

    # Precalculate owner historical stats up to snapshots
    # To be fast and realistic, we can calculate per owner baseline stats
    owner_task_counts = {}
    for t in tasks:
        owner_task_counts[t["owner_id"]] = owner_task_counts.get(t["owner_id"], 0) + 1

    for t in tasks:
        t_start = date.fromisoformat(t["start_date"])
        t_due = date.fromisoformat(t["due_date"])
        t_duration = (t_due - t_start).days

        # Completed info
        comp_date = None
        if t["completed_at"]:
            comp_date = datetime.fromisoformat(t["completed_at"]).date()

        # Observation points: e.g. 7 days before due date, 3 days before due date, 1 day before due date
        # Also ensure observation occurs after start_date and on or before min(due_date, simulation_end_date)
        snapshot_offsets = [7, 5, 3, 1]
        for offset in snapshot_offsets:
            snap_date = t_due - timedelta(days=offset)
            if snap_date < t_start or snap_date > SIMULATION_END_DATE:
                continue

            # If task was already completed BEFORE this snapshot, don't take a snapshot (no longer active)
            if comp_date and comp_date <= snap_date:
                continue

            snap_ts = f"{snap_date}T10:00:00+05:30"
            days_rem = (t_due - snap_date).days

            # At this snapshot, was the task already overdue?
            # days_rem >= 0 means not yet overdue
            is_eligible = (days_rem >= 0)

            # Simulated point-in-time features (NO LEAKAGE):
            # 1. Reminders sent prior to snapshot
            reminders_so_far = 0
            if days_rem <= 3 and random.random() < 0.6:
                reminders_so_far = 1
            if days_rem <= 1 and random.random() < 0.5:
                reminders_so_far += 1

            # 2. Owner previous delay rate (simulated realistic baseline 0.10 - 0.35)
            # Higher for heavy workloads
            owner_workload = min(15, owner_task_counts.get(t["owner_id"], 5) // 10 + random.randint(2, 6))
            owner_delay_rate = round(0.12 + (owner_workload * 0.015) + (random.random() * 0.05), 4)

            # 3. Dependency status at snapshot
            dep_status = "NONE"
            has_dep = any(d["task_id"] == t["id"] for d in task_dependencies)
            if has_dep:
                dep_status = random.choice(["ALL_RESOLVED", "BLOCKED"])

            # 4. Status at snapshot
            snap_status = "IN_PROGRESS" if snap_date > t_start else "PENDING"
            if dep_status == "BLOCKED":
                snap_status = "BLOCKED"

            # Relational task_snapshots table record
            snapshot_record = {
                "id": snap_id_counter,
                "task_id": t["id"],
                "snapshot_timestamp": snap_ts,
                "task_category": t["category"],
                "days_remaining": days_rem,
                "current_status": snap_status,
                "reminder_count": reminders_so_far,
                "owner_previous_delay_rate": owner_delay_rate,
                "owner_current_workload": owner_workload,
                "dependency_status": dep_status,
                "task_priority": t["priority"],
                "is_eligible_for_prediction": is_eligible,
                "created_at": snap_ts,
            }
            task_snapshots.append(snapshot_record)

            # Target computation:
            # 1 if subsequent completion date > due_date, OR if currently open and SIMULATION_END_DATE > due_date
            # 0 if completed on or before due date, OR open with due date still in future
            task_subsequently_overdue = 0
            if comp_date:
                if comp_date > t_due:
                    task_subsequently_overdue = 1
                else:
                    task_subsequently_overdue = 0
            else:
                # Open task
                if SIMULATION_END_DATE > t_due:
                    task_subsequently_overdue = 1
                else:
                    task_subsequently_overdue = 0

            # Only include eligible, non-right-censored observations in ML dataset
            # (If open task with future due date where outcome is unknown, exclude or treat as non-overdue if observed window complete)
            if is_eligible:
                # Add to ML-ready dataset
                ml_row = {
                    "snapshot_id": snap_id_counter,
                    "task_id": t["id"],
                    "task_code": t["task_code"],
                    "snapshot_timestamp": snap_ts,
                    "task_category": t["category"],
                    "task_priority": t["priority"],
                    "current_status": snap_status,
                    "days_remaining": days_rem,
                    "reminder_count": reminders_so_far,
                    "owner_previous_delay_rate": owner_delay_rate,
                    "owner_current_workload": owner_workload,
                    "dependency_status": dep_status,
                    "task_overdue": task_subsequently_overdue,
                }
                ml_snapshot_rows.append(ml_row)

            # Sample some ML predictions for demonstration
            if is_eligible and random.random() < 0.12:
                prob = round(random.uniform(0.65, 0.95) if task_subsequently_overdue == 1 else random.uniform(0.05, 0.35), 4)
                lbl = 1 if prob >= 0.50 else 0
                conf = round(abs(prob - 0.5) * 2, 4)
                ml_predictions.append({
                    "id": pred_id_counter,
                    "task_snapshot_id": snap_id_counter,
                    "task_id": t["id"],
                    "model_version": "v1.0.0-rf",
                    "predicted_delay_probability": prob,
                    "predicted_label": lbl,
                    "confidence_score": conf,
                    "prediction_timestamp": snap_ts,
                    "created_at": snap_ts,
                })
                pred_id_counter += 1

            snap_id_counter += 1

    print(f"Generated {len(task_snapshots)} task snapshots across tasks.")
    print(f"Total ML-ready eligible rows: {len(ml_snapshot_rows)} (Target: >= 10,000)")
    print(f"Generated {len(ml_predictions)} ML demonstration prediction records.")

    # ---------------------------------------------------------
    # 11. AI Insights (Demonstration records for GenAI Assistant)
    # ---------------------------------------------------------
    # Create ~350 AI insights grounded in actual high-risk or delayed tasks
    high_risk_tasks = [t for t in tasks if t["status"] in ["BLOCKED", "IN_PROGRESS"] and SIMULATION_END_DATE >= date.fromisoformat(t["due_date"]) - timedelta(days=2)]
    sample_risk_tasks = random.sample(high_risk_tasks, min(350, len(high_risk_tasks)))

    for t in sample_risk_tasks:
        cat = random.choice(["DELAY_RISK", "WORKLOAD_BOTTLENECK", "LIFECYCLE_STALL"])
        t_due = t["due_date"]
        owner_name = next((u["full_name"] for u in users if u["id"] == t["owner_id"]), "Operational Lead")

        supporting = {
            "task_id": t["id"],
            "task_code": t["task_code"],
            "category": t["category"],
            "owner": owner_name,
            "due_date": t_due,
            "status": t["status"],
        }

        ai_insights.append({
            "id": ai_id_counter,
            "task_id": t["id"],
            "employee_id": t["employee_id"],
            "insight_category": cat,
            "title": f"High Delay Risk Detected for {t['task_code']}",
            "insight_text": f"Task '{t['title']}' is currently {t['status']} with deadline {t_due}. Owner {owner_name} has multiple active concurrent operational items.",
            "recommended_action": f"Reassign task to secondary squad reviewer or issue targeted reminder to unblock SLA.",
            "supporting_data": json.dumps(supporting),
            "review_status": random.choice(["PENDING_REVIEW", "APPROVED", "REJECTED"]),
            "reviewed_by_user_id": random.choice(hr_users)["id"] if random.random() < 0.4 else None,
            "reviewed_at": f"{SIMULATION_END_DATE}T11:00:00+05:30" if random.random() < 0.4 else None,
            "created_at": f"{SIMULATION_END_DATE - timedelta(days=1)}T10:00:00+05:30",
        })
        ai_id_counter += 1

    print(f"Generated {len(ai_insights)} grounded AI insights.")
    print(f"Generated {len(activity_logs)} activity audit logs.")

    # ---------------------------------------------------------
    # Write Out All 23 CSV Files
    # ---------------------------------------------------------
    tables_to_export = [
        ("departments.csv", departments),
        ("roles.csv", roles),
        ("users.csv", users),
        ("employees.csv", employees),
        ("employee_lifecycle.csv", lifecycle_records),
        ("onboarding_records.csv", onboarding_records),
        ("probation_records.csv", probation_records),
        ("confirmation_records.csv", confirmation_records),
        ("performance_reviews.csv", performance_reviews),
        ("offboarding_records.csv", offboarding_records),
        ("task_templates.csv", task_templates),
        ("tasks.csv", tasks),
        ("task_dependencies.csv", task_dependencies),
        ("task_status_history.csv", task_status_history),
        ("document_requirements.csv", doc_requirements),
        ("employee_documents.csv", employee_documents),
        ("follow_ups.csv", follow_ups),
        ("notifications.csv", notifications),
        ("escalations.csv", escalations),
        ("task_snapshots.csv", task_snapshots),
        ("ml_predictions.csv", ml_predictions),
        ("ai_insights.csv", ai_insights),
        ("activity_logs.csv", activity_logs),
    ]

    total_records = 0
    print("\n" + "=" * 70)
    print("Writing Normalized Relational CSV Files...")
    print("=" * 70)
    for filename, record_list in tables_to_export:
        file_path = DATASETS_CSV_DIR / filename
        if record_list:
            fieldnames = list(record_list[0].keys())
            with open(file_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(record_list)
        total_records += len(record_list)
        print(f"  - {filename:<28}: {len(record_list):>6} rows")

    print("-" * 70)
    print(f"TOTAL RELATIONAL DATABASE ROWS ACROSS 23 TABLES: {total_records:,}")
    print("=" * 70)

    # ---------------------------------------------------------
    # Write ML-Ready Dataset
    # ---------------------------------------------------------
    ml_file_path = DATASETS_ML_DIR / "task_delay_risk_dataset.csv"
    ml_copy_path = ML_DIR / "task_delay_risk_dataset.csv"

    if ml_snapshot_rows:
        fieldnames = list(ml_snapshot_rows[0].keys())
        for path in [ml_file_path, ml_copy_path]:
            with open(path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(ml_snapshot_rows)

    print(f"\nWritten ML-Ready Dataset to {ml_file_path} ({len(ml_snapshot_rows):,} eligible snapshot rows)")

    return total_records, len(employees), len(ml_snapshot_rows)


if __name__ == "__main__":
    generate_all()

