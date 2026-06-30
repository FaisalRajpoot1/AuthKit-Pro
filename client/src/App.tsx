import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { confirmEmailChange, verifyEmail } from '@/features/auth/auth.api';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { AdminPage } from '@/pages/AdminPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { OrganizationsPage } from '@/pages/OrganizationsPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { LoginPage } from '@/pages/LoginPage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { TokenActionPage } from '@/pages/TokenActionPage';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/invites/accept" element={<AcceptInvitePage />} />
      <Route
        path="/verify-email"
        element={
          <TokenActionPage
            action={verifyEmail}
            pendingTitle="Verifying your email"
            successTitle="Email verified"
            successMessage="Your email address has been confirmed."
          />
        }
      />
      <Route
        path="/confirm-email-change"
        element={
          <TokenActionPage
            action={confirmEmailChange}
            pendingTitle="Confirming your new email"
            successTitle="Email updated"
            successMessage="Your email address has been updated."
          />
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
