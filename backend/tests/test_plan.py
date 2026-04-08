"""
Unit tests for app/plan.py

Covers:
- trial_period_end
- _to_naive_utc
- now_naive_utc
- is_plan_user
- clear_plan
- ensure_professor_plan_defaults
- refresh_user_plan_status
- compute_trial_days_remaining
- user_to_out
"""

from datetime import datetime, timedelta, timezone, date
from unittest.mock import patch

import pytest

from app import plan as plan_module
from app.plan import (
    TRIAL_DAYS,
    PLAN_TRIAL,
    PLAN_MONTHLY,
    PLAN_ANNUAL,
    STATUS_ACTIVE,
    STATUS_EXPIRED,
    trial_period_end,
    _to_naive_utc,
    is_plan_user,
    clear_plan,
    ensure_professor_plan_defaults,
    refresh_user_plan_status,
    compute_trial_days_remaining,
    user_to_out,
)
from app.models import User, UserPlan
from .conftest import make_user


def _make_plain_user(**kwargs):
    """Build an unsaved User ORM object for pure logic tests (no DB needed)."""
    u = User()
    u.id = kwargs.get("id", 1)
    u.email = kwargs.get("email", "x@x.com")
    u.nome = kwargs.get("nome", "Test User")
    u.role = kwargs.get("role", "professor")
    u.researcher_id = kwargs.get("researcher_id", None)
    u.last_login = kwargs.get("last_login", None)
    u.created_at = kwargs.get("created_at", datetime.utcnow())
    # Plan fields live in a separate UserPlan object
    plan_type = kwargs.get("plan_type", None)
    plan_status = kwargs.get("plan_status", None)
    account_activated_at = kwargs.get("account_activated_at", None)
    plan_period_ends_at = kwargs.get("plan_period_ends_at", None)
    if any(v is not None for v in [plan_type, plan_status, account_activated_at, plan_period_ends_at]):
        p = UserPlan()
        p.user_id = u.id
        p.plan_type = plan_type
        p.plan_status = plan_status
        p.account_activated_at = account_activated_at
        p.plan_period_ends_at = plan_period_ends_at
        u.plan = p
    else:
        u.plan = None
    return u


# ---------------------------------------------------------------------------
# trial_period_end
# ---------------------------------------------------------------------------

class TestTrialPeriodEnd:
    def test_adds_30_days(self):
        activated = datetime(2025, 1, 1)
        end = trial_period_end(activated)
        assert end == datetime(2025, 1, 31)

    def test_constant_matches_trial_days(self):
        activated = datetime(2025, 3, 1)
        end = trial_period_end(activated)
        assert (end - activated).days == TRIAL_DAYS


# ---------------------------------------------------------------------------
# _to_naive_utc
# ---------------------------------------------------------------------------

class TestToNaiveUtc:
    def test_naive_datetime_returned_unchanged(self):
        naive = datetime(2025, 6, 15, 12, 0, 0)
        result = _to_naive_utc(naive)
        assert result == naive
        assert result.tzinfo is None

    def test_aware_datetime_converted_to_naive_utc(self):
        aware = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        result = _to_naive_utc(aware)
        assert result.tzinfo is None
        assert result == datetime(2025, 6, 15, 12, 0, 0)


# ---------------------------------------------------------------------------
# is_plan_user
# ---------------------------------------------------------------------------

class TestIsPlanUser:
    def test_professor_is_plan_user(self):
        u = _make_plain_user(role="professor")
        assert is_plan_user(u) is True

    def test_superadmin_is_plan_user(self):
        u = _make_plain_user(role="superadmin")
        assert is_plan_user(u) is True

    def test_researcher_is_not_plan_user(self):
        u = _make_plain_user(role="researcher")
        assert is_plan_user(u) is False

    def test_admin_is_not_plan_user(self):
        u = _make_plain_user(role="admin")
        assert is_plan_user(u) is False


# ---------------------------------------------------------------------------
# clear_plan
# ---------------------------------------------------------------------------

class TestClearPlan:
    def test_clears_all_plan_fields(self):
        u = _make_plain_user(
            plan_type=PLAN_TRIAL,
            plan_status=STATUS_ACTIVE,
            account_activated_at=datetime(2025, 1, 1),
            plan_period_ends_at=datetime(2025, 1, 31),
        )
        clear_plan(u)

        assert u.plan.plan_type is None
        assert u.plan.plan_status is None
        assert u.plan.account_activated_at is None
        assert u.plan.plan_period_ends_at is None

    def test_clear_plan_is_idempotent(self):
        u = _make_plain_user()
        clear_plan(u)  # u.plan is None — should not raise
        assert u.plan is None


# ---------------------------------------------------------------------------
# ensure_professor_plan_defaults
# ---------------------------------------------------------------------------

class TestEnsureProfessorPlanDefaults:
    def test_sets_trial_for_professor_without_plan(self):
        u = _make_plain_user(role="professor")
        result = ensure_professor_plan_defaults(u)

        assert result is True
        assert u.plan.plan_type == PLAN_TRIAL
        assert u.plan.plan_status == STATUS_ACTIVE
        assert u.plan.account_activated_at is not None
        assert u.plan.plan_period_ends_at is not None

    def test_sets_trial_for_superadmin_without_plan(self):
        u = _make_plain_user(role="superadmin")
        result = ensure_professor_plan_defaults(u)
        assert result is True
        assert u.plan.plan_type == PLAN_TRIAL

    def test_does_not_override_existing_plan(self):
        u = _make_plain_user(role="professor", plan_type=PLAN_MONTHLY)
        result = ensure_professor_plan_defaults(u)

        assert result is False
        assert u.plan.plan_type == PLAN_MONTHLY

    def test_returns_false_for_researcher(self):
        u = _make_plain_user(role="researcher")
        result = ensure_professor_plan_defaults(u)

        assert result is False
        assert u.plan is None

    def test_returns_false_for_admin(self):
        u = _make_plain_user(role="admin")
        result = ensure_professor_plan_defaults(u)
        assert result is False

    def test_plan_period_ends_at_is_30_days_from_activation(self):
        u = _make_plain_user(role="professor")
        ensure_professor_plan_defaults(u)

        delta = u.plan.plan_period_ends_at - u.plan.account_activated_at
        assert delta.days == TRIAL_DAYS


# ---------------------------------------------------------------------------
# refresh_user_plan_status
# ---------------------------------------------------------------------------

class TestRefreshUserPlanStatus:
    def test_sets_expired_when_period_has_ended(self, db):
        past = datetime(2020, 1, 1)
        user = make_user(
            db,
            role="professor",
            plan_type=PLAN_TRIAL,
            plan_status=STATUS_ACTIVE,
            account_activated_at=past,
            plan_period_ends_at=past + timedelta(days=TRIAL_DAYS),
        )

        refresh_user_plan_status(db, user)
        db.refresh(user)
        assert user.plan.plan_status == STATUS_EXPIRED

    def test_sets_active_when_period_has_not_ended(self, db):
        future = datetime.utcnow() + timedelta(days=10)
        user = make_user(
            db,
            role="professor",
            plan_type=PLAN_TRIAL,
            plan_status=STATUS_EXPIRED,
            account_activated_at=datetime.utcnow(),
            plan_period_ends_at=future,
        )

        refresh_user_plan_status(db, user)
        db.refresh(user)
        assert user.plan.plan_status == STATUS_ACTIVE

    def test_no_op_for_researcher(self, db):
        user = make_user(db, role="researcher")
        # Should not raise or change anything
        refresh_user_plan_status(db, user)
        assert user.plan is None

    def test_no_op_when_plan_period_ends_at_is_none(self, db):
        user = make_user(
            db,
            role="professor",
            plan_type=PLAN_TRIAL,
            plan_status=STATUS_ACTIVE,
            plan_period_ends_at=None,
        )
        refresh_user_plan_status(db, user)
        assert user.plan.plan_status == STATUS_ACTIVE

    def test_no_change_when_status_already_correct(self, db):
        past = datetime(2020, 1, 1)
        user = make_user(
            db,
            role="professor",
            plan_type=PLAN_TRIAL,
            plan_status=STATUS_EXPIRED,
            account_activated_at=past,
            plan_period_ends_at=past + timedelta(days=TRIAL_DAYS),
        )
        # status is already expired — commit should not be called redundantly
        refresh_user_plan_status(db, user)
        db.refresh(user)
        assert user.plan.plan_status == STATUS_EXPIRED


# ---------------------------------------------------------------------------
# compute_trial_days_remaining
# ---------------------------------------------------------------------------

class TestComputeTrialDaysRemaining:
    def test_returns_none_for_researcher(self):
        u = _make_plain_user(role="researcher")
        assert compute_trial_days_remaining(u) is None

    def test_returns_none_for_non_trial_plan(self):
        u = _make_plain_user(role="professor", plan_type=PLAN_MONTHLY, plan_status=STATUS_ACTIVE)
        assert compute_trial_days_remaining(u) is None

    def test_returns_none_when_plan_period_ends_at_is_none(self):
        u = _make_plain_user(role="professor", plan_type=PLAN_TRIAL)
        assert compute_trial_days_remaining(u) is None

    def test_returns_positive_days_when_trial_active(self):
        future = datetime.utcnow() + timedelta(days=10)
        u = _make_plain_user(role="professor", plan_type=PLAN_TRIAL, plan_period_ends_at=future)

        result = compute_trial_days_remaining(u)
        assert result is not None
        assert result > 0

    def test_returns_zero_when_trial_expired(self):
        past = datetime(2020, 1, 1)
        u = _make_plain_user(role="professor", plan_type=PLAN_TRIAL, plan_period_ends_at=past)

        result = compute_trial_days_remaining(u)
        assert result == 0


# ---------------------------------------------------------------------------
# user_to_out
# ---------------------------------------------------------------------------

class TestUserToOut:
    def test_researcher_gets_no_plan_fields(self):
        u = _make_plain_user(role="researcher")
        out = user_to_out(u)

        assert out.plan_type is None
        assert out.plan_status is None
        assert out.account_activated_at is None
        assert out.plan_period_ends_at is None
        assert out.trial_days_remaining is None

    def test_professor_gets_plan_fields(self):
        future = datetime.utcnow() + timedelta(days=15)
        u = _make_plain_user(
            role="professor",
            plan_type=PLAN_TRIAL,
            plan_status=STATUS_ACTIVE,
            account_activated_at=datetime.utcnow() - timedelta(days=1),
            plan_period_ends_at=future,
        )
        out = user_to_out(u)

        assert out.plan_type == PLAN_TRIAL
        assert out.plan_status == STATUS_ACTIVE
        assert out.trial_days_remaining is not None
        assert out.trial_days_remaining > 0

    def test_admin_gets_no_plan_fields(self):
        u = _make_plain_user(role="admin")
        out = user_to_out(u)
        assert out.plan_type is None

    def test_basic_fields_always_present(self):
        u = _make_plain_user(role="researcher")
        u.email = "user@test.com"
        u.nome = "Full Name"
        out = user_to_out(u)

        assert out.email == "user@test.com"
        assert out.nome == "Full Name"
        assert out.role == "researcher"
