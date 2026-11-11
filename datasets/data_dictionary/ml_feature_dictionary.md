# ML FEATURE DICTIONARY: TASK DELAY RISK PREDICTION
## HR Operations Platform — Machine Learning Architecture

> **Dataset Name**: `task_delay_risk_dataset.csv`  
> **Model Target**: Binary Task Delay Risk (`task_overdue`)  
> **Total Eligible Snapshots Generated**: 15,414 valid snapshot observations  
> **Temporal Coverage**: 24+ Months (November 2024 - November 2026)

---

## 1. Feature Specifications

| # | Feature Name | Data Type | Domain / Range | Description | Leakage Prevention Rule |
|---|---|---|---|---|---|
| 1 | `snapshot_id` | Integer | ID (1 .. N) | Unique identifier for point-in-time observation. | Meta-identifier (excluded from model input). |
| 2 | `task_id` | Integer | ID (1 .. N) | Underlying task identifier. | Used for group-aware cross-validation splitting. |
| 3 | `task_code` | String | e.g. `TSK-00001` | Unique operational tracking code. | Meta-identifier. |
| 4 | `snapshot_timestamp` | ISO8601 | YYYY-MM-DDTHH:MM:SS+05:30 | Point-in-time instant when state was evaluated. | Enforces strictly retrospective observation window. |
| 5 | `task_category` | Categorical | `ONBOARDING`, `PROBATION`, `CONFIRMATION`, `PERFORMANCE`, `OFFBOARDING`, `COMPLIANCE` | Functional lifecycle domain of task. | Static attribute established at creation time. |
| 6 | `task_priority` | Categorical | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Relative urgency of operational item. | Static or state at snapshot instant. |
| 7 | `current_status` | Categorical | `PENDING`, `IN_PROGRESS`, `BLOCKED` | Operational status of task at snapshot. | No future status; only state prior to or at snapshot. |
| 8 | `days_remaining` | Integer | >= 0 | Calendar days from snapshot to scheduled due date. | Positive integer. Observations where days_remaining < 0 are excluded. |
| 9 | `reminder_count` | Integer | 0, 1, 2, ... | Count of reminders sent prior to snapshot. | Strictly counts notifications dispatched on or before snapshot timestamp. |
| 10 | `owner_previous_delay_rate` | Float | 0.0000 - 1.0000 | Historical ratio of overdue tasks completed by owner prior to snapshot. | Rolling historical statistic up to snapshot time. |
| 11 | `owner_current_workload` | Integer | 1, 2, 3, ... | Number of active tasks assigned to owner at snapshot. | Point-in-time snapshot of owner concurrent queue. |
| 12 | `dependency_status` | Categorical | `NONE`, `ALL_RESOLVED`, `BLOCKED` | Health of prerequisite upstream tasks at snapshot. | Evaluated strictly on prerequisite states prior to snapshot. |

---

## 2. Target Definition

| Target Field | Data Type | Values | Mathematical Formulation |
|---|---|---|---|
| `task_overdue` | Binary Integer | `0` or `1` | `1` if task completion timestamp > due date OR (task open and current time > due date); `0` otherwise. |

### Eligibility & Censoring Rules
- **Non-Overdue Requirement**: Snapshots are only eligible if taken **before** the task reaches its scheduled due date (`days_remaining >= 0`). Tasks that are already overdue at the snapshot instant are excluded.
- **Right-Censored Handling**: Only tasks with sufficient observation window (either completed or observed through due date) are included.
- **Independence Guarantee**: Multiple snapshot observations taken from the same task represent different time horizons ($t - 7$, $t - 3$, $t - 1$ days). When training models, group-aware cross-validation (GroupKFold grouped on `task_id`) or chronological train/test time splitting MUST be used to prevent inter-snapshot leakage across splits.

---

## 3. Recommended Evaluation Methodology

1. **Chronological Train/Test Partitioning**:
   - Train set: Snapshots observed prior to May 2026.
   - Validation/Test set: Snapshots observed between May 2026 and November 2026.
2. **Metrics**:
   - Primary: Area Under ROC Curve (ROC-AUC) and Precision-Recall AUC (PR-AUC).
   - Operational Threshold Metric: Precision and Recall at top 15% predicted risk threshold (actionable intervention queue).

