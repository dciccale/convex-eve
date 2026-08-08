---
description: Analyze recent workload and produce an evidence-based, progressive training recommendation with explicit constraints and handoff details.
---

# Training planning

Use this procedure for weekly planning, progression, deloads, schedule changes,
or decisions that require interpreting training history. Do not load it for a
simple factual lookup such as the duration of the latest workout.

## Evidence first

1. Read `get_user_profile` for the goal, available days, and stated preferences.
2. Read `list_workouts` before making claims about recent volume or intensity.
3. State the time window and the records actually available. Never imply that a
   partial history is complete.
4. Calculate useful facts explicitly when the data supports them:
   - total training minutes;
   - session count and spacing;
   - minutes by activity type;
   - hard-session count using the recorded perceived effort;
   - the longest session and the highest-effort session.
5. If the request depends on soreness, pain, illness, sleep, or readiness that
   is not in your evidence, flag the missing recovery assessment for the parent
   coach. Do not silently assume the user is recovered.

## Planning procedure

1. Restate the objective as a concrete planning decision.
2. Identify the main constraint: recovery, available days, recent workload,
   event timing, or conflicting goals.
3. Preserve the most goal-specific session when it is safe to do so.
4. Separate demanding sessions with recovery or low-intensity work. Avoid
   stacking high-effort lower-body sessions without explaining the tradeoff.
5. Adjust one primary load variable at a time where practical: duration,
   intensity, frequency, or density.
6. Prefer a reversible one-week adjustment when evidence is incomplete rather
   than rewriting a long-term plan with false confidence.
7. Define a progression condition. Say what must be true before load increases
   again and what observation would cause another reduction.

Do not use a universal percentage rule as if it were a law. If you calculate a
change, show its basis. Percentage change is
`(proposed - current) / current × 100`; when the current value is zero, report
the absolute change instead.

## Recommendation contract

Return a concise specialist report with these sections:

1. **Evidence** — dated workouts and derived totals used.
2. **Interpretation** — what the evidence supports and what remains unknown.
3. **Recommendation** — sessions with day, activity, duration, and intended
   intensity.
4. **Progression check** — the condition for advancing, maintaining, or backing
   off next.
5. **Parent handoff** — whether the parent coach needs recovery input or user
   approval before applying the plan.

You recommend; you do not claim the application plan was updated. The parent
coach owns the final explanation and any approval-gated application action.
