import { lazy, Suspense } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'

import { AuthLayout }     from '@/components/layout/auth-layout'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { SocialLayout }    from '@/components/layout/social-layout'
import { SocialPageLayout } from '@/components/layout/social-page-layout'
import { RouteFallback }  from '@/components/feedback/route-fallback'
import { ResetPasswordPage } from '@/pages/auth/reset-password-page'
import { NotFoundPage }   from '@/pages/misc/not-found-page'
import { RootRedirect }   from '@/pages/misc/root-redirect'
import { OfflineBanner }  from '@/components/common/offline-banner'
import { GuestRoute }     from '@/routes/GuestRoute'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { RoleGuard }      from '@/routes/RoleGuard'
import { useAuth }        from '@/contexts/auth-context'

// Landing page
const LandingPage          = lazy(() => import('@/pages/landing/landing-page').then(m => ({ default: m.LandingPage })))

// Social pages
const SocialFeedPage       = lazy(() => import('@/pages/social/social-feed-page').then(m => ({ default: m.SocialFeedPage })))
const SocialProfilePage    = lazy(() => import('@/pages/social/social-profile-page').then(m => ({ default: m.SocialProfilePage })))
const SocialPostDetailPage = lazy(() => import('@/pages/social/social-post-detail-page').then(m => ({ default: m.SocialPostDetailPage })))
const SocialSearchPage     = lazy(() => import('@/pages/social/social-search-page').then(m => ({ default: m.SocialSearchPage })))
const SocialNotifPage      = lazy(() => import('@/pages/social/social-notifications-page').then(m => ({ default: m.SocialNotificationsPage })))
const SocialBookmarksPage  = lazy(() => import('@/pages/social/social-bookmarks-page').then(m => ({ default: m.SocialBookmarksPage })))
const SocialDraftsPage     = lazy(() => import('@/pages/social/social-drafts-page').then(m => ({ default: m.SocialDraftsPage })))
const SocialCreatePage     = lazy(() => import('@/pages/social/social-create-post-page').then(m => ({ default: m.SocialCreatePage })))
const SocialHashtagPage    = lazy(() => import('@/pages/social/social-hashtag-page').then(m => ({ default: m.SocialHashtagPage })))
const NewsPage             = lazy(() => import('@/pages/social/news-page').then(m => ({ default: m.NewsPage })))
const AdminSocialPage      = lazy(() => import('@/pages/social/admin-social-moderation-page').then(m => ({ default: m.AdminSocialModerationPage })))

const CreatorApplicationStatusPage = lazy(() =>
  import('@/pages/account/creator-application-status-page').then((m) => ({ default: m.CreatorApplicationStatusPage })),
)

const AuditPage = lazy(() => import('@/pages/admin/audit-page').then((m) => ({ default: m.AuditPage })))
const SuperAdminCreatorsPage = lazy(() =>
  import('@/pages/admin/super-admin-creators-page').then((m) => ({ default: m.SuperAdminCreatorsPage })),
)
const SuperAdminElectionsPage = lazy(() =>
  import('@/pages/admin/super-admin-elections-page').then((m) => ({ default: m.SuperAdminElectionsPage })),
)
const SuperAdminElectionManagePage = lazy(() =>
  import('@/pages/admin/super-admin-election-manage-page').then((m) => ({ default: m.SuperAdminElectionManagePage })),
)
const SuperAdminOverviewPage = lazy(() =>
  import('@/pages/admin/super-admin-overview-page').then((m) => ({ default: m.SuperAdminOverviewPage })),
)
const UsersPage = lazy(() => import('@/pages/admin/users-page').then((m) => ({ default: m.UsersPage })))
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/forgot-password-page').then((m) => ({ default: m.ForgotPasswordPage })),
)
const LoginPage = lazy(() => import('@/pages/auth/login-page').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/auth/register-page').then((m) => ({ default: m.RegisterPage })))
const VerifyEmailPage = lazy(() => import('@/pages/auth/verify-email-page').then((m) => ({ default: m.VerifyEmailPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })))
const CreatorDashboardPage = lazy(() =>
  import('@/pages/elections/creator-dashboard-page').then((m) => ({ default: m.CreatorDashboardPage })),
)
const CandidatePreviewPage = lazy(() =>
  import('@/pages/elections/candidate-preview-page').then((m) => ({ default: m.CandidatePreviewPage })),
)
const ElectionCandidatesPage = lazy(() =>
  import('@/pages/elections/election-candidates-page').then((m) => ({ default: m.ElectionCandidatesPage })),
)
const ElectionCreatePage = lazy(() =>
  import('@/pages/elections/election-create-page').then((m) => ({ default: m.ElectionCreatePage })),
)
const ElectionDetailPage = lazy(() =>
  import('@/pages/elections/election-detail-page').then((m) => ({ default: m.ElectionDetailPage })),
)
const ElectionEditPage = lazy(() =>
  import('@/pages/elections/election-edit-page').then((m) => ({ default: m.ElectionEditPage })),
)
const ElectionCreatorViewPage = lazy(() =>
  import('@/pages/elections/election-creator-view-page').then((m) => ({ default: m.ElectionCreatorViewPage })),
)
const ElectionWizardPage = lazy(() =>
  import('@/pages/elections/election-wizard-page').then((m) => ({ default: m.ElectionWizardPage })),
)
const ElectionsDiscoverPage = lazy(() =>
  import('@/pages/elections/elections-discover-page').then((m) => ({ default: m.ElectionsDiscoverPage })),
)
const ElectionsManagePage = lazy(() =>
  import('@/pages/elections/elections-manage-page').then((m) => ({ default: m.ElectionsManagePage })),
)
const ResultsAnalyticsPage = lazy(() =>
  import('@/pages/elections/results-analytics-page').then((m) => ({ default: m.ResultsAnalyticsPage })),
)
const NotificationsPage = lazy(() =>
  import('@/pages/notifications/notifications-page').then((m) => ({ default: m.NotificationsPage })),
)
const SettingsPage = lazy(() => import('@/pages/settings/settings-page').then((m) => ({ default: m.SettingsPage })))
const ResultsPage = lazy(() => import('@/pages/voting/results-page').then((m) => ({ default: m.ResultsPage })))
const VotePage = lazy(() => import('@/pages/voting/vote-page').then((m) => ({ default: m.VotePage })))
const MyVotesPage = lazy(() => import('@/pages/voting/my-votes-page').then((m) => ({ default: m.MyVotesPage })))

export function AppRoutes() {
  return (
    <>
      <OfflineBanner />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/landing" element={<LandingPage />} />

        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        <Route element={<AuthLayout />}>
          <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        <Route element={<DashboardLayout />}>
          <Route path="/elections/:id" element={<ElectionDetailPage />} />
          <Route path="/elections/:id/results" element={<ResultsPage />} />
        </Route>

        {/* ── Protected Panels (User, Creator, Admin) ── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/my-votes" element={<MyVotesPage />} />
            <Route path="/voter/social" element={<SocialFeedPage myPostsOnly={false} />} />
            <Route path="/account/creator-status" element={<CreatorApplicationStatusPage />} />
            <Route path="/elections" element={<ElectionsDiscoverPage />} />

            <Route element={<RoleGuard allow={['election_creator', 'super_admin']} />}>
              <Route path="/elections/creator" element={<CreatorDashboardPage />} />
              <Route path="/elections/social" element={<SocialFeedPage myPostsOnly={false} />} />
              <Route path="/elections/wizard" element={<ElectionWizardPage />} />
              <Route path="/elections/:id/wizard" element={<ElectionWizardPage />} />
              <Route path="/elections/manage" element={<ElectionsManagePage />} />
              <Route path="/elections/new" element={<ElectionCreatePage />} />
              <Route path="/elections/:id/edit" element={<ElectionEditPage />} />
              <Route path="/elections/:id/creator-view" element={<ElectionCreatorViewPage />} />
              <Route path="/elections/analytics" element={<ResultsAnalyticsPage />} />
              <Route path="/elections/:id/candidates/:candidateId" element={<CandidatePreviewPage />} />
              <Route path="/elections/:id/candidates" element={<ElectionCandidatesPage />} />
            </Route>

            <Route path="/elections/:id/vote" element={<VotePage />} />

            <Route element={<RoleGuard allow={['super_admin']} />}>
              <Route path="/admin" element={<SuperAdminOverviewPage />} />
              <Route path="/admin/social" element={<SocialFeedPage myPostsOnly={false} />} />
              <Route path="/admin/social-moderation" element={<AdminSocialPage />} />
              <Route path="/admin/elections" element={<SuperAdminElectionsPage />} />
              <Route path="/admin/elections/:id/manage" element={<SuperAdminElectionManagePage />} />
              <Route path="/admin/creators" element={<SuperAdminCreatorsPage />} />
              <Route path="/admin/audit" element={<AuditPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
            </Route>

            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* ── Social Media — PUBLIC (no login required to view) ────────── */}
        {/* SocialPageLayout shows guest navbar for guests, full dashboard for logged-in */}
        <Route element={<SocialPageLayout />}>
          <Route element={<SocialLayout />}>
            {/* Public read routes — accessible to guests and logged-in users */}
            <Route path="/social"                   element={<SocialFeedPage myPostsOnly={false} />} />
            <Route path="/social/search"            element={<SocialSearchPage />} />
            <Route path="/social/trending"          element={<SocialHashtagPage />} />
            <Route path="/social/hashtag/:tag"      element={<SocialHashtagPage />} />
            <Route path="/social/posts/:id"         element={<SocialPostDetailPage />} />
            <Route path="/social/profile/:username" element={<SocialProfilePage />} />
            <Route path="/social/profile/:username/following" element={<SocialProfilePage />} />
            <Route path="/social/profile/:username/followers" element={<SocialProfilePage />} />
            <Route path="/social/news"              element={<NewsPage />} />

            {/* Authenticated-only social routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/social/my-posts"        element={<SocialFeedPage myPostsOnly={true} />} />
              <Route path="/social/following"       element={<SocialFeedPage myPostsOnly={false} />} />
              <Route path="/social/notifications"   element={<SocialNotifPage />} />
              <Route path="/social/bookmarks"       element={<SocialBookmarksPage />} />
              <Route path="/social/drafts"          element={<SocialDraftsPage />} />
              <Route path="/social/create"          element={<SocialCreatePage />} />
            </Route>
          </Route>
        </Route>

        {/* Backwards compat redirect */}
        <Route path="/community-feed" element={<Navigate to="/social" replace />} />
        <Route path="/public/social"  element={<Navigate to="/social" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    </>
  )
}
